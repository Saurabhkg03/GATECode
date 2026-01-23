import "server-only";
import admin from 'firebase-admin';

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, '\n');
}

export function createFirebaseAdminApp(params: FirebaseAdminConfig) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: params.projectId,
            clientEmail: params.clientEmail,
            privateKey: privateKey,
        }),
    });
}

export async function initAdmin() {
    const params = {
        projectId: process.env.FIREBASE_PROJECT_ID as string,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
        privateKey: process.env.FIREBASE_PRIVATE_KEY as string,
    };

    // Quick validation
    if (!params.projectId || !params.clientEmail || !params.privateKey) {
        console.warn("Firebase Admin environment variables are missing. Dynamic SEO may fail.");
        return null;
    }

    return createFirebaseAdminApp(params);
}

// Singleton-like accessor if needed, or just standard init
let app;
if (!admin.apps.length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    }
} else {
    app = admin.app();
}

export const adminDb = app ? app.firestore() : null;
