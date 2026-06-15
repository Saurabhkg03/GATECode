import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { apiError, apiSuccess } from '@/lib/apiResponse';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const contestId = searchParams.get('contestId');
        const scoreParam = searchParams.get('score');

        if (!contestId || scoreParam === null) {
            return apiError('Missing contestId or score', 'BAD_REQUEST', 400);
        }

        const score = parseFloat(scoreParam);
        if (isNaN(score)) {
            return apiError('Invalid score', 'BAD_REQUEST', 400);
        }

        const attemptsRef = collection(db, 'contest_attempts');

        // Query 1: Get Total Users who submitted the exam (excluding practice)
        const totalQuery = query(
            attemptsRef,
            where('contestId', '==', contestId),
            where('isSubmitted', '==', true),
            where('isPractice', '==', false)
        );

        // Query 2: Get Users who scored STRICTLY higher than the current user
        // Ranking rule: Rank = (Number of users with score > myScore) + 1
        const higherScorersQuery = query(
            attemptsRef,
            where('contestId', '==', contestId),
            where('isSubmitted', '==', true),
            where('isPractice', '==', false),
            where('score', '>', score)
        );

        // Execute aggregation queries securely and efficiently
        const [totalSnap, higherScorersSnap] = await Promise.all([
            getCountFromServer(totalQuery),
            getCountFromServer(higherScorersQuery)
        ]);

        const totalUsers = totalSnap.data().count;
        const rank = higherScorersSnap.data().count + 1; // +1 because if 0 people are higher, you are rank 1

        return apiSuccess({
            rank,
            totalUsers
        });

    } catch (e: any) {
        console.error("Rank fetch error:", e);
        return apiError(e.message || 'Internal Server Error', 'INTERNAL_ERROR', 500);
    }
}
