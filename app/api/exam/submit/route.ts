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

        // --- Update User Stats if not Practice ---
        if (!attemptData.isPractice) {
            try {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);
                const contestRef = doc(db, 'contests', contestId);
                const contestSnap = await getDoc(contestRef);

                if (userSnap.exists() && contestSnap.exists()) {
                    const userData = userSnap.data();
                    const contestData = contestSnap.data();
                    const branch = contestData.branch || 'General'; // Default to General if not specified

                    // Calculate score for this attempt
                    let correctCount = 0;
                    let totalAttempted = 0;

                    // responses is an object: { qid: { selectedOptions, natAnswer, status, ... } }
                    Object.values(responses || {}).forEach((resp: any) => {
                        if (resp.status === 'answered' || resp.status === 'marked') {
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
