import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';
import { apiError, apiSuccess } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contestId, userCount = 50 } = body;

        if (!contestId) {
            return apiError('contestId is required', 'BAD_REQUEST', 400);
        }

        const contestRef = adminDb.collection('contests').doc(contestId);
        const contestSnap = await contestRef.get();
        if (!contestSnap.exists) {
            return apiError('Contest not found', 'NOT_FOUND', 404);
        }
        
        const contestData = contestSnap.data()!;
        const branch = contestData.branch || 'ece';
        const totalMarks = contestData.totalMarks || 100;
        
        console.log(`[Simulation] Starting simulation for ${contestId} with ${userCount} users`);

        const batches = [];
        let batch = adminDb.batch();
        let opsCount = 0;

        const commitBatch = async () => {
            if (opsCount > 0) {
                batches.push(batch.commit());
                batch = adminDb.batch();
                opsCount = 0;
            }
        };

        const generatedUids = [];

        // 1. Generate Dummy Users
        for (let i = 0; i < userCount; i++) {
            const uid = `sim_user_${Date.now()}_${i}`;
            const userRef = adminDb.collection('users').doc(uid);
            generatedUids.push(uid);
            
            // Give them a random rating between 1300 and 1900
            const randomBaseRating = Math.floor(Math.random() * 600) + 1300;
            
            batch.set(userRef, {
                uid,
                username: `sim_user_${i}`,
                name: `Simulation User ${i}`,
                email: `sim${i}@example.com`,
                createdAt: new Date().toISOString(),
                branchRatings: { [branch]: randomBaseRating },
                highestBranchRatings: { [branch]: randomBaseRating },
                isSimulated: true
            });
            opsCount++;
            if (opsCount >= 400) await commitBatch();
        }

        await commitBatch();
        console.log(`[Simulation] Created ${userCount} dummy users.`);

        // 2. Generate Attempts
        for (const uid of generatedUids) {
            const attemptId = `${uid}_${contestId}`;
            const attemptRef = adminDb.collection('contest_attempts').doc(attemptId);
            
            // Random score based vaguely on their Elo (higher Elo -> higher chance of good score)
            // But keep it somewhat randomized. Score out of totalMarks.
            const userRef = adminDb.collection('users').doc(uid);
            const userSnap = await userRef.get();
            const rating = userSnap.data()?.branchRatings?.[branch] || 1500;
            
            // Expected percentage loosely based on rating (e.g. 1500 -> ~50%, 1900 -> ~80%)
            const expectedPct = Math.min(1.0, Math.max(0.1, (rating - 1000) / 1000));
            // Add some variance
            const actualPct = Math.min(1.0, Math.max(0.0, expectedPct + (Math.random() * 0.3 - 0.15)));
            
            const score = Math.round(actualPct * totalMarks);
            const timeSpent = Math.floor(Math.random() * 7200) + 3600; // 1 to 3 hours
            
            batch.set(attemptRef, {
                id: attemptId,
                uid,
                contestId,
                startedAt: Date.now() - timeSpent * 1000,
                lastUpdated: Date.now(),
                timeLeftSeconds: 0,
                isSubmitted: true,
                submittedAt: Date.now(),
                isPractice: false,
                score: score,
                responses: {} // We mock the score directly to avoid evaluating massive responses
            });
            
            opsCount++;
            if (opsCount >= 400) await commitBatch();
        }
        
        await commitBatch();
        console.log(`[Simulation] Created ${userCount} attempts.`);
        
        // Ensure contest is not marked as processed yet
        await contestRef.update({ isRatingsProcessed: false });

        // 3. Process Ratings
        console.log(`[Simulation] Processing ratings...`);
        const processResult = await processContestRatings(adminDb, contestId);
        
        return apiSuccess({
            message: `Simulated ${userCount} users and processed ratings.`,
            processResult
        });

    } catch (error: any) {
        console.error('[Simulation Error]', error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
