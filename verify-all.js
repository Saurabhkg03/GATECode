import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc, getDocs } from "firebase/firestore";
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

async function verifyAll() {
    const collectionsToVerify = ['questions', 'questions_cse', 'questions_ece', 'questions_ee', 'questions_me', 'questions_ce'];
    
    for (const colName of collectionsToVerify) {
        console.log(`Verifying questions in collection: ${colName}`);
        try {
            const snapshot = await getDocs(collection(db, colName));
            let batch = writeBatch(db);
            let count = 0;
            let total = 0;
            
            for (const document of snapshot.docs) {
                batch.update(document.ref, { verified: true });
                count++;
                total++;
                
                if (count === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                    console.log(`Committed 400 updates to ${colName}`);
                }
            }
            
            if (count > 0) {
                await batch.commit();
                console.log(`Committed remaining ${count} updates to ${colName}`);
            }
            console.log(`Successfully verified ${total} questions in ${colName}`);
        } catch (e) {
            console.log(`Error verifying ${colName}:`, e.message);
        }
    }
    process.exit(0);
}

verifyAll();
