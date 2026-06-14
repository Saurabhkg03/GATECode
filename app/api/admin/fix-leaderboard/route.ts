import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

const BRANCHES = ['ece', 'cse', 'me', 'ce', 'ee'];

export async function GET() {
    if (!adminDb) {
        return NextResponse.json({ error: "adminDb not initialized" }, { status: 500 });
    }

    try {
        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.get();
        let updatedCount = 0;

        const batch = adminDb.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            const updates: any = {};
            let needsUpdate = false;

            const currentBranchRatings = data.branchRatings || {};
            const newBranchRatings = { ...currentBranchRatings };
            let modifiedBranchRatings = false;

            const currentRatings = data.ratings || {};
            const newRatings = { ...currentRatings };
            let modifiedRatings = false;

            for (const branch of BRANCHES) {
                if (newBranchRatings[branch] === undefined) {
                    newBranchRatings[branch] = 1500;
                    modifiedBranchRatings = true;
                }
                if (newRatings[branch] === undefined) {
                    newRatings[branch] = 0;
                    modifiedRatings = true;
                }
            }

            if (modifiedBranchRatings) {
                updates.branchRatings = newBranchRatings;
                needsUpdate = true;
            }
            if (modifiedRatings) {
                updates.ratings = newRatings;
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, updates);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({ success: true, updatedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
