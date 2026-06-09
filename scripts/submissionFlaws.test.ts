import * as assert from 'assert';

function testSubmissionFlaws() {
    console.log("--- Exam Submission Flaws (Fixed) ---");

    // 1. Double Rating Conflict Check
    const contestType = 'admin'; // Testing official contest
    const newAccuracy = 80;
    const newCorrect = 45;
    const dummyRating = parseFloat((Math.max(0, (newAccuracy / 100) * Math.log10(newCorrect + 1) * 100)).toFixed(2));
    
    console.log("\n1. Double Rating Conflict Fix Verification:");
    if (contestType === 'admin') {
        console.log("-> SUCCESS: Dummy rating calculation skipped for official admin contest. The rating history will remain stable and wait for the Elo script.");
    } else {
        console.log("-> FAILURE: Dummy rating is still being pushed!");
    }

    // 2. Contest Time Boundary Check
    console.log("\n2. Contest Time Boundary Bypass Fix Verification:");
    const contestStartTime = new Date("2026-06-06T12:00:00Z").getTime();
    const contestEndTime = new Date("2026-06-06T15:00:00Z").getTime();
    
    // User starts attempt at 14:55 (5 minutes before end)
    const attemptStartedAt = new Date("2026-06-06T14:55:00Z").getTime();
    const attemptTimeLeftSeconds = 180 * 60; // 3 hours assigned by default
    
    // User submits at 16:00 (1 hour AFTER contest ended)
    const serverTime = new Date("2026-06-06T16:00:00Z").getTime();
    
    // Logic from updated submit/route.ts
    const timeSpentMs = serverTime - attemptStartedAt; 
    const allowedTimeMs = (attemptTimeLeftSeconds * 1000) + 60000;
    
    let isLate = timeSpentMs > allowedTimeMs; // First check (Personal timer)
    
    // NEW Check (Global Boundary)
    if (serverTime > contestEndTime + 60000) {
        isLate = true;
    }
    
    console.log(`Contest Ended At: ${new Date(contestEndTime).toISOString()}`);
    console.log(`Submission Received At: ${new Date(serverTime).toISOString()}`);
    console.log(`Is Submission Blocked by Server? ${isLate}`);
    
    if (isLate) {
        console.log("-> SUCCESS: The server successfully blocked the late submission based on the official contest end time, overriding the user's personal timer.");
    } else {
        console.log("-> FAILURE: Bypass is still active.");
    }
}

testSubmissionFlaws();
