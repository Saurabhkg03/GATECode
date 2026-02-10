import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';

// Simple implementation accepting the Beacon payload
export async function POST(req: NextRequest) {
    try {
        // Beacon sends 'text/plain' or 'application/json' in Blob.
        let body;

        // Handle Blob/Strings
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            body = await req.json();
        } else {
            // Beacon sometimes sends as text even if we said json blob
            const text = await req.text();
            body = JSON.parse(text);
        }

        const { contestId, uid, attemptId, responses, timeLeftSeconds } = body;

        if (!attemptId || !uid) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- Save to Firestore ---
        // Using standard Firestore update for reliability
        const { doc, updateDoc } = await import('firebase/firestore');
        const attemptRef = doc(db, 'contest_attempts', attemptId);

        await updateDoc(attemptRef, {
            responses,
            timeLeftSeconds,
            isSubmitted: true,
            submittedAt: Date.now(),
            lastUpdated: Date.now()
        });

        console.log(`[Submission Success] Attempt ${attemptId} marked as completed.`);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Submission error:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
