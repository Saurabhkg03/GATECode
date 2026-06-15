import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { authLimiter } from '@/lib/rateLimit';
import { apiError, apiSuccess } from '@/lib/apiResponse';

async function deleteCollection(db: any, collectionPath: string, batchSize = 500) {
    const collectionRef = db.collection(collectionPath);
    let query = collectionRef.orderBy('__name__').limit(batchSize);

    while (true) {
        const snapshot = await query.get();
        if (snapshot.size === 0) break;

        const batch = db.batch();
        snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return apiError('Unauthorized', 'UNAUTHORIZED', 401);
        }

        const token = authHeader.split('Bearer ')[1];
        
        const app = await initAdmin();
        if (!app) {
             return apiError('Firebase Admin not configured', 'SERVER_ERROR', 500);
        }

        const decodedToken = await app.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const { success } = await authLimiter.limit(uid);
        if (!success) {
            return apiError('Too Many Requests', 'RATE_LIMITED', 429);
        }

        const db = app.firestore();

        // 1. Delete Firestore subcollections
        await deleteCollection(db, `users/${uid}/submissions`);
        await deleteCollection(db, `users/${uid}/userQuestionData`);
        await deleteCollection(db, `users/${uid}/questionLists`);

        // 2. Delete main user document
        await db.collection('users').doc(uid).delete();

        // 3. Delete Auth user
        await app.auth().deleteUser(uid);

        return apiSuccess();

    } catch (error: any) {
        console.error("Delete Account Error:", error);
        return apiError(error.message || 'Internal Server Error', 'INTERNAL_ERROR', 500);
    }
}
