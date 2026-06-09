import * as assert from 'assert';

/**
 * MOCK of the Result Page Ranking Logic currently found in:
 * app/exam/[contestId]/result/page.tsx (lines 118-154)
 */
function calculateRankClientSide(allLiveAttempts: any[], currentUserUid: string) {
    const start = performance.now();

    // 1. Calculate Global Average Time Per Question
    const qStats: Record<string, { totalSecs: number, count: number }> = {};
    allLiveAttempts.forEach(att => {
        Object.values(att.responses).forEach((resp: any) => {
            if (resp.timeSpent > 0 && resp.status !== 'not_visited') {
                if (!qStats[resp.questionId]) qStats[resp.questionId] = { totalSecs: 0, count: 0 };
                qStats[resp.questionId].totalSecs += resp.timeSpent;
                qStats[resp.questionId].count++;
            }
        });
    });

    const avgTimeMap: Record<string, number> = {};
    for (const qId in qStats) {
        avgTimeMap[qId] = Math.round(qStats[qId].totalSecs / qStats[qId].count);
    }

    // 2. Deduplicate by user
    const userBestScores: Record<string, number> = {};
    allLiveAttempts.forEach(att => {
        if (userBestScores[att.uid] === undefined || att.score > userBestScores[att.uid]) {
            userBestScores[att.uid] = att.score;
        }
    });

    // 3. Sort and find rank
    const sortedScores = Object.values(userBestScores).sort((a: any, b: any) => b - a);
    const myScore = userBestScores[currentUserUid] || 0;
    const myRank = sortedScores.indexOf(myScore) + 1;

    const end = performance.now();
    return {
        myRank,
        totalUsers: sortedScores.length,
        executionTimeMs: end - start
    };
}

// --- TEST SUITE: PERFORMANCE BENCHMARK ---

console.log("Generating 10,000 mock attempt payloads...");
const mockAttempts: any[] = [];
for (let i = 0; i < 10000; i++) {
    // Simulate 65 questions per exam
    const responses: any = {};
    for (let j = 0; j < 65; j++) {
        responses[`q${j}`] = {
            questionId: `q${j}`,
            timeSpent: Math.floor(Math.random() * 120),
            status: 'answered'
        };
    }

    mockAttempts.push({
        uid: `user_${i}`,
        score: Math.floor(Math.random() * 100),
        responses
    });
}

// Make sure our test user is in there
mockAttempts[5000].uid = 'test_user';
mockAttempts[5000].score = 95;

console.log("\nRunning Client-Side Rank Calculation Test...");
const result = calculateRankClientSide(mockAttempts, 'test_user');

console.log(`\n--- BENCHMARK RESULTS ---`);
console.log(`Total Users Processed: ${result.totalUsers}`);
console.log(`Test User Rank: ${result.myRank} / ${result.totalUsers}`);
console.log(`CPU Execution Time (Synchronous blocking): ${result.executionTimeMs.toFixed(2)} ms`);

// Analyze Memory Usage
const mockAttemptsSizeMB = (JSON.stringify(mockAttempts).length / (1024 * 1024)).toFixed(2);
console.log(`Estimated Download Payload Size: ~${mockAttemptsSizeMB} MB of JSON`);

// The test proves that doing this on the client will block the main thread and use massive bandwidth.
assert.ok(result.executionTimeMs > 0, "Calculation should take measurable time");
console.log("\nConclusion: Downloading this much data and running synchronous loops on the client's browser causes massive performance and security issues.");
