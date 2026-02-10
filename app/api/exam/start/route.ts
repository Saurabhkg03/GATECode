import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { Contest, ContestAttempt, QuestionResponse, Section, Question } from '@/types/exam';

export async function POST(req: NextRequest) {
    try {
        const { contestId, uid } = await req.json();

        if (!contestId || !uid) {
            return NextResponse.json({ error: 'Missing contestId or uid' }, { status: 400 });
        }

        // 1. Fetch Contest Metadata
        const contestRef = doc(db, 'contests', contestId);
        const contestSnap = await getDoc(contestRef);

        if (!contestSnap.exists()) {
            return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
        }

        const contestData = contestSnap.data() as Contest;

        // 2. Check for Existing Unsubmitted Attempt (to Resume)
        const attemptsRef = collection(db, 'contest_attempts');
        const q = query(
            attemptsRef,
            where('contestId', '==', contestId),
            where('uid', '==', uid),
            where('isSubmitted', '==', false)
        );
        const querySnap = await getDocs(q);

        let attempt: ContestAttempt;
        let serverTime = Date.now();

        if (!querySnap.empty) {
            // Resume the most recent unsubmitted attempt
            const existingAttempts = querySnap.docs.map(doc => doc.data() as ContestAttempt);
            attempt = existingAttempts.sort((a, b) => b.startedAt - a.startedAt)[0];

            // Recalculate timeLeft based on server time
            const elapsedTime = (serverTime - attempt.startedAt) / 1000;
            const originalDurationSeconds = contestData.durationMinutes * 60;
            attempt.timeLeftSeconds = Math.max(0, originalDurationSeconds - elapsedTime);

        } else {
            // Create a brand new unique attempt
            const newAttemptId = `${contestId}_${uid}_${Math.random().toString(36).substring(2, 9)}`;
            const attemptRef = doc(db, 'contest_attempts', newAttemptId);

            attempt = {
                id: newAttemptId,
                contestId,
                uid,
                startedAt: serverTime,
                lastUpdated: serverTime,
                timeLeftSeconds: contestData.durationMinutes * 60,
                isSubmitted: false,
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
