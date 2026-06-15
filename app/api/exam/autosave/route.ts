import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { examSubmitLimiter } from '@/lib/rateLimit';

const autosaveSchema = z.object({
  uid: z.string().min(1, "uid is required"),
  attemptId: z.string().min(1, "attemptId is required"),
  responses: z.any().optional(),
  tabSwitchCount: z.number().optional(),
  tabSwitchViolations: z.array(z.number()).optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = autosaveSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Bad Request', details: parsed.error.format() }, { status: 400 });
        }

        const { uid, attemptId, responses, tabSwitchCount, tabSwitchViolations } = parsed.data;

        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const token = authHeader.split('Bearer ')[1];
        const app = await initAdmin();
        if (!app) return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });

        const decodedToken = await app.auth().verifyIdToken(token);
        if (decodedToken.uid !== uid) {
            return NextResponse.json({ error: 'Forbidden: UID mismatch' }, { status: 403 });
        }

        // We can just use the same limiter, but a slightly larger threshold would be better.
        // Assuming examSubmitLimiter allows a few hits per 10s.
        const { success } = await examSubmitLimiter.limit(uid);
        if (!success) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        const db = app.firestore();
        const attemptRef = db.collection('contest_attempts').doc(attemptId);

        // We run transaction to ensure we don't overwrite if submitted
        await db.runTransaction(async (t: any) => {
            const attemptSnap = await t.get(attemptRef);
            if (!attemptSnap.exists) throw new Error('Attempt not found');

            const attemptData = attemptSnap.data()!;
            if (attemptData.isSubmitted) {
                // If already submitted, ignore autosaves
                return;
            }

            const updates: any = {
                lastUpdated: Date.now()
            };
            
            if (responses) updates.responses = responses;
            if (tabSwitchCount !== undefined) updates.tabSwitchCount = tabSwitchCount;
            if (tabSwitchViolations !== undefined) updates.tabSwitchViolations = tabSwitchViolations;

            t.update(attemptRef, updates);
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Autosave error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
