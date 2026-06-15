import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testQuery() {
    try {
        const q = query(
            collection(db, 'questions_ece'),
            where('verified', '==', true),
            orderBy('qIndex', 'asc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        console.log(`Query successful. Found ${snapshot.docs.length} questions.`);
    } catch (e) {
        console.error("Query failed:", e.message);
    }
    process.exit(0);
}

testQuery();
