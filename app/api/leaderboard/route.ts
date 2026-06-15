import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { unstable_cache } from 'next/cache';
import { apiError, apiSuccess } from '@/lib/apiResponse';

const getCachedLeaderboard = unstable_cache(
    async (branch: string, limitCount: number) => {
        const app = await initAdmin();
        if (!app) throw new Error("Firebase admin not initialized");
        const db = app.firestore();
        
        const usersQuery = db.collection('users')
            .orderBy(`branchRatings.${branch}`, 'desc')
            .limit(limitCount);
        
        const usersSnapshot = await usersQuery.get();
        
        return usersSnapshot.docs.map(doc => {
            const data = doc.data();
            const branchStats = data.branchStats?.[branch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
            const branchRating = data.branchRatings?.[branch] || 1500;

            return {
                uid: doc.id,
                name: data.name,
                username: data.username,
                avatar: data.avatar,
                stats: branchStats,
                rating: branchRating,
            };
        });
    },
    ['leaderboard-cache'], // base key
    {
        revalidate: 300, // cache for 5 minutes
        tags: ['leaderboard']
    }
);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');
        const limitCount = parseInt(searchParams.get('limit') || '5', 10);

        if (!branch) {
            return apiError('Branch is required', 'BAD_REQUEST', 400);
        }

        const leaderboard = await getCachedLeaderboard(branch, limitCount);
        
        return apiSuccess(leaderboard);
    } catch (error: any) {
        console.error('Leaderboard fetch error:', error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
