import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} else {
    console.error("serviceAccountKey.json not found.");
    process.exit(1);
}

const db = admin.firestore();

const BRANCHES = ['ece', 'cse', 'me', 'ce', 'ee'];

async function fixLeaderboardRatings() {
    console.log("Starting database patch for missing branch ratings...");
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        let updatedCount = 0;

        const batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;

            // Ensure branchRatings exists and has all branches set to 1500
            const currentBranchRatings = data.branchRatings || {};
            const newBranchRatings = { ...currentBranchRatings };
            let modifiedBranchRatings = false;

            // Ensure ratings exists and has all branches set to 0
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
            console.log(`Successfully updated ${updatedCount} users with default branch ratings.`);
        } else {
            console.log("No users needed updating. All good!");
        }

    } catch (error) {
        console.error("Error updating users:", error);
    }
    process.exit(0);
}

fixLeaderboardRatings();
