import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { processContestRatings } from '@/lib/ratingProcessor';

/**
 * POST /api/exam/cleanup
 * 
 * Scans for contest attempts that are:
 *   - NOT yet submitted (isSubmitted == false)
 *   - Past their allowed time window (startedAt + timeLeftSeconds * 1000 + grace period)
 * 
 * For each stale attempt, it marks isSubmitted: true using the
 * last-synced responses already stored in Firestore — exactly the
 * same "late submission" path used by the submit API.
 *
 * This is intended to be called opportunistically (e.g. on Leaderboard
 * page load) so that lingering "ghost" attempts don't corrupt rankings.
 */
export async function POST(req: NextRequest) {
    try {
        const serverTime = Date.now();
        const GRACE_MS = 60_000; // 60 s grace, mirrors submit route

        const app = await initAdmin();
        if (!app) {
             return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const db = app.firestore();

        // Find all non-submitted attempts
        const attemptsQuery = db.collection('contest_attempts').where('isSubmitted', '==', false);
        const staleSnap = await attemptsQuery.get();

        if (staleSnap.empty) {
            return NextResponse.json({ cleaned: 0 });
        }

        let cleaned = 0;
        const updates: Promise<void>[] = [];

        staleSnap.docs.forEach((attemptDoc: admin.firestore.QueryDocumentSnapshot) => {
            const data = attemptDoc.data();
            const startedAt: number = data.startedAt || 0;
            const timeLeftSeconds: number = data.timeLeftSeconds || 0;

            const deadline = startedAt + timeLeftSeconds * 1000 + GRACE_MS;

            if (serverTime > deadline) {
                // This attempt has expired — auto-close it using its last synced state
                const updateTask = (async () => {
                    try {
                        const contestRef = db.collection('contests').doc(data.contestId);
                        const contestSnap = await contestRef.get();

                        const attemptRef = db.collection('contest_attempts').doc(attemptDoc.id);

                        // Mark as submitted first (idempotent-safe)
                        await attemptRef.update({
                            isSubmitted: true,
                            submittedAt: serverTime,
                            lastUpdated: serverTime,
                            timeLeftSeconds: 0,
                            autoSubmitted: true, // flag for debugging
                        });

                        // Only update user ratings for non-practice (live) attempts
                        if (!data.isPractice && data.uid && contestSnap.exists) {
                            const contestData = contestSnap.data()!;
                            const branch = contestData?.branch || 'General';
                            const responses = data.responses || {};

                            let correctCount = 0;
                            let totalAttempted = 0;

                            Object.values(responses).forEach((resp: any) => {
                                if (resp.status === 'answered' || resp.status === 'marked') {
                                    totalAttempted++;
                                    if (resp.isCorrect) correctCount++;
                                }
                            });

                            const userRef = db.collection('users').doc(data.uid);
                            const userSnap = await userRef.get();
                            if (userSnap.exists) {
                                const userData = userSnap.data()!;
                                const branchStats = userData.branchStats?.[branch] || { attempted: 0, correct: 0, accuracy: 0 };
                                const newAttempted = (branchStats.attempted || 0) + totalAttempted;
                                const newCorrect = (branchStats.correct || 0) + correctCount;
                                const newAccuracy = newAttempted > 0 ? parseFloat(((newCorrect / newAttempted) * 100).toFixed(2)) : 0;
                                
                                await userRef.update({
                                    [`branchStats.${branch}.attempted`]: newAttempted,
                                    [`branchStats.${branch}.correct`]: newCorrect,
                                    [`branchStats.${branch}.accuracy`]: newAccuracy,
                                    'stats.attempted': (userData.stats?.attempted || 0) + totalAttempted,
                                    'stats.correct': (userData.stats?.correct || 0) + correctCount,
                                });
                            }
                        }

                        cleaned++;
                        console.log(`[Cleanup] Auto-submitted stale attempt ${attemptDoc.id}`);
                    } catch (err) {
                        console.error(`[Cleanup] Failed to auto-submit ${attemptDoc.id}:`, err);
                    }
                })();

                updates.push(updateTask);
            }
        });

        await Promise.allSettled(updates);

        // --- Auto-process ELO for ended contests ---
        let processedContests = 0;
        try {
            const now = new Date().toISOString();
            const endedContestsSnap = await db.collection('contests')
                .where('endTime', '<', now)
                .get();

            for (const contestDoc of endedContestsSnap.docs) {
                const contestData = contestDoc.data();
                if (!contestData.isRatingsProcessed) {
                    try {
                        console.log(`[Cleanup Auto-Elo] Processing ratings for completed contest: ${contestDoc.id} (${contestData.title})`);
                        await processContestRatings(db, contestDoc.id);
                        processedContests++;
                    } catch (err) {
                        console.error(`[Cleanup Auto-Elo] Failed to auto-process ratings for contest ${contestDoc.id}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error('[Cleanup Auto-Elo] Error querying ended contests:', err);
        }

        return NextResponse.json({ cleaned, processedContests });
    } catch (e: any) {
        console.error('[Cleanup] Error:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
