import * as assert from 'assert';

/**
 * SIMULATION 1: Offline Sync Data Loss
 * Testing the logic found in ExamContext.tsx lines 293:
 * restoredResponses = { ...localData, ...restoredResponses };
 */
function simulateOfflineSyncFlaw() {
    console.log("--- SIMULATION 1: Offline Sync Data Loss ---");
    
    // User answers Q1 online. It syncs to server.
    const serverResponses = {
        'q1': { questionId: 'q1', selectedOptions: ['A'], status: 'answered', markedAt: 1000 }
    };

    // User goes OFFLINE. They change Q1 to 'B'. It saves to localStorage.
    const localData = {
        'q1': { questionId: 'q1', selectedOptions: ['B'], status: 'answered', markedAt: 2000 }
    };

    // User refreshes the page while online again. ExamContext rehydrates:
    const restoredResponses = { ...localData, ...serverResponses };

    console.log("Local Data (Offline Progress):", localData['q1'].selectedOptions);
    console.log("Server Data (Stale):", serverResponses['q1'].selectedOptions);
    console.log("Merged Result in App:", restoredResponses['q1'].selectedOptions);

    if (restoredResponses['q1'].selectedOptions[0] === 'A') {
        console.log("-> FLAW CONFIRMED: The user's offline progress ('B') was overwritten by the stale server data ('A') because the spread operator `{ ...local, ...server }` prioritizes the server!");
    }
}

/**
 * SIMULATION 2: The "Ghost Exam" Zero-Score Bug
 * Testing the logic in app/api/exam/start/route.ts
 */
function simulateAutoSubmitFlaw() {
    console.log("\n--- SIMULATION 2: The Ghost Exam Zero-Score Bug ---");

    // User takes exam, answers questions, closes tab.
    const attemptDocInDb = {
        id: 'attempt_123',
        isSubmitted: false,
        responses: {
            'q1': { questionId: 'q1', selectedOptions: ['C'], isCorrect: true }, // Worth 2 marks
            'q2': { questionId: 'q2', selectedOptions: ['A'], isCorrect: true }  // Worth 2 marks
        },
        score: undefined // Server never calculated it
    };

    // Time expires. User opens the app the next day. start/route.ts detects it:
    const isExpired = true;
    
    if (isExpired) {
        // EXACT CODE FROM start/route.ts (lines 83-90)
        attemptDocInDb.isSubmitted = true;
        // Notice what is missing here?
        // attemptDocInDb.score = calculateScore(attemptDocInDb.responses);
    }

    console.log("Final Attempt Document saved to DB:", attemptDocInDb);
    
    if (attemptDocInDb.score === undefined) {
        console.log("-> FLAW CONFIRMED: The auto-submit logic marks the exam as submitted but NEVER evaluates the score! This student will have an invisible score and will break the global ranking system!");
    }
}

simulateOfflineSyncFlaw();
simulateAutoSubmitFlaw();
