import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { Contest, ContestAttempt, QuestionResponse, Section, Question } from '@/types/exam';
import { evaluateExam } from '@/utils/examScoring';

export async function POST(req: NextRequest) {
    try {
        const { contestId, uid, forceFresh } = await req.json();

        if (!contestId || !uid) {
            return NextResponse.json({ error: 'Missing contestId or uid' }, { status: 400 });
        }

        // 1. Fetch Contest Metadata
        let actualContestId = contestId;
        let contestRef = doc(db, 'contests', contestId);
        let contestSnap = await getDoc(contestRef);

        if (!contestSnap.exists()) {
            // Try resolving generic scheduled contest ID (e.g., weekly-15) to a branch-specific contest
            if (contestId.startsWith('weekly-') || contestId.startsWith('biweekly-')) {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);
                const userBranch = userSnap.exists() ? (userSnap.data().branch || 'ece').toLowerCase() : 'ece';
                
                actualContestId = `${contestId}-${userBranch}`;
                contestRef = doc(db, 'contests', actualContestId);
                contestSnap = await getDoc(contestRef);
            }
        }

        if (!contestSnap.exists()) {
            return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
        }

        const contestData = contestSnap.data() as Contest;

        const attemptsRef = collection(db, 'contest_attempts');
        const q = query(
            attemptsRef,
            where('contestId', '==', actualContestId),
            where('uid', '==', uid),
            where('isSubmitted', '==', false)
        );
        const querySnap = await getDocs(q);

        let attempt: ContestAttempt | undefined = undefined;
        let serverTime = Date.now();

        // Dedup window: if a new attempt was created in the last 10 seconds, reuse it
        // This prevents double-creation from React StrictMode double-invocation
        const DEDUP_WINDOW_MS = 10_000;

        if (!querySnap.empty) {
            // Resume the most recent unsubmitted attempt
            const existingAttempts = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as ContestAttempt));

            // Sort newest first
            existingAttempts.sort((a, b) => b.startedAt - a.startedAt);

            // Cleanup expired or stale attempts
            let foundResumable = false;

            for (const att of existingAttempts) {
                const elapsedTime = (serverTime - att.startedAt) / 1000;

                let attemptAllocatedSeconds = contestData.durationMinutes * 60;
                let isAttemptPractice = att.isPractice || false;

                if (contestData.endTime) {
                    const endMs = new Date(contestData.endTime).getTime();
                    // Original start time vs End time
                    const timeUntilEndSeconds = Math.floor((endMs - att.startedAt) / 1000);

                    if (timeUntilEndSeconds <= 0) {
                        isAttemptPractice = true;
                        // Practice gets full time
                        attemptAllocatedSeconds = contestData.durationMinutes * 60;
                    } else if (!isAttemptPractice) {
                        attemptAllocatedSeconds = Math.min(attemptAllocatedSeconds, timeUntilEndSeconds);
                    }
                }

                const isExpired = elapsedTime >= attemptAllocatedSeconds;
                const isVeryRecent = (serverTime - att.startedAt) < DEDUP_WINDOW_MS;

                // For resume logic, if it's not expired or we are forcing fresh
                if (forceFresh && !isVeryRecent) {
                    // Auto-submit stale unsubmitted attempts when force fresh
                    const result = evaluateExam(contestData, att.responses);
                    const attRef = doc(db, 'contest_attempts', att.id);
                    await updateDoc(attRef, {
                        isSubmitted: true,
                        timeLeftSeconds: 0,
                        score: result.totalScore,
                        responses: result.responses,
                        lastUpdated: serverTime
                    });
                } else if (isExpired && !isVeryRecent) {
                    // Auto-submit expired attempts
                    const result = evaluateExam(contestData, att.responses);
                    const attRef = doc(db, 'contest_attempts', att.id);
                    await updateDoc(attRef, {
                        isSubmitted: true,
                        timeLeftSeconds: 0,
                        score: result.totalScore,
                        responses: result.responses,
                        lastUpdated: serverTime
                    });
                } else if (!foundResumable && !isExpired) {
                    // Resume valid attempt (could be a dedup match or a real in-progress attempt)
                    attempt = att;
                    attempt.timeLeftSeconds = Math.max(0, attemptAllocatedSeconds - elapsedTime);
                    // Update practice state if it changed retroactively
                    if (isAttemptPractice !== att.isPractice) {
                        attempt.isPractice = isAttemptPractice;
                        const attRef = doc(db, 'contest_attempts', att.id);
                        await updateDoc(attRef, { isPractice: isAttemptPractice });
                    }
                    foundResumable = true;
                }
            }
        }

        if (!attempt) {
            // Create a brand new unique attempt
            const newAttemptId = `${actualContestId}_${uid}_${serverTime}_${Math.random().toString(36).substring(2, 6)}`;
            const attemptRef = doc(db, 'contest_attempts', newAttemptId);

            let allocatedSeconds = contestData.durationMinutes * 60;
            let isPractice = false;

            if (contestData.endTime) {
                const endMs = new Date(contestData.endTime).getTime();
                const timeUntilEndSeconds = Math.floor((endMs - serverTime) / 1000);

                if (timeUntilEndSeconds <= 0) {
                    // CONTEST IS OVER. 
                    // Allow them to take it, but flag as a Practice/Virtual attempt!
                    isPractice = true;
                    allocatedSeconds = contestData.durationMinutes * 60; // Give full time for practice
                } else {
                    // STRICT WINDOW: Cap their time to whatever is left before the official end
                    allocatedSeconds = Math.min(allocatedSeconds, timeUntilEndSeconds);
                }
            }

            attempt = {
                id: newAttemptId,
                contestId: actualContestId,
                uid,
                startedAt: serverTime,
                lastUpdated: serverTime,
                timeLeftSeconds: allocatedSeconds,
                isSubmitted: false,
                isPractice: isPractice,
                responses: {}
            };

            await setDoc(attemptRef, attempt);
        }

        // 3. Extract Questions from Contest Document
        // The questions are now embedded in the sections to ensure the test matches exactly what was generated.

        const allQuestions = contestData.sections.flatMap((s: Section) => s.questions);

        const sanitizedQuestions = allQuestions.map((q: Question) => {
            // CRITICAL: SANITIZE
            const {
                // @ts-ignore
                explanation_html, explanation_image_links,
                // @ts-ignore
                options, correctAnswerLabel, correctAnswerLabels,
                // @ts-ignore
                nat_answer_min, nat_answer_max, // Strictly, we shouldn't send these if client validation isn't trusted. 
                // But for a simple app usage, maybe keep NAT ranges for immediate feedback? 
                // GATE usually validates on server or post-submission. 
                // Let's hide them for security.
                ...safeRest
            } = q;

            // Sanitize options
            const safeOptions = q.options?.map((opt: any) => ({
                label: opt.label,
                text_html: opt.text_html,
                // Remove is_correct
            }));

            return {
                ...safeRest,
                options: safeOptions
            };
        });

        return NextResponse.json({
            attempt,
            contest: contestData,
            questions: sanitizedQuestions,
            serverTime
        });

    } catch (error: any) {
        console.error('Exam Start Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
