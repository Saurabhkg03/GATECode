import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Contest, Question, Section } from '@/types/exam';
import { sampleQuestions } from '@/data/sampleQuestions';
import { apiError, apiSuccess } from '@/lib/apiResponse';

const shuffle = <T,>(array: T[]) => array.sort(() => Math.random() - 0.5);

const branchBlueprints: Record<string, Record<string, number>> = {
  cse: {
    'Engineering Mathematics': 10,
    'Discrete Mathematics': 5,
    'Digital Logic': 5,
    'Computer Organization': 8,
    'C Programming': 5,
    'Data Structure': 6,
    'Algorithm': 7,
    'Operating System': 8,
    'Database Management System': 7,
    'Computer Network': 7,
    'Theory of Computation': 7,
    'Compiler Design': 4,
  },
  ece: {
    'Engineering Mathematics': 10,
    'Communication Systems': 10,
    'Digital Circuits': 9,
    'Analog Circuits': 10,
    'Signals and Systems': 9,
    'Electromagnetics': 8,
    'Network Theory': 8,
    'Control Systems': 8,
    'Electronic Devices': 8,
    'Microprocessors': 5,
  },
  me: {
    'Engineering Mathematics': 10,
    'Manufacturing Engineering': 12,
    'Thermodynamics': 10,
    'Fluid Mechanics': 8,
    'Heat Transfer': 7,
    'Theory of Machine': 7,
    'Strength of Materials': 7,
    'Machine Design': 5,
    'Industrial Engineering': 5,
    'Engineering Mechanics': 5,
    'Refrigeration and Air-conditioning': 3,
  },
  ee: {
    'Engineering Mathematics': 10,
    'Electrical Machines': 10,
    'Power Systems': 10,
    'Control Systems': 9,
    'Power Electronics': 9,
    'Signals and Systems': 8,
    'Electric Circuits': 8,
    'Analog & Digital Electronics': 6,
    'Electromagnetic Fields': 5,
  },
  in: {
    'Engineering Mathematics': 10,
    'Control Systems': 12,
    'Electrical Circuits and Machines': 10,
    'Measurements': 9,
    'Analog Electronics': 8,
    'Digital Electronics': 8,
    'Signals and Systems': 7,
    'Sensors and Industrial Instrumentation': 7,
    'Communication and Optical Instrumentation': 5,
  }
};

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
            uid,
            difficulty = 'Medium',
            durationMinutes = 180,
            description,
            prizes,
            isRated = false,
            examMode = 'full',
            targetSubjects = [],
            target1MarkCount = 10,
            target2MarkCount = 5,
        } = body;

        if (!branch || !uid || uid === 'anonymous') {
            return apiError('Authentication required', 'UNAUTHORIZED', 401);
        }

        if (!adminDb) {
            return apiError('Firebase Admin not initialized', 'SERVER_ERROR', 500);
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
            return apiError(`Insufficient questions even with samples. Found ${totalFound}, need at least 5.`, 'BAD_REQUEST', 400);
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

        const selectQuestionsRandomly = (pool: Question[], target1: number, target2: number) => {
            const totalNeeded = target1 + target2;
            const shuffledPool = shuffle([...pool]);
            const selectedRaw = shuffledPool.slice(0, totalNeeded);
            
            const selected = selectedRaw.map((q, index) => {
                const isOneMark = index < target1;
                const assignedMarks = isOneMark ? 1 : 2;
                
                let negMarks = 0;
                const qType = (q.question_type || 'mcq').toLowerCase();
                
                if (qType === 'mcq') {
                    negMarks = isOneMark ? 0.33 : 0.66;
                } else if (qType === 'msq' || qType === 'nat') {
                    negMarks = 0;
                } else {
                    negMarks = isOneMark ? 0.33 : 0.66;
                }

                return { 
                    ...q, 
                    marks: assignedMarks, 
                    negative_marks: negMarks 
                };
            });

            return {
                selected,
                totalFound: selected.length,
                totalTarget: totalNeeded
            };
        };

        const selectStratifiedQuestions = (pool: Question[], target1: number, target2: number, targetBranch: string) => {
            const blueprint = branchBlueprints[targetBranch.toLowerCase()] || {};
            
            // Group pool by subject
            const subjectMap: Record<string, Question[]> = {};
            pool.forEach(q => {
                const sub = (q.subject || 'General').trim();
                if (!subjectMap[sub]) subjectMap[sub] = [];
                subjectMap[sub].push(q);
            });
            
            const availableSubjects = Object.keys(subjectMap);
            
            // Assign weights with variance
            const weights = availableSubjects.map(sub => {
                let w = blueprint[sub];
                if (w === undefined) {
                    const found = Object.keys(blueprint).find(k => k.toLowerCase() === sub.toLowerCase());
                    w = found ? blueprint[found] : 2; 
                }
                const variance = 0.8 + Math.random() * 0.4; // Variance: multiply weight by factor between 0.8 and 1.2
                return { subject: sub, weight: w * variance };
            });
            
            const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
            
            let targets1: Record<string, number> = {};
            let targets2: Record<string, number> = {};
            
            let current1 = 0;
            let current2 = 0;
            
            // Proportional allocation
            if (totalWeight > 0) {
                weights.forEach(w => {
                    const count1 = Math.round(target1 * (w.weight / totalWeight));
                    const count2 = Math.round(target2 * (w.weight / totalWeight));
                    targets1[w.subject] = count1;
                    targets2[w.subject] = count2;
                    current1 += count1;
                    current2 += count2;
                });
            }
            
            // Fix rounding errors for 1-mark
            while (current1 !== target1 && weights.length > 0) {
                const w = weights[Math.floor(Math.random() * weights.length)];
                if (current1 < target1) {
                    targets1[w.subject]++;
                    current1++;
                } else if (targets1[w.subject] > 0) {
                    targets1[w.subject]--;
                    current1--;
                }
            }
            
            // Fix rounding errors for 2-mark
            while (current2 !== target2 && weights.length > 0) {
                const w = weights[Math.floor(Math.random() * weights.length)];
                if (current2 < target2) {
                    targets2[w.subject]++;
                    current2++;
                } else if (targets2[w.subject] > 0) {
                    targets2[w.subject]--;
                    current2--;
                }
            }
            
            let shortfall1 = 0;
            let shortfall2 = 0;
            
            availableSubjects.forEach(sub => {
                const needed1 = targets1[sub] || 0;
                const needed2 = targets2[sub] || 0;
                const neededTotal = needed1 + needed2;
                const available = subjectMap[sub].length;
                
                let takenTotal = Math.min(neededTotal, available);
                if (takenTotal < neededTotal) {
                    const ratio1 = neededTotal > 0 ? (needed1 / neededTotal) : 0;
                    const taken1 = Math.round(takenTotal * ratio1);
                    const taken2 = takenTotal - taken1;
                    
                    shortfall1 += (needed1 - taken1);
                    shortfall2 += (needed2 - taken2);
                    
                    targets1[sub] = taken1;
                    targets2[sub] = taken2;
                }
            });
            
            // Re-distribute shortfalls to subjects with spare questions
            if (shortfall1 > 0 || shortfall2 > 0) {
                availableSubjects.forEach(sub => {
                    const takenTotal = targets1[sub] + targets2[sub];
                    let spare = subjectMap[sub].length - takenTotal;
                    
                    while (spare > 0 && (shortfall1 > 0 || shortfall2 > 0)) {
                        if (shortfall1 > 0) {
                            targets1[sub]++;
                            shortfall1--;
                            spare--;
                        } else if (shortfall2 > 0) {
                            targets2[sub]++;
                            shortfall2--;
                            spare--;
                        }
                    }
                });
            }
            
            const selected: Question[] = [];
            availableSubjects.forEach(sub => {
                const qPool = shuffle([...subjectMap[sub]]);
                const take1 = targets1[sub] || 0;
                const take2 = targets2[sub] || 0;
                
                for (let i = 0; i < take1; i++) {
                    if (qPool.length === 0) break;
                    const q = qPool.pop()!;
                    const qType = (q.question_type || 'mcq').toLowerCase();
                    selected.push({ ...q, marks: 1, negative_marks: (qType === 'mcq') ? 0.33 : 0 });
                }
                
                for (let i = 0; i < take2; i++) {
                    if (qPool.length === 0) break;
                    const q = qPool.pop()!;
                    const qType = (q.question_type || 'mcq').toLowerCase();
                    selected.push({ ...q, marks: 2, negative_marks: (qType === 'mcq') ? 0.66 : 0 });
                }
            });
            
            return {
                selected: shuffle(selected),
                totalFound: selected.length,
                totalTarget: target1 + target2
            };
        };

        let finalSections: Section[] = [];
        let actualMarks = 0;
        let totalQs = 0;

        if (examMode === 'custom') {
            const customPool = allQuestions.filter(q => {
                const sub = (q.subject || 'General').trim();
                return targetSubjects.includes(sub);
            });
            
            messages.push(`Custom Pool Size: ${customPool.length} questions matching [${targetSubjects.join(', ')}].`);
            
            const customResult = selectQuestionsRandomly(customPool, target1MarkCount, target2MarkCount);
            
            const missing = customResult.totalTarget - customResult.totalFound;
            if (missing > 0) {
                messages.push(`⚠️ Warning: Shortage of ${missing} questions. Found: ${customResult.totalFound}/${customResult.totalTarget}`);
            } else {
                messages.push(`✅ Custom exam generated with ${customResult.totalFound} questions.`);
            }

            finalSections = [
                { 
                    name: targetSubjects.length <= 3 ? targetSubjects.join(' & ') : 'Custom Subjects', 
                    questions: customResult.selected 
                }
            ];
            
            actualMarks = customResult.selected.reduce((sum, q) => sum + Number(q.marks), 0);
            totalQs = customResult.selected.length;

        } else {
            const gaResult = selectQuestionsRandomly(gaQuestions, 5, 5);
            const techResult = selectStratifiedQuestions(techQuestions, 25, 30, branch);

            const gaMissing = gaResult.totalTarget - gaResult.totalFound;
            const techMissing = techResult.totalTarget - techResult.totalFound;
            const totalMissing = gaMissing + techMissing;

            if (totalMissing > 0) {
                messages.push(`⚠️ Warning: Shortage of ${totalMissing} questions.\\nGA Found: ${gaResult.totalFound}/10, Tech Found: ${techResult.totalFound}/55`);
            } else {
                messages.push(`✅ Full exam generated.`);
            }

            finalSections = [
                { name: 'General Aptitude', questions: shuffle(gaResult.selected) },
                { name: 'Technical', questions: shuffle(techResult.selected) }
            ];

            totalQs = finalSections[0].questions.length + finalSections[1].questions.length;
            
            actualMarks = finalSections[0].questions.reduce((sum, q) => sum + Number(q.marks), 0) + 
                                finalSections[1].questions.reduce((sum, q) => sum + Number(q.marks), 0);
                                
            if (actualMarks !== 100) {
                messages.push(`⚠️ Warning: Cannot generate a valid 100-mark exam. The generated exam contains ${actualMarks} marks.`);
            }
        }

        const prefix = isAdminContest ? 'admin' : 'mock';
        const newContestId = `${Date.now()}-${prefix}-${branch}`;
        
        let defaultTitle = `GATE ${branch.toUpperCase()} ${isAdminContest ? 'Live Competition' : 'Practice Contest'} (Real)`;
        if (examMode === 'custom') {
            defaultTitle = `${branch.toUpperCase()} Custom Test: ${targetSubjects.length <= 2 ? targetSubjects.join(' & ') : targetSubjects.length + ' Subjects'}`;
        }
        
        const title = contestTitle || defaultTitle;

        const isWeeklyOrBiweekly = title.toLowerCase().includes('weekly') || title.toLowerCase().includes('biweekly');
        const finalDuration = isWeeklyOrBiweekly ? 180 : durationMinutes;

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
            isRated: isAdminContest ? isRated : false,
            difficulty,
            durationMinutes: finalDuration,
            totalMarks: actualMarks,
            sections: finalSections,
            description: description || `Generated from '${sourceCollection}'. Contains ${totalQs} real questions.`,
            examMode,
            targetSubjects,
            ...(prizes && { prizes }),
            ...(startTimeISO && { startTime: startTimeISO }),
            ...(endTimeISO && { endTime: endTimeISO }),
        };

        await adminDb.collection('contests').doc(newContestId).set(newContest);

        return apiSuccess({
            contestId: newContestId,
            title,
            totalQs,
            startTimeISO,
            endTimeISO,
            messages
        });

    } catch (error: any) {
        console.error('Error generating contest:', error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
