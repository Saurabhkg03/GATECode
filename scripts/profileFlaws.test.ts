import * as assert from 'assert';

function testProfileFlaws() {
    console.log("--- Profile Page Flaws ---");

    // 1. Rating History Branch Mix-Up Bug
    const mockUser = {
        ratingHistory: [
            { contestId: 'c1', branch: 'Computer Science', newRating: 1550, date: 1000 },
            { contestId: 'c2', branch: 'Mechanical', newRating: 1200, date: 2000 },
            { contestId: 'c3', branch: 'Computer Science', newRating: 1600, date: 3000 }
        ]
    };
    const selectedBranch = 'Computer Science';

    // The code currently does:
    const displayRatingHistory = mockUser.ratingHistory || [];
    
    console.log("Expected Rating History (CS only):", mockUser.ratingHistory.filter(h => h.branch === 'Computer Science').map(h => h.newRating));
    console.log("Actual Rating History Displayed:", displayRatingHistory.map(h => h.newRating));

    if (displayRatingHistory.some(h => h.branch !== selectedBranch)) {
        console.log("-> BUG 1 CONFIRMED: Rating history mixes all branches! A user taking an exam in a different branch will cause a massive artificial spike or drop in their graph because it plots sequentially without filtering.");
    }

    // 2. Highest Rating Branch Mix-Up Bug
    const mockHighestRatingGlobal: number = 1800; // From an old global system or a different branch
    
    // The code does:
    const displayHighestRating = mockHighestRatingGlobal || 1500;
    
    console.log("\nActual CS Highest Rating: 1600");
    console.log("Displayed Highest Rating:", displayHighestRating);
    if (displayHighestRating !== 1600) {
        console.log("-> BUG 2 CONFIRMED: Highest rating is global and not tracked per-branch.");
    }
}

testProfileFlaws();
