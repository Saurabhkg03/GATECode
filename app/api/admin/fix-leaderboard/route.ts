import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { adminLimiter } from '@/lib/rateLimit';

const BRANCHES = ['ece', 'cse', 'me', 'ce', 'ee'];

export async function GET(req: NextRequest) {
    try {
        const decoded = await requireAdmin(req);

        const { success } = await adminLimiter.limit(decoded.uid);
        if (!success) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: "adminDb not initialized" }, { status: 500 });
        }

        const usersRef = adminDb.collection('users');
        let updatedCount = 0;
        let lastDoc: any = null;
        let hasMore = true;

        while (hasMore) {
            let userQuery = usersRef.limit(500);
            if (lastDoc) {
                userQuery = userQuery.startAfter(lastDoc);
            }
            
            const snapshot = await userQuery.get();
            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            const batch = adminDb.batch();
            let batchCount = 0;

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
                    batchCount++;
                    updatedCount++;
                }
            });

            if (batchCount > 0) {
                await batch.commit();
            }
        }

        return NextResponse.json({ success: true, updatedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
