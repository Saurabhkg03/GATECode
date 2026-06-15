import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { evaluateExam } from '@/utils/examScoring';
import { z } from 'zod';
import { examSubmitLimiter } from '@/lib/rateLimit';
import { apiError, apiSuccess } from '@/lib/apiResponse';

const submitSchema = z.object({
  contestId: z.string().optional(),
  uid: z.string().min(1, "uid is required"),
  attemptId: z.string().min(1, "attemptId is required"),
  responses: z.any().optional(),
  timeLeftSeconds: z.number().optional()
});

// Simple implementation accepting the Beacon payload
export async function POST(req: NextRequest) {
    try {
        // Beacon sends 'text/plain' or 'application/json' in Blob.
        let body;

        // Handle Blob/Strings
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            body = await req.json();
        } else {
            // Beacon sometimes sends as text even if we said json blob
            const text = await req.text();
            body = JSON.parse(text);
        }

        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Bad Request', 'BAD_REQUEST', 400, parsed.error.format());
        }

        const { contestId, uid, attemptId, responses } = parsed.data;

        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

        const token = authHeader.split('Bearer ')[1];

        // --- Save to Firestore using Admin SDK ---
        const app = await initAdmin();
        if (!app) {
             return apiError('Firebase Admin not configured', 'SERVER_ERROR', 500);
        }

        const decodedToken = await app.auth().verifyIdToken(token);
        if (decodedToken.uid !== uid) {
            return apiError('Forbidden: UID mismatch', 'FORBIDDEN', 403);
        }

        const { success } = await examSubmitLimiter.limit(uid);
        if (!success) {
            return apiError('Too Many Requests', 'RATE_LIMITED', 429);
        }
        const db = app.firestore();
        const attemptRef = db.collection('contest_attempts').doc(attemptId);
        const userRef = db.collection('users').doc(uid);

        let resultPayload: any = null;

        await db.runTransaction(async (t: any) => {
            const attemptSnap = await t.get(attemptRef);
            if (!attemptSnap.exists) {
                throw new Error('Attempt not found');
            }
            const attemptData = attemptSnap.data()!;

            // IDEMPOTENCY CHECK
            if (attemptData.isSubmitted) {
                resultPayload = { success: true, warning: 'Already submitted', idempotent: true };
                return;
            }

            // 2. Calculate actual time spent based on server clock
            const serverTime = Date.now();
            const timeSpentMs = serverTime - attemptData.startedAt;
            const serverTimeLeft = attemptData.timeLeftSeconds || 0;
            const allowedTimeMs = (serverTimeLeft * 1000) + 60000; // Add 60s grace period for network latency

            if (timeSpentMs > allowedTimeMs && !attemptData.isPractice) {
                // Flag this submission as late or invalid. 
                // Do not accept new answers, just auto-submit what was previously synced.
                console.warn(`[Submission Late] Attempt ${attemptId}. TimeSpent: ${timeSpentMs}, Allowed: ${allowedTimeMs}`);
                t.update(attemptRef, {
                    isSubmitted: true,
                    submittedAt: serverTime,
                    lastUpdated: serverTime,
                    timeLeftSeconds: 0 // Enforce 0
                });
                resultPayload = { success: true, warning: 'Submission was late. Only previously synced answers were recorded.' };
                return;
            }

            // --- Fetch Contest to Validate Server-Side ---
            const actualContestId = attemptData.contestId || contestId;
            const contestRef = db.collection('contests').doc(actualContestId);
            const contestSnap = await t.get(contestRef);
            let contestData: any = null;
            let totalScore = 0;
            let correctCount = 0;
            let totalAttempted = 0;

            if (contestSnap.exists) {
                contestData = contestSnap.data()!;
                
                if (contestData.endTime) {
                    const contestEndTimeMs = new Date(contestData.endTime).getTime();
                    if (serverTime > contestEndTimeMs + 60000 && !attemptData.isPractice) {
                        console.warn(`[Submission Late - Contest Ended] Attempt ${attemptId}. ServerTime: ${serverTime}, EndTime: ${contestEndTimeMs}`);
                        t.update(attemptRef, {
                            isSubmitted: true,
                            submittedAt: serverTime,
                            lastUpdated: serverTime,
                            timeLeftSeconds: 0
                        });
                        resultPayload = { success: true, warning: 'Submission was late. The contest had already ended. Only previously synced answers were recorded.' };
                        return;
                    }
                }
                
                // Use the shared evaluation engine
                const result = evaluateExam(contestData, responses);
                
                totalScore = result.totalScore;
                correctCount = result.correctCount;
                totalAttempted = result.totalAttempted;
            }

            // --- Update User Stats if not Practice ---
            if (!attemptData.isPractice && contestData) {
                const userSnap = await t.get(userRef);

                if (userSnap.exists) {
                    const userData = userSnap.data()!;
                    const branch = contestData.branch || 'General'; // Default to General if not specified

                    // Update User Profile Stats
                    const branchStats = userData.branchStats?.[branch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
                    const newAttempted = (branchStats.attempted || 0) + totalAttempted;
                    const newCorrect = (branchStats.correct || 0) + correctCount;
                    const newAccuracy = newAttempted > 0 ? parseFloat(((newCorrect / newAttempted) * 100).toFixed(2)) : 0;

                    let updateObject: any = {
                        [`branchStats.${branch}.attempted`]: newAttempted,
                        [`branchStats.${branch}.correct`]: newCorrect,
                        [`branchStats.${branch}.accuracy`]: newAccuracy,
                        'stats.attempted': (userData.stats?.attempted || 0) + totalAttempted,
                        'stats.correct': (userData.stats?.correct || 0) + correctCount,
                    };

                    t.update(userRef, updateObject);
                    console.log(`[Stats Update] User ${uid} updated for branch ${branch}.`);
                }
            }

            const finalTimeLeftSeconds = Math.max(0, Math.floor(attemptData.timeLeftSeconds - (timeSpentMs / 1000)));

            t.update(attemptRef, {
                responses,
                score: parseFloat(totalScore.toFixed(2)),
                timeLeftSeconds: finalTimeLeftSeconds,
                isSubmitted: true,
                submittedAt: serverTime,
                lastUpdated: serverTime
            });

            console.log(`[Submission Success] Attempt ${attemptId} marked as completed.`);
            resultPayload = { success: true };
        });

        if (resultPayload?.error) {
            return apiError(resultPayload.error, 'BAD_REQUEST', resultPayload.status || 400);
        }

        return apiSuccess(resultPayload);

    } catch (e: any) {
        console.error("Submission error:", e);
        return apiError(e.message || 'Internal Server Error', 'INTERNAL_ERROR', 500);
    }
}
