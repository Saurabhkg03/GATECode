import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';

// Next.js Edge API Route
// Ensures this route is evaluated dynamically if needed, 
// though we can also cache it if we want.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch') || 'ece';

        const { doc, getDoc } = await import('firebase/firestore');
        const metadataRef = doc(db, 'metadata', branch);
        const metadataSnap = await getDoc(metadataRef);

        if (!metadataSnap.exists()) {
            return NextResponse.json({ error: 'Metadata not found' }, { status: 404 });
        }

        const data = metadataSnap.data();
        const questionIds = data.allQuestionIds || [];

        if (questionIds.length === 0) {
            return NextResponse.json({ dailyChallengeId: null, error: "No questions found" }, { status: 404 });
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

        return NextResponse.json({ dailyChallengeId, index: challengeIndex, dayOfYear });
    } catch (error: any) {
        console.error("[DailyChallenge API Error]:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
