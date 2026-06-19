import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { apiError, apiSuccess } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
    try {
        console.log('[Delete Seeded Users] Starting cleanup...');

        if (!adminDb) {
            return apiError('Admin DB is not initialized', 'INTERNAL_ERROR', 500);
        }

        // 1. Find all seeded users
        const usersSnap = await adminDb.collection('users').where('isSimulated', '==', true).get();
        const userIds = usersSnap.docs.map(doc => doc.id);
        
        let totalDeleted = 0;
        let batches: Promise<any>[] = [];
        let batch = adminDb.batch();
        let ops = 0;

        const commit = async () => {
            if (ops > 0) {
                batches.push(batch.commit());
                batch = adminDb!.batch();
                ops = 0;
            }
        };

        // Delete Users
        for (const doc of usersSnap.docs) {
            batch.delete(doc.ref);
            ops++;
            totalDeleted++;
            if (ops >= 400) await commit();
        }

        // Delete Contest Attempts for these users (optional but good for cleanup)
        // Since we can't 'where in' an array of 100 easily (>30 limit), we chunk it.
        const chunkSize = 30;
        for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            if (chunk.length === 0) continue;
            
            const attemptsSnap = await adminDb.collection('contest_attempts').where('uid', 'in', chunk).get();
            for (const doc of attemptsSnap.docs) {
                batch.delete(doc.ref);
                ops++;
                if (ops >= 400) await commit();
            }
        }

        await commit();
        await Promise.all(batches);

        console.log(`[Delete Seeded Users] Successfully deleted ${totalDeleted} users and their attempts.`);
        return apiSuccess({ message: `Successfully deleted ${totalDeleted} seeded users.` });

    } catch (error: any) {
        console.error('[Delete Seeded Users] Error:', error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
