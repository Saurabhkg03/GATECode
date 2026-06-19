import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';
import { apiError, apiSuccess } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
    try {
        console.log('[Simulate 5] Starting...');
        
        // 1. Delete old simulated users
        const oldUsersSnap = await adminDb.collection('users').where('isSimulated', '==', true).get();
        let batches: Promise<any>[] = [];
        let batch = adminDb.batch();
        let ops = 0;
        
        const commit = async () => {
            if (ops > 0) {
                batches.push(batch.commit());
                batch = adminDb.batch();
                ops = 0;
            }
        };

        for (const doc of oldUsersSnap.docs) {
            batch.delete(doc.ref);
            ops++;
            if (ops >= 400) await commit();
        }
        await commit();
        await Promise.all(batches);
        batches = []; // Reset batches
        console.log(`[Simulate 5] Deleted ${oldUsersSnap.size} old simulated users.`);

        // 2. Generate 100 new users with specific profiles
        const users = [];
        for (let i = 0; i < 100; i++) {
            let profile = 'normal';
            if (i < 5) profile = 'acer'; // always top 5%
            else if (i < 10) profile = 'bomber'; // always bottom 5%
            else if (i < 15) profile = 'improver'; // gets better each test
            else if (i < 20) profile = 'deteriorator'; // gets worse each test
            else if (i < 25) profile = 'skipper'; // skips ~40% of tests
            
            const uid = `sim_user_fresh_${Date.now()}_${i}`;
            users.push({ uid, profile, index: i });
            
            batch.set(adminDb.collection('users').doc(uid), {
                uid,
                username: `sim_user_${profile}_${i}`,
                name: `Sim ${profile.charAt(0).toUpperCase() + profile.slice(1)} ${i}`,
                email: `sim${i}@example.com`,
                createdAt: new Date().toISOString(),
                branchRatings: { cse: 1500 },
                highestBranchRatings: { cse: 1500 },
                contestCount: 0,
                isSimulated: true,
                role: 'user'
            });
            ops++;
            if (ops >= 400) await commit();
        }
        await commit();
        await Promise.all(batches);
        batches = [];
        console.log(`[Simulate 5] Generated 100 fresh accounts.`);

        // 3. Generate 5 Contests
        const contestIds = [];
        for (let c = 1; c <= 5; c++) {
            const contestId = `sim_contest_${Date.now()}_${c}`;
            contestIds.push(contestId);
            
            batch.set(adminDb.collection('contests').doc(contestId), {
                id: contestId,
                title: `Simulated Series Contest ${c}`,
                branch: 'cse',
                totalMarks: 100,
                durationMinutes: 90,
                startTime: Date.now() - (6 - c) * 86400000, // c days ago
                endTime: Date.now() - (6 - c) * 86400000 + 5400000,
                isRatingsProcessed: false,
                status: 'completed',
                isRated: true,
                participants: users.map(u => u.uid)
            });
            ops++;
            if (ops >= 400) await commit();
        }
        await commit();
        await Promise.all(batches);
        batches = [];

        // 4. Run attempts and process ratings for each contest consecutively
        for (let c = 0; c < 5; c++) {
            const contestId = contestIds[c];
            console.log(`[Simulate 5] Running contest ${c+1}: ${contestId}`);
            
            for (const user of users) {
                // Edge case: skippers
                if (user.profile === 'skipper' && Math.random() < 0.4) {
                    continue; // Skip this contest
                }

                // Determine score
                let expectedPct = 0.5 + (Math.random() * 0.4 - 0.2); // Normal: 30% to 70%
                
                if (user.profile === 'acer') expectedPct = 0.85 + Math.random() * 0.1; // 85-95%
                if (user.profile === 'bomber') expectedPct = 0.1 + Math.random() * 0.15; // 10-25%
                if (user.profile === 'improver') expectedPct = 0.3 + (c * 0.15) + (Math.random()*0.1-0.05); // 30%, 45%, 60%, 75%, 90%
                if (user.profile === 'deteriorator') expectedPct = 0.9 - (c * 0.15) + (Math.random()*0.1-0.05); // 90%, 75%, 60%, 45%, 30%

                const actualPct = Math.min(1.0, Math.max(0.0, expectedPct));
                const score = Math.round(actualPct * 100);

                const attemptId = `${user.uid}_${contestId}`;
                batch.set(adminDb.collection('contest_attempts').doc(attemptId), {
                    id: attemptId,
                    uid: user.uid,
                    contestId,
                    startedAt: Date.now() - 3600000,
                    lastUpdated: Date.now(),
                    timeLeftSeconds: 0,
                    isSubmitted: true,
                    submittedAt: Date.now(),
                    isPractice: false,
                    score: score,
                    responses: {}
                });
                ops++;
                if (ops >= 400) await commit();
            }
            await commit();
            await Promise.all(batches);
            batches = [];

            // Process Ratings for this contest
            await processContestRatings(adminDb, contestId);
            console.log(`[Simulate 5] Processed ratings for contest ${c+1}`);
        }

        return apiSuccess({ 
            message: 'Successfully ran 5 contest simulations.',
            contests: contestIds
        });

    } catch (error: any) {
        console.error(error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
