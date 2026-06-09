import * as assert from 'assert';

function testLeaderboardPaginationFlaw() {
    console.log("--- Leaderboard Pagination Flaws ---");

    // 1. Reversing limitToLast results bug
    // Mocking Firestore limitToLast behavior. It returns results in the original query order.
    // E.g., if we are on page 2 (ranks 11-20), and we click Prev, we fetch ranks 1-10.
    // They will be returned as [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const mockPrevPageResponse = [
        { rank: 1, name: "Alice" },
        { rank: 2, name: "Bob" },
        { rank: 3, name: "Charlie" }
    ];

    const direction = 'prev';
    const usersData = mockPrevPageResponse;

    // This is what the code does:
    const leaderboardState = direction === 'prev' ? [...usersData].reverse() : usersData;

    console.log("Expected top user (Rank 1):", mockPrevPageResponse[0]);
    console.log("Actual top user displayed after clicking Prev:", leaderboardState[0]);

    if (leaderboardState[0].rank === 3) {
        console.log("-> BUG 1 CONFIRMED: Clicking 'Previous' reverses the array and shows the lowest ranking user at the top of the page!");
    }

    // 2. Count mismatch bug
    const totalUsersInDatabase = 10000;
    const usersWithBranchRating = 50;

    // The code does:
    // const countSnapshot = await getCountFromServer(query(usersCollection));
    // setTotalUsers(countSnapshot.data().count);
    const totalUsersState = totalUsersInDatabase;

    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(totalUsersState / PAGE_SIZE));

    console.log("\nActual users with ratings:", usersWithBranchRating);
    console.log("Total pages displayed in UI:", totalPages);
    
    if (totalPages === 1000) {
        console.log("-> BUG 2 CONFIRMED: The total pages calculation is based on ALL users in the database, not just those with a rating for the selected branch. The pagination UI will be completely broken (e.g., showing Page 1 of 1000 when there are only 5 pages of actual data).");
    }
}

testLeaderboardPaginationFlaw();
