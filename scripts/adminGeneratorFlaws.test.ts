import * as assert from 'assert';

function testAdminGeneratorFlaws() {
    console.log("--- Admin & Generator Flaws ---");

    // 1. Contest Marks Calculation Bug
    console.log("\n1. Contest Total Marks Integrity:");
    // Simulated fill logic from generate/route.ts
    const target1 = 25;
    const target2 = 30;
    
    // Imagine we only have 20 1-mark tech questions and 35 2-mark tech questions
    const pool = [
        ...Array(20).fill({ id: '1', marks: 1 }), // Only 20 available (5 short)
        ...Array(35).fill({ id: '2', marks: 2 })  // 35 available (5 extra)
    ];

    const q1 = pool.filter(q => q.marks === 1); // 20
    const q2 = pool.filter(q => q.marks === 2); // 35
    
    const selected1 = q1.slice(0, target1); // takes 20
    const selected2 = q2.slice(0, target2); // takes 30
    
    const deficit1 = target1 - selected1.length; // 5
    const deficit2 = target2 - selected2.length; // 0
    const totalNeeded = deficit1 + deficit2; // 5

    // The code then fills the deficit with ANY remaining questions
    const usedIds = [...selected1, ...selected2];
    // Remaining pool has 5 2-mark questions left
    const remainingPool = [ ...Array(5).fill({ id: '3', marks: 2 }) ];
    const fill = remainingPool.slice(0, totalNeeded); // fills with 5 2-mark questions

    const finalSelection = [...selected1, ...selected2, ...fill];
    const actualMarks = finalSelection.reduce((sum, q) => sum + q.marks, 0);
    
    console.log(`Expected Tech Marks: ${25*1 + 30*2} (85)`);
    console.log(`Actual Tech Marks in Generated Contest: ${actualMarks}`);
    if (actualMarks !== 85) {
        console.log("-> BUG 1 CONFIRMED: The generator does not validate final marks if it falls back to filling deficits with remaining questions of wrong mark values. The total marks will be > 100 or < 100!");
    }

    // 2. Missing isRated Flag Bug
    console.log("\n2. Missing isRated Flag for Admin Contests:");
    const isAdminContest = true;
    const generatedContest = {
        type: isAdminContest ? 'admin' : 'mock',
        isPublic: true,
        // ... code from generate/route.ts ...
    };
    
    // In admin/page.tsx it checks:
    // c.type === 'admin' && c.isRated && !c.isRatingsProcessed
    // @ts-ignore
    const canProcessRatings = generatedContest.type === 'admin' && generatedContest.isRated;
    console.log(`Can admin process ratings? ${!!canProcessRatings}`);
    if (!canProcessRatings) {
        console.log("-> BUG 2 CONFIRMED: 'isRated' is never set to true during generation, so the 'Process Ratings' button will NEVER appear in the Admin Panel for newly generated contests!");
    }
}

testAdminGeneratorFlaws();
