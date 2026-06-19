import admin from 'firebase-admin';
import { evaluateExam } from '../utils/examScoring';

export async function processContestRatings(db: admin.firestore.Firestore, contestId: string) {
    // 1. Fetch the contest
    const contestRef = db.collection('contests').doc(contestId);
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists) {
        throw new Error('Contest not found');
    }

    const contestData = contestSnap.data()!;
    if (contestData.isRatingsProcessed) {
        console.log(`[ratingProcessor] Ratings already processed for contest ${contestId}`);
        return { success: true, message: 'Ratings already processed' };
    }

    // 2. Fetch all valid attempts for this contest
    const attemptsQuery = db.collection('contest_attempts')
        .where('contestId', '==', contestId)
        .where('isSubmitted', '==', true);
    const attemptsSnap = await attemptsQuery.get();

    const validAttempts = (attemptsSnap.docs as admin.firestore.QueryDocumentSnapshot[]).filter(d => d.data().isPractice !== true);

    if (validAttempts.length === 0) {
        // Mark as processed if there are no attempts
        await contestRef.update({ isRatingsProcessed: true, status: 'completed' });
        console.log(`[ratingProcessor] No valid attempts for contest ${contestId}, marked as processed.`);
        return { success: true, message: 'No valid attempts found, marked as processed.' };
    }

    // 4. Calculate stats per attempt
    interface AttemptStat {
        uid: string;
        score: number;
        timeSpent: number;
        oldRating: number;
    }
    const userStats: AttemptStat[] = [];

    // Fetch all users involved in attempts
    const uids = validAttempts.map(doc => doc.data().uid);
    const uniqueUids = Array.from(new Set(uids));

    const usersData = new Map();
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueUids.length; i += BATCH_SIZE) {
        const uidsChunk = uniqueUids.slice(i, i + BATCH_SIZE);
        const userQuery = db.collection('users').where('uid', 'in', uidsChunk);
        const userSnaps = await userQuery.get();
        userSnaps.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            usersData.set(doc.id, doc.data());
        });
    }

    const branch = contestData.branch || 'ece';
    
    validAttempts.forEach(docSnap => {
        const data = docSnap.data();
        let totalTimeSpent = 0;

        Object.values(data.responses || {}).forEach((resp: any) => {
            if (resp.timeSpent) totalTimeSpent += resp.timeSpent;
        });

        const result = evaluateExam(contestData, data.responses);
        const score = result.totalScore;

        // Use the saved score if it exists, otherwise use calculated score
        const finalScore = data.score !== undefined ? data.score : score;

        // Take highest score if multiple attempts
        const existingStat = userStats.find(s => s.uid === data.uid);
        if (!existingStat || finalScore > existingStat.score) {
            if (existingStat) {
                existingStat.score = finalScore;
                existingStat.timeSpent = totalTimeSpent;
            } else {
                const userData = usersData.get(data.uid) || {};
                const branchRatings = userData.branchRatings || {};
                
                userStats.push({
                    uid: data.uid,
                    score: finalScore,
                    timeSpent: totalTimeSpent,
                    oldRating: branchRatings[branch] || 1500
                });
            }
        }
    });

    // 5. Sort attempts to determine Actual Rank
    userStats.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeSpent - b.timeSpent;
    });

    // 6. Multiplayer Elo Calculation
    const updates = new Map();

    // Optimization: Bucket ratings to avoid O(N^2) complexity
    const ratingBuckets = new Map<number, number>();
    const BUCKET_SIZE = 10;
    userStats.forEach(u => {
        const bucket = Math.round(u.oldRating / BUCKET_SIZE) * BUCKET_SIZE;
        ratingBuckets.set(bucket, (ratingBuckets.get(bucket) || 0) + 1);
    });

    userStats.forEach((userA, rankIndexA) => {
        const actualRankA = rankIndexA + 1;
        let expectedRankA = 1;

        if (userStats.length > 200) {
            // Approximate Expected Rank using bucket distributions O(N * Buckets)
            ratingBuckets.forEach((count, bucketRating) => {
                const pBbeatsA = 1 / (1 + Math.pow(10, (userA.oldRating - bucketRating) / 400));
                expectedRankA += pBbeatsA * count;
            });
            // Subtract the user's own contribution from the bucket (approximates to 0.5)
            expectedRankA -= 0.5;
        } else {
            // Exact Expected Rank O(N^2) for small cohorts
            userStats.forEach((userB) => {
                if (userA.uid !== userB.uid) {
                    const pBbeatsA = 1 / (1 + Math.pow(10, (userA.oldRating - userB.oldRating) / 400));
                    expectedRankA += pBbeatsA;
                }
            });
        }

        const userData = usersData.get(userA.uid) || {};
        const contestCount = (userData.contestCount || 0) + 1;

        // Volatility Factor - Max rating change per contest
        let K = 200;
        if (contestCount > 3) K = 120;
        if (contestCount > 10) K = 80;
        if (contestCount > 20) K = 50;

        const N = userStats.length;
        // Normalize the rank difference to a [-1, 1] scale
        // This ensures the max rating change is exactly bounded by K, regardless of participant count
        const rankDiffNormalized = N > 1 ? (expectedRankA - actualRankA) / (N - 1) : 0;
        
        const ratingChange = Math.round(K * rankDiffNormalized);
        const newRating = Math.max(100, userA.oldRating + ratingChange); // Prevent Elo from dropping below 100

        updates.set(userA.uid, {
            oldRating: userA.oldRating,
            newRating,
            rank: actualRankA,
            ratingChange,
            contestCount
        });
    });

    // 7. Execute Firestore Batch Writes
    const batches = [];
    let currentBatch = db.batch();
    let writeCount = 0;

    updates.forEach((update, uid) => {
        const userRef = db.collection('users').doc(uid);
        const userData = usersData.get(uid) || {};
        
        const branchRatings = userData.branchRatings || {};
        const branchRatingHistory = userData.branchRatingHistory || {};
        const highestBranchRatings = userData.highestBranchRatings || {};

        const history = branchRatingHistory[branch] || [];

        history.push({
            contestId,
            contestTitle: contestData.title,
            date: Date.now(),
            oldRating: update.oldRating,
            newRating: update.newRating,
            rank: update.rank
        });

        const updatedBranchRatings = { ...branchRatings, [branch]: update.newRating };
        const updatedHighestRatings = { 
            ...highestBranchRatings, 
            [branch]: Math.max(highestBranchRatings[branch] || 1500, update.newRating) 
        };
        const updatedBranchHistory = { ...branchRatingHistory, [branch]: history };

        const updatedFields = {
            branchRatings: updatedBranchRatings,
            highestBranchRatings: updatedHighestRatings,
            branchRatingHistory: updatedBranchHistory,
            contestCount: update.contestCount
        };

        currentBatch.update(userRef, updatedFields);
        writeCount++;

        if (writeCount === 490) {
            batches.push(currentBatch.commit());
            currentBatch = db.batch();
            writeCount = 0;
        }
    });

    // Add contest update to batch
    currentBatch.update(contestRef, { isRatingsProcessed: true, status: 'completed' });
    batches.push(currentBatch.commit());

    try {
        await Promise.all(batches);
    } catch (e) {
        await contestRef.update({ status: 'error' });
        throw e;
    }
    
    console.log(`[ratingProcessor] Successfully processed ratings for contest ${contestId}. Size: ${updates.size}`);
    return { success: true, processedCount: updates.size, attemptsCount: validAttempts.length };
}
