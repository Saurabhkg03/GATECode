import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';
import { requireAdmin } from '@/lib/adminAuth';
import { adminLimiter } from '@/lib/rateLimit';
import { waitUntil } from '@vercel/functions';
import { apiError, apiSuccess } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
    try {
        const decoded = await requireAdmin(req);

        const { success } = await adminLimiter.limit(decoded.uid);
        if (!success) {
            return apiError('Too Many Requests', 'RATE_LIMITED', 429);
        }

        const body = await req.json();
        const { contestId } = body;

        if (!contestId) {
            return apiError('Missing contestId', 'BAD_REQUEST', 400);
        }

        const app = await initAdmin();
        if (!app) {
             return apiError('Firebase Admin not configured', 'SERVER_ERROR', 500);
        }
        const db = app.firestore();

        // Process ratings in the background using waitUntil
        waitUntil(processContestRatings(db, contestId).catch(console.error));
        
        return apiSuccess({ message: "Processing started in background" }, 202);

    } catch (e: any) {
        console.error("Process ratings error:", e);
        return apiError(e.message || 'Internal Server Error', 'INTERNAL_ERROR', 500);
    }
}
