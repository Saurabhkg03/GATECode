import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Contest, Question, Section } from '@/types/exam';
import { sampleQuestions } from '@/data/sampleQuestions';

const shuffle = <T,>(array: T[]) => array.sort(() => Math.random() - 0.5);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            branch,
            contestTitle,
            isPublic = false,
            enableSchedule = false,
            scheduledDateTime,
            endDateTime,
            isAdminContest = false,
            uid
        } = body;

        if (!branch || !uid || uid === 'anonymous') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        const sourceCollection = `questions_${branch}`;

        let qCol = adminDb.collection(sourceCollection);
        let qSnapshot = await qCol.get();

        if (qSnapshot.empty) {
            qCol = adminDb.collection(`${sourceCollection}/questions`);
            qSnapshot = await qCol.get();
        }

        const allQuestions: Question[] = [];
        qSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.question_html || data.title) {
                allQuestions.push({
                    id: docSnap.id,
                    ...data,
                    branch: data.branch || branch,
                    marks: Number(data.marks) || 1,
                    negative_marks: Number(data.negative_marks) || (Number(data.marks) === 2 ? 0.66 : 0.33)
                } as Question);
            }
        });

        const relevantSamples = sampleQuestions.filter(q => {
            const br = (q.branch || '').toLowerCase();
            return br === branch.toLowerCase() || br === 'general' || br === 'ga' || br === 'all';
        });

        const fetchedQuestionIds = new Set(allQuestions.map(q => q.id));
        let injectedCount = 0;

        relevantSamples.forEach(sample => {
            if (!fetchedQuestionIds.has(sample.id)) {
                allQuestions.push(sample as Question);
                fetchedQuestionIds.add(sample.id);
                injectedCount++;
            }
        });

        let messages: string[] = [];
        if (injectedCount > 0) {
            messages.push(`Injected ${injectedCount} sample questions.`);
        }

        const totalFound = allQuestions.length;
        messages.push(`Total Pool Size: ${totalFound} (Real + Sample).`);

        if (totalFound < 5) {
            return NextResponse.json({ error: `Insufficient questions even with samples. Found ${totalFound}, need at least 5.` }, { status: 400 });
        }

        const gaQuestions = allQuestions.filter(q => {
            const sub = (q.subject || '').toLowerCase();
            const br = (q.branch || '').toLowerCase();
            return sub.includes('aptitude') || sub.includes('verbal') || sub.includes('reasoning') || br === 'general' || br === 'ga';
        });

        const techQuestions = allQuestions.filter(q =>
            !gaQuestions.includes(q) &&
            (q.branch?.toLowerCase() === branch.toLowerCase() || q.branch === 'all' || !q.branch)
        );

        messages.push(`Pool Breakdown: GA=${gaQuestions.length}, Tech=${techQuestions.length}`);

        const selectQuestions = (pool: Question[], target1: number, target2: number) => {
            const q1 = shuffle(pool.filter(q => q.marks === 1));
            const q2 = shuffle(pool.filter(q => q.marks === 2));
            const selected1 = q1.slice(0, target1);
            const selected2 = q2.slice(0, target2);
            const usedIds = new Set([...selected1, ...selected2].map(q => q.id));
            const deficit1 = target1 - selected1.length;
            const deficit2 = target2 - selected2.length;
            const totalNeeded = deficit1 + deficit2;
            let fill: Question[] = [];
            if (totalNeeded > 0) {
                const remainingPool = shuffle(pool.filter(q => !usedIds.has(q.id)));
                fill = remainingPool.slice(0, totalNeeded);
            }
            return {
                selected: [...selected1, ...selected2, ...fill],
                totalFound: selected1.length + selected2.length + fill.length,
                totalTarget: target1 + target2
            };
        };

        const gaResult = selectQuestions(gaQuestions, 5, 5);
        const techResult = selectQuestions(techQuestions, 25, 30);

        const gaMissing = gaResult.totalTarget - gaResult.totalFound;
        const techMissing = techResult.totalTarget - techResult.totalFound;
        const totalMissing = gaMissing + techMissing;

        if (totalMissing > 0) {
            messages.push(`⚠️ Warning: Shortage of ${totalMissing} questions.\\nGA Found: ${gaResult.totalFound}/10, Tech Found: ${techResult.totalFound}/55`);
        } else {
            messages.push(`✅ Full exam generated.`);
        }

        const finalSections: Section[] = [
            { name: 'General Aptitude', questions: shuffle(gaResult.selected) },
            { name: 'Technical', questions: shuffle(techResult.selected) }
        ];

        const totalQs = finalSections[0].questions.length + finalSections[1].questions.length;
        
        const actualMarks = finalSections[0].questions.reduce((sum, q) => sum + Number(q.marks), 0) + 
                            finalSections[1].questions.reduce((sum, q) => sum + Number(q.marks), 0);
                            
        if (actualMarks !== 100) {
            return NextResponse.json({ 
                error: `Cannot generate a valid 100-mark exam. The generated exam contains ${actualMarks} marks. Ensure the database has enough 1-mark and 2-mark questions.` 
            }, { status: 400 });
        }
        const prefix = isAdminContest ? 'admin' : 'mock';
        const newContestId = `${Date.now()}-${prefix}-${branch}`;
        const defaultTitle = `GATE ${branch.toUpperCase()} ${isAdminContest ? 'Live Competition' : 'Mock Practice'} (Real)`;
        const title = contestTitle || defaultTitle;

        let startTimeISO: string | undefined = undefined;
        let endTimeISO: string | undefined = undefined;
        if (enableSchedule && scheduledDateTime) {
            startTimeISO = new Date(scheduledDateTime).toISOString();
        }
        if (enableSchedule && endDateTime) {
            endTimeISO = new Date(endDateTime).toISOString();
        }

        const newContest: Contest = {
            id: newContestId,
            title: title,
            type: isAdminContest ? 'admin' : 'mock',
            branch: branch,
            createdBy: uid || 'anonymous',
            isPublic: isAdminContest ? true : isPublic,
            ...(isAdminContest && { isRated: true }),
            durationMinutes: 180,
            totalMarks: 100,
            sections: finalSections,
            description: `Generated from '${sourceCollection}'. Contains ${totalQs} real questions.`,
            ...(startTimeISO && { startTime: startTimeISO }),
            ...(endTimeISO && { endTime: endTimeISO }),
        };

        await adminDb.collection('contests').doc(newContestId).set(newContest);

        return NextResponse.json({
            success: true,
            contestId: newContestId,
            title,
            totalQs,
            startTimeISO,
            endTimeISO,
            messages
        });

    } catch (error: any) {
        console.error('Error generating contest:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
