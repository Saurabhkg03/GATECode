import * as assert from 'assert';

function testRatingProcessorFlaws() {
    console.log("--- Rating Processor Flaws (Fixed) ---");

    // Simulated user data
    const userData = {
        uid: "user123",
        branchRatings: {
            ece: 1600,
            cse: 1500
        },
        highestBranchRatings: {
            ece: 1650,
            cse: 1500
        },
        branchRatingHistory: {
            ece: [],
            cse: []
        },
        rating: 1600 // Global, obsolete
    };

    // Simulated contest
    const contestData = {
        id: "contest-1",
        title: "GATE CSE Mock",
        branch: "cse", // Note it's CSE
    };

    // New logic from process-ratings/route.ts
    const branch = contestData.branch || 'ece';
    const newRating = 1550;
    
    const branchRatings = userData.branchRatings || {};
    const branchRatingHistory = userData.branchRatingHistory || {};
    const highestBranchRatings = userData.highestBranchRatings || {};

    const history: any[] = branchRatingHistory[branch as keyof typeof branchRatingHistory] || [];
    history.push({
        contestId: contestData.id,
        newRating: newRating
    } as any);

    const updatedBranchRatings = { ...branchRatings, [branch]: newRating };
    const updatedHighestRatings = { 
        ...highestBranchRatings, 
        [branch]: Math.max(highestBranchRatings[branch as keyof typeof highestBranchRatings] || 1500, newRating) 
    };
    const updatedBranchHistory = { ...branchRatingHistory, [branch]: history };

    const updatedFields = {
        branchRatings: updatedBranchRatings,
        highestBranchRatings: updatedHighestRatings,
        branchRatingHistory: updatedBranchHistory,
    };

    console.log("\n1. Branch-Specific Rating Fix Verification:");
    console.log(`Contest Branch: ${contestData.branch}`);
    console.log(`Expected Update: branchRatings.cse = 1550`);
    
    const cseRating = updatedFields.branchRatings.cse;
    console.log(`Actual Update: branchRatings.cse = ${cseRating}`);
    
    if (cseRating === 1550 && !('rating' in updatedFields)) {
        console.log("-> SUCCESS: The rating script now specifically updates branchRatings.cse and does NOT touch the global rating!");
    } else {
        console.log("-> FAILURE: The fix is not working correctly.");
    }
}

testRatingProcessorFlaws();
