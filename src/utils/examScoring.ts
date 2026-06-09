/**
 * Centralized Exam Scoring Engine
 * Enforces strict GATE evaluation rules for MCQ, MSQ, and NAT.
 */

export function evaluateExam(contestData: any, responses: any) {
    let totalScore = 0;
    let correctCount = 0;
    let totalAttempted = 0;

    const questionMap = new Map();

    if (contestData?.sections) {
        contestData.sections.forEach((sec: any) => {
            sec.questions.forEach((q: any) => {
                let negMarks = parseFloat(q.negative_marks);
                if (isNaN(negMarks)) {
                    negMarks = q.question_type === 'mcq' ? parseFloat(q.marks || '0') / 3 : 0;
                }

                questionMap.set(q.id, {
                    type: q.question_type,
                    options: q.options,
                    natMin: parseFloat(q.nat_answer_min),
                    natMax: parseFloat(q.nat_answer_max),
                    marks: parseFloat(q.marks || '0'),
                    negativeMarks: negMarks
                });
            });
        });
    }

    // Trust the server, not the client
    Object.values(responses || {}).forEach((resp: any) => {
        const qData = questionMap.get(resp.questionId);
        if (qData) {
            let isCorrect = false;
            let marksAwarded = 0;
            const isAttempted = resp.status === 'answered' || resp.status === 'answered_marked_for_review';
            
            if (isAttempted) {
                totalAttempted++;
                if (qData.type === 'mcq') {
                    const correctOption = qData.options?.find((o: any) => o.is_correct);
                    isCorrect = !!(correctOption && resp.selectedOptions?.[0] === correctOption.label);
                    marksAwarded = isCorrect ? qData.marks : -Math.abs(qData.negativeMarks);
                } else if (qData.type === 'msq') {
                    const correctLabels = qData.options?.filter((o: any) => o.is_correct).map((o: any) => o.label).sort();
                    const userVal = [...(resp.selectedOptions || [])].sort();
                    isCorrect = !!(correctLabels && userVal && correctLabels.length === userVal.length &&
                        correctLabels.every((val: string, index: number) => val === userVal[index]));
                    marksAwarded = isCorrect ? qData.marks : 0; // No negative marks for MSQ
                } else if (qData.type === 'nat') {
                    const val = parseFloat(resp.natAnswer || '');
                    if (!isNaN(val) && !isNaN(qData.natMin) && !isNaN(qData.natMax) && val >= qData.natMin && val <= qData.natMax) {
                        isCorrect = true;
                        marksAwarded = qData.marks;
                    } else {
                        marksAwarded = 0; // No negative marks for NAT
                    }
                }

                if (isCorrect) correctCount++;
                totalScore += marksAwarded;
            }

            resp.isCorrect = isCorrect;
            resp.marksAwarded = marksAwarded;
        } else {
            resp.isCorrect = false;
            resp.marksAwarded = 0;
        }
    });

    return {
        responses, // Mutated with isCorrect and marksAwarded
        totalScore: parseFloat(totalScore.toFixed(2)),
        correctCount,
        totalAttempted
    };
}
