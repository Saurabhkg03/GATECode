import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { authLimiter } from '@/lib/rateLimit';

async function deleteCollection(db: any, collectionPath: string, batchSize = 500) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: any, query: any, resolve: any) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

export async function DELETE(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        
        const app = await initAdmin();
        if (!app) {
             return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }

        const decodedToken = await app.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const { success } = await authLimiter.limit(uid);
        if (!success) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
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

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete Account Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
