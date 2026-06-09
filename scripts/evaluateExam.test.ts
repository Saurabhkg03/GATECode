import * as assert from 'assert';

/**
 * MOCK EVALUATOR to test our GATE rules before implementing them in the API.
 * This simulates what `/api/exam/submit/route.ts` SHOULD do.
 */
function evaluateExam(contestQuestions: any[], responses: Record<string, any>) {
    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let totalAttempted = 0;

    const evaluatedResponses: Record<string, any> = {};

    contestQuestions.forEach((q) => {
        const resp = responses[q.id];
        let isAttempted = false;
        let isCorrect = false;
        let marksAwarded = 0;

        if (resp && (resp.status === 'answered' || resp.status === 'answered_marked_for_review')) {
            isAttempted = true;
            totalAttempted++;

            if (q.type === 'mcq') {
                const correctOption = q.options.find((o: any) => o.is_correct);
                if (correctOption && resp.selectedOptions?.[0] === correctOption.label) {
                    isCorrect = true;
                    marksAwarded = q.marks;
                } else {
                    isCorrect = false;
                    marksAwarded = -(q.negative_marks || 0);
                }
            } else if (q.type === 'msq') {
                const correctLabels = q.options.filter((o: any) => o.is_correct).map((o: any) => o.label).sort();
                const userVal = [...(resp.selectedOptions || [])].sort();
                
                if (correctLabels.length === userVal.length && correctLabels.every((val: string, i: number) => val === userVal[i])) {
                    isCorrect = true;
                    marksAwarded = q.marks;
                } else {
                    isCorrect = false;
                    marksAwarded = 0; // MSQ has no negative marks
                }
            } else if (q.type === 'nat') {
                const val = parseFloat(resp.natAnswer || '');
                if (!isNaN(val) && val >= q.natMin && val <= q.natMax) {
                    isCorrect = true;
                    marksAwarded = q.marks;
                } else {
                    isCorrect = false;
                    marksAwarded = 0; // NAT has no negative marks
                }
            }

            if (isCorrect) correctCount++;
            else incorrectCount++;
            
            totalScore += marksAwarded;
        }

        evaluatedResponses[q.id] = {
            ...resp,
            isCorrect,
            marksAwarded
        };
    });

    // Ensure score doesn't drop below a certain threshold if needed, but GATE allows negative total scores.
    return { totalScore, correctCount, incorrectCount, totalAttempted, evaluatedResponses };
}

// --- TEST SUITE ---

const mockQuestions = [
    { id: 'q1', type: 'mcq', marks: 2, negative_marks: 0.66, options: [{ label: 'A', is_correct: true }, { label: 'B', is_correct: false }] },
    { id: 'q2', type: 'mcq', marks: 1, negative_marks: 0.33, options: [{ label: 'C', is_correct: false }, { label: 'D', is_correct: true }] },
    { id: 'q3', type: 'msq', marks: 2, negative_marks: 0, options: [{ label: 'A', is_correct: true }, { label: 'B', is_correct: true }, { label: 'C', is_correct: false }] },
    { id: 'q4', type: 'nat', marks: 2, negative_marks: 0, natMin: 4.5, natMax: 4.7 },
    { id: 'q5', type: 'mcq', marks: 1, negative_marks: 0.33, options: [{ label: 'A', is_correct: true }] } // Marked for review (no answer)
];

console.log("Running GATE Evaluation Tests...");

// Test 1: Correct MCQ
const r1 = evaluateExam(mockQuestions, {
    'q1': { status: 'answered', selectedOptions: ['A'] }
});
assert.strictEqual(r1.totalScore, 2, "Test 1 Failed: Correct MCQ should award 2 marks");

// Test 2: Incorrect MCQ (Negative Marking)
const r2 = evaluateExam(mockQuestions, {
    'q2': { status: 'answered', selectedOptions: ['C'] }
});
assert.strictEqual(r2.totalScore, -0.33, "Test 2 Failed: Incorrect MCQ should apply negative marks");

// Test 3: Correct MSQ
const r3 = evaluateExam(mockQuestions, {
    'q3': { status: 'answered', selectedOptions: ['B', 'A'] } // Order shouldn't matter
});
assert.strictEqual(r3.totalScore, 2, "Test 3 Failed: Correct MSQ should award marks");

// Test 4: Partially Correct MSQ (0 marks, no negative)
const r4 = evaluateExam(mockQuestions, {
    'q3': { status: 'answered', selectedOptions: ['A'] }
});
assert.strictEqual(r4.totalScore, 0, "Test 4 Failed: Partial MSQ should award 0 marks");

// Test 5: Correct NAT
const r5 = evaluateExam(mockQuestions, {
    'q4': { status: 'answered_marked_for_review', natAnswer: '4.6' }
});
assert.strictEqual(r5.totalScore, 2, "Test 5 Failed: Correct NAT should award marks even if marked for review");

// Test 6: Incorrect NAT (0 marks, no negative)
const r6 = evaluateExam(mockQuestions, {
    'q4': { status: 'answered', natAnswer: '5.0' }
});
assert.strictEqual(r6.totalScore, 0, "Test 6 Failed: Incorrect NAT should award 0 marks, not negative");

// Test 7: Marked for review without answer
const r7 = evaluateExam(mockQuestions, {
    'q5': { status: 'marked_for_review', selectedOptions: [] }
});
assert.strictEqual(r7.totalScore, 0, "Test 7 Failed: Marked for review without answer should award 0 marks");

console.log("All tests passed successfully! The logic is sound.");
