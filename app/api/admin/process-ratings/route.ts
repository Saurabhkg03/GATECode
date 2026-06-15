import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';
import { requireAdmin } from '@/lib/adminAuth';
import { adminLimiter } from '@/lib/rateLimit';
import { waitUntil } from '@vercel/functions';

export async function POST(req: NextRequest) {
    try {
        const decoded = await requireAdmin(req);

        const { success } = await adminLimiter.limit(decoded.uid);
        if (!success) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

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

        // Process ratings in the background using waitUntil
        waitUntil(processContestRatings(db, contestId).catch(console.error));
        
        return NextResponse.json({ success: true, message: "Processing started in background" }, { status: 202 });

    } catch (e: any) {
        console.error("Process ratings error:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
