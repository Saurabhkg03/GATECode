import { NextRequest, NextResponse } from 'next/server';

import { Contest, ContestAttempt, QuestionResponse, Section, Question } from '@/types/exam';
import { evaluateExam } from '@/utils/examScoring';
import { initAdmin } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { examStartLimiter } from '@/lib/rateLimit';

const startSchema = z.object({
  contestId: z.string().min(1, "contestId is required"),
  uid: z.string().min(1, "uid is required"),
  forceFresh: z.boolean().optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = startSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Bad Request', details: parsed.error.format() }, { status: 400 });
        }

        const { contestId, uid, forceFresh } = parsed.data;

        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const token = authHeader.split('Bearer ')[1];
        const app = await initAdmin();
        if (!app) {
             return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const decodedToken = await app.auth().verifyIdToken(token);

        if (decodedToken.uid !== uid) {
            return NextResponse.json({ error: 'Forbidden: UID mismatch' }, { status: 403 });
        }

        const { success } = await examStartLimiter.limit(uid);
        if (!success) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }


        const db = app.firestore();

        // 1. Fetch Contest Metadata
        let actualContestId = contestId;
        let contestRef = db.collection('contests').doc(contestId);
        let contestSnap = await contestRef.get();

        if (!contestSnap.exists) {
            // Try resolving generic scheduled contest ID (e.g., weekly-15) to a branch-specific contest
            if (contestId.startsWith('weekly-') || contestId.startsWith('biweekly-')) {
                const userRef = db.collection('users').doc(uid);
                const userSnap = await userRef.get();
                const userBranch = userSnap.exists ? (userSnap.data()?.branch || 'ece').toLowerCase() : 'ece';
                
                actualContestId = `${contestId}-${userBranch}`;
                contestRef = db.collection('contests').doc(actualContestId);
                contestSnap = await contestRef.get();
            }
        }

        if (!contestSnap.exists) {
            return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
        }

        const contestData = contestSnap.data() as Contest;
        let attempt: ContestAttempt | undefined = undefined;
        let serverTime = Date.now();
        const DEDUP_WINDOW_MS = 10_000;

        await db.runTransaction(async (t: any) => {
            const attemptsQuery = db.collection('contest_attempts')
                .where('contestId', '==', actualContestId)
                .where('uid', '==', uid)
                .where('isSubmitted', '==', false);
                
            const querySnap = await t.get(attemptsQuery);

            if (!querySnap.empty) {
                // Resume the most recent unsubmitted attempt
                const existingAttempts = querySnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ContestAttempt));
                existingAttempts.sort((a: any, b: any) => b.startedAt - a.startedAt);

                let foundResumable = false;

                for (const att of existingAttempts) {
                    const elapsedTime = (serverTime - att.startedAt) / 1000;
                    let attemptAllocatedSeconds = contestData.durationMinutes * 60;
                    let isAttemptPractice = att.isPractice || false;

                    if (contestData.endTime) {
                        const endMs = new Date(contestData.endTime).getTime();
                        const timeUntilEndSeconds = Math.floor((endMs - att.startedAt) / 1000);

                        if (timeUntilEndSeconds <= 0) {
                            isAttemptPractice = true;
                            attemptAllocatedSeconds = contestData.durationMinutes * 60;
                        } else if (!isAttemptPractice) {
                            attemptAllocatedSeconds = Math.min(attemptAllocatedSeconds, timeUntilEndSeconds);
                        }
                    }

                    const isExpired = elapsedTime >= attemptAllocatedSeconds;
                    const isVeryRecent = (serverTime - att.startedAt) < DEDUP_WINDOW_MS;
                    const attRef = db.collection('contest_attempts').doc(att.id);

                    if (forceFresh && !isVeryRecent) {
                        const result = evaluateExam(contestData, att.responses);
                        t.update(attRef, {
                            isSubmitted: true,
                            timeLeftSeconds: 0,
                            score: result.totalScore,
                            responses: result.responses,
                            lastUpdated: serverTime
                        });
                    } else if (isExpired && !isVeryRecent) {
                        const result = evaluateExam(contestData, att.responses);
                        t.update(attRef, {
                            isSubmitted: true,
                            timeLeftSeconds: 0,
                            score: result.totalScore,
                            responses: result.responses,
                            lastUpdated: serverTime
                        });
                    } else if (!foundResumable && !isExpired) {
                        attempt = att;
                        attempt!.timeLeftSeconds = Math.max(0, attemptAllocatedSeconds - elapsedTime);
                        if (isAttemptPractice !== att.isPractice) {
                            attempt!.isPractice = isAttemptPractice;
                            t.update(attRef, { isPractice: isAttemptPractice });
                        }
                        foundResumable = true;
                    }
                }
            }

            if (!attempt) {
                const newAttemptId = `${actualContestId}_${uid}_${serverTime}_${Math.random().toString(36).substring(2, 6)}`;
                const attemptRef = db.collection('contest_attempts').doc(newAttemptId);

                let allocatedSeconds = contestData.durationMinutes * 60;
                let isPractice = false;

                if (contestData.endTime) {
                    const endMs = new Date(contestData.endTime).getTime();
                    const timeUntilEndSeconds = Math.floor((endMs - serverTime) / 1000);

                    if (timeUntilEndSeconds <= 0) {
                        isPractice = true;
                        allocatedSeconds = contestData.durationMinutes * 60;
                    } else {
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

                t.set(attemptRef, attempt);
            }
        });

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
