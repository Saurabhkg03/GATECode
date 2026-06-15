import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { apiError, apiSuccess } from '@/lib/apiResponse';

// Next.js Edge API Route
// Ensures this route is evaluated dynamically if needed, 
// though we can also cache it if we want.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return apiError('Branch is required', 'BAD_REQUEST', 400);
        }

        const { doc, getDoc } = await import('firebase/firestore');
        const metadataRef = doc(db, 'metadata', branch);
        const metadataSnap = await getDoc(metadataRef);

        if (!metadataSnap.exists()) {
            return apiError('Metadata not found', 'NOT_FOUND', 404);
        }

        const data = metadataSnap.data();
        const questionIds = data.allQuestionIds || [];

        if (questionIds.length === 0) {
            return apiError("No questions found", 'NOT_FOUND', 404);
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff =
            now.getTime() -
            start.getTime() +
            (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        const challengeIndex = (dayOfYear - 1) % questionIds.length;
        const dailyChallengeId = questionIds[challengeIndex];

        return apiSuccess({ dailyChallengeId, index: challengeIndex, dayOfYear });
    } catch (error: any) {
        console.error("[DailyChallenge API Error]:", error);
        return apiError(error.message || 'Internal Server Error', 'INTERNAL_ERROR', 500);
    }
}
