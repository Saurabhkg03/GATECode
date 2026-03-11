import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';

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

        const { contestId, uid, attemptId, responses, timeLeftSeconds } = body;

        if (!attemptId || !uid) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- Save to Firestore ---
        // Using standard Firestore update for reliability
        const { doc, updateDoc, getDoc } = await import('firebase/firestore');
        const attemptRef = doc(db, 'contest_attempts', attemptId);

        const attemptSnap = await getDoc(attemptRef);
        if (!attemptSnap.exists()) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }
        const attemptData = attemptSnap.data();

        // 2. Calculate actual time spent based on server clock
        const serverTime = Date.now();
        const timeSpentMs = serverTime - attemptData.startedAt;
        const serverTimeLeft = attemptData.timeLeftSeconds || 0;
        const allowedTimeMs = (serverTimeLeft * 1000) + 60000; // Add 60s grace period for network latency

        if (timeSpentMs > allowedTimeMs && !attemptData.isPractice) {
            // Flag this submission as late or invalid. 
            // Do not accept new answers, just auto-submit what was previously synced.
            console.warn(`[Submission Late] Attempt ${attemptId}. TimeSpent: ${timeSpentMs}, Allowed: ${allowedTimeMs}`);
            await updateDoc(attemptRef, {
                isSubmitted: true,
                submittedAt: serverTime,
                lastUpdated: serverTime,
                timeLeftSeconds: 0 // Enforce 0
            });
            return NextResponse.json({ success: true, warning: 'Submission was late. Only previously synced answers were recorded.' });
        }

        // --- Fetch Contest to Validate Server-Side ---
        const contestRef = doc(db, 'contests', contestId);
        const contestSnap = await getDoc(contestRef);
        let contestData: any = null;

        if (contestSnap.exists()) {
            contestData = contestSnap.data();
            const questionMap = new Map();
            if (contestData.sections) {
                contestData.sections.forEach((sec: any) => {
                    sec.questions.forEach((q: any) => {
                        questionMap.set(q.id, {
                            type: q.question_type,
                            options: q.options,
                            natMin: parseFloat(q.nat_answer_min),
                            natMax: parseFloat(q.nat_answer_max)
                        });
                    });
                });
            }

            // Trust the server, not the client
            Object.values(responses || {}).forEach((resp: any) => {
                const qData = questionMap.get(resp.questionId);
                if (qData) {
                    let isCorrect = false;
                    if (qData.type === 'mcq') {
                        const correctOption = qData.options?.find((o: any) => o.is_correct);
                        isCorrect = !!(correctOption && resp.selectedOptions?.[0] === correctOption.label);
                    } else if (qData.type === 'msq') {
                        const correctLabels = qData.options?.filter((o: any) => o.is_correct).map((o: any) => o.label).sort();
                        const userVal = [...(resp.selectedOptions || [])].sort();
                        isCorrect = !!(correctLabels && userVal && correctLabels.length === userVal.length &&
                            correctLabels.every((val: string, index: number) => val === userVal[index]));
                    } else if (qData.type === 'nat') {
                        const val = parseFloat(resp.natAnswer || '');
                        if (!isNaN(val) && !isNaN(qData.natMin) && !isNaN(qData.natMax) && val >= qData.natMin && val <= qData.natMax) {
                            isCorrect = true;
                        }
                    }
                    resp.isCorrect = isCorrect;
                } else {
                    resp.isCorrect = false;
                }
            });
        }

        // --- Update User Stats if not Practice ---
        if (!attemptData.isPractice && contestData) {
            try {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const branch = contestData.branch || 'General'; // Default to General if not specified

                    // Calculate score for this attempt
                    let correctCount = 0;
                    let totalAttempted = 0;

                    // responses is an object: { qid: { selectedOptions, natAnswer, status, ... } }
                    Object.values(responses || {}).forEach((resp: any) => {
                        if (resp.status === 'answered' || resp.status === 'answered_marked_for_review') {
                            totalAttempted++;
                            if (resp.isCorrect) {
                                correctCount++;
                            }
                        }
                    });

                    // Update User Profile Stats
                    const branchStats = userData.branchStats?.[branch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
                    const newAttempted = (branchStats.attempted || 0) + totalAttempted;
                    const newCorrect = (branchStats.correct || 0) + correctCount;
                    const newAccuracy = newAttempted > 0 ? parseFloat(((newCorrect / newAttempted) * 100).toFixed(2)) : 0;

                    // Rating Calculation Formula: (Accuracy / 100) * log10(Correct + 1) * 100
                    const newRating = parseFloat((Math.max(0, (newAccuracy / 100) * Math.log10(newCorrect + 1) * 100)).toFixed(2));

                    await updateDoc(userRef, {
                        [`branchStats.${branch}.attempted`]: newAttempted,
                        [`branchStats.${branch}.correct`]: newCorrect,
                        [`branchStats.${branch}.accuracy`]: newAccuracy,
                        [`ratings.${branch}`]: newRating,
                        // Optionally update global stats if they exist
                        'stats.attempted': (userData.stats?.attempted || 0) + totalAttempted,
                        'stats.correct': (userData.stats?.correct || 0) + correctCount,
                    });
                    console.log(`[Stats Update] User ${uid} updated for branch ${branch}. New Rating: ${newRating}`);
                }
            } catch (err) {
                console.error("[Stats Update Error]:", err);
                // We don't fail the whole submission if stats update fails, but we log it.
            }
        }

        await updateDoc(attemptRef, {
            responses,
            timeLeftSeconds,
            isSubmitted: true,
            submittedAt: serverTime,
            lastUpdated: serverTime
        });

        console.log(`[Submission Success] Attempt ${attemptId} marked as completed.`);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Submission error:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
