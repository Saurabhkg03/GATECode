import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contestId } = body;

        if (!contestId) {
            return NextResponse.json({ error: 'Missing contestId' }, { status: 400 });
        }

        const app = await initAdmin();
        if (!app) {
             return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const db = app.firestore();

        // 1. Fetch the contest
        const contestRef = db.collection('contests').doc(contestId);
        const contestSnap = await contestRef.get();
        if (!contestSnap.exists) {
            return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
        }

        const contestData = contestSnap.data()!;
        if (contestData.isRatingsProcessed) {
            return NextResponse.json({ error: 'Ratings already processed for this contest' }, { status: 400 });
        }

        // 2. Fetch all valid attempts for this contest
        const attemptsQuery = db.collection('contest_attempts')
            .where('contestId', '==', contestId)
            .where('isSubmitted', '==', true);
        const attemptsSnap = await attemptsQuery.get();

        const validAttempts = attemptsSnap.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => d.data().isPractice !== true);

        if (validAttempts.length === 0) {
            // Mark as processed if there are no attempts
            await contestRef.update({ isRatingsProcessed: true });
            return NextResponse.json({ success: true, message: 'No valid attempts found, marked as processed.' });
        }

        // 3. Build a scoring dictionary for questions
        const questionMap = new Map();
        contestData.sections.forEach((sec: any) => {
            sec.questions.forEach((q: any) => {
                let negativeMarks = Number(q.negative_marks);
                const marks = Number(q.marks) || 0;
                if (isNaN(negativeMarks)) {
                    negativeMarks = q.question_type === 'mcq' ? marks / 3 : 0;
                }
                questionMap.set(q.id, {
                    type: q.question_type,
                    marks,
                    negativeMarks,
                    options: q.options,
                    natMin: parseFloat(q.nat_answer_min),
                    natMax: parseFloat(q.nat_answer_max)
                });
            });
        });

        // 4. Calculate stats per attempt
        interface AttemptStat {
            uid: string;
            score: number;
            timeSpent: number;
            oldRating: number;
        }
        const userStats: AttemptStat[] = [];

        // Fetch all users involved in attempts
        const uids = validAttempts.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.data().uid);
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
        
        validAttempts.forEach((docSnap: admin.firestore.QueryDocumentSnapshot) => {
            const data = docSnap.data();
            let score = 0;
            let totalTimeSpent = 0;

            Object.values(data.responses || {}).forEach((resp: any) => {
                const qId = resp.questionId;
                const qData = questionMap.get(qId);

                if (resp.timeSpent) totalTimeSpent += resp.timeSpent;

                if (!qData) return;

                const isAttempted = resp.status === 'answered' || resp.status === 'answered_marked_for_review';
                if (!isAttempted) return;

                let isCorrect = false;
                if (qData.type === 'mcq') {
                    const correctOption = qData.options?.find((o: any) => o.is_correct);
                    isCorrect = correctOption && resp.selectedOptions?.[0] === correctOption.label;
                } else if (qData.type === 'msq') {
                    const correctLabels = qData.options?.filter((o: any) => o.is_correct).map((o: any) => o.label).sort();
                    const userVal = resp.selectedOptions?.sort();
                    isCorrect = correctLabels && userVal && correctLabels.length === userVal.length &&
                        correctLabels.every((val: string, index: number) => val === userVal[index]);
                } else if (qData.type === 'nat') {
                    const val = parseFloat(resp.natAnswer || '');
                    if (!isNaN(val) && !isNaN(qData.natMin) && !isNaN(qData.natMax) && val >= qData.natMin && val <= qData.natMax) {
                        isCorrect = true;
                    }
                }

                if (isCorrect) {
                    score += qData.marks;
                } else {
                    score -= qData.negativeMarks;
                }
            });

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

        userStats.forEach((userA, rankIndexA) => {
            const actualRankA = rankIndexA + 1;
            let expectedRankA = 1;

            userStats.forEach((userB) => {
                if (userA.uid !== userB.uid) {
                    // Probability that B beats A
                    const pBbeatsA = 1 / (1 + Math.pow(10, (userA.oldRating - userB.oldRating) / 400));
                    expectedRankA += pBbeatsA;
                }
            });

            const userData = usersData.get(userA.uid) || {};
            const contestCount = (userData.contestCount || 0) + 1;

            // Volatility Factor. Start at 50, decrease slowly
            let K = 50;
            if (contestCount > 3) K = 40;
            if (contestCount > 10) K = 30;
            if (contestCount > 20) K = 20;

            const ratingChange = K * (expectedRankA - actualRankA);
            const newRating = Math.round(userA.oldRating + ratingChange);

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
        currentBatch.update(contestRef, { isRatingsProcessed: true });
        batches.push(currentBatch.commit());

        await Promise.all(batches);

        return NextResponse.json({ success: true, processedCount: updates.size, attemptsCount: validAttempts.length });

    } catch (e: any) {
        console.error("Process ratings error:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
