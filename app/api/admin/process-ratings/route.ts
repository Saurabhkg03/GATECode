import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contestId } = body;

        if (!contestId) {
            return NextResponse.json({ error: 'Missing contestId' }, { status: 400 });
        }

        const app = await initAdmin();
        if (!app) {
             return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const db = app.firestore();

        const result = await processContestRatings(db, contestId);
        return NextResponse.json(result);

    } catch (e: any) {
        console.error("Process ratings error:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
