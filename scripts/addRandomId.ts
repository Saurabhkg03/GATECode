// Migration Script: Add randomId to existing questions
// Run this via: npx tsx scripts/addRandomId.ts

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (adjust the path to your service account key)
// This script is meant to be run locally by the admin with their service account credentials.
const serviceAccount = require('../serviceAccountKey.json'); // PLACEHOLDER: Ensure you have your service account JSON

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateCollection(collectionName: string) {
    console.log(`Starting migration for: ${collectionName}`);
    const colRef = db.collection(collectionName);
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log(`No documents found in ${collectionName}. Skipping.`);
        return;
    }

    const batchSize = 400; // Safe limit under Firestore's 500 writes/batch limit
    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Only update if randomId is missing to save on writes
        if (data.randomId === undefined) {
            batch.update(doc.ref, { randomId: Math.random() });
            count++;
            totalUpdated++;

            if (count === batchSize) {
                await batch.commit();
                console.log(`Committed batch of ${count} documents in ${collectionName}...`);
                batch = db.batch();
                count = 0;
            }
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${count} documents in ${collectionName}.`);
    }

    console.log(`Migration completed for ${collectionName}. Total updated: ${totalUpdated}`);
}

async function run() {
    try {
        // List of all question collections
        const branches = ['ece', 'cse', 'me', 'ee', 'in'];
        
        for (const branch of branches) {
            await migrateCollection(`questions_${branch}`);
        }
        
        console.log("All migrations finished successfully!");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

run();
