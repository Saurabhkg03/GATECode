
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const branches = ["cse", "ece", "ee", "me", "ce", "in"];

async function repairMetadata() {
    console.log("Starting Metadata Repair...");

    for (const branch of branches) {
        console.log(`\nProcessing branch: ${branch.toUpperCase()}...`);
        const collectionName = `questions_${branch}`;
        const qCol = collection(db, collectionName);

        try {
            const snapshot = await getDocs(qCol);
            if (snapshot.empty) {
                console.log(`  - No questions found in '${collectionName}'. Skipping.`);
                continue;
            }

            console.log(`  - Found ${snapshot.size} questions.`);

            const allQuestionIds = [];
            const subjectCounts = {};
            const topicCounts = {};
            const questionsForSorting = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                allQuestionIds.push(doc.id);

                // Collect stats
                const subject = data.subject || "General";
                const topic = data.topic || "General";

                subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;

                questionsForSorting.push({
                    id: doc.id,
                    title: data.title || doc.id,
                    qIndex: data.qIndex
                });
            });

            // Sort IDs
            // Helper to extract number from title
            const extractNum = (str) => {
                const match = (str || '').match(/(\d+)/);
                return match ? parseInt(match[0], 10) : 999999;
            };

            questionsForSorting.sort((a, b) => {
                // Primary: qIndex if available
                if (a.qIndex && b.qIndex) return a.qIndex - b.qIndex;
                if (a.qIndex) return -1;
                if (b.qIndex) return 1;

                // Secondary: Title numeric
                const numA = extractNum(a.title);
                const numB = extractNum(b.title);
                if (numA !== numB) return numA - numB;

                // Tertiary: Title string
                return a.title.localeCompare(b.title);
            });

            const sortedIds = questionsForSorting.map(q => q.id);

            // Construct Metadata
            const metadata = {
                branch: branch,
                questionCount: snapshot.size,
                allQuestionIds: sortedIds,
                subjects: Object.keys(subjectCounts).sort(),
                topics: Object.keys(topicCounts).sort(),
                subjectCounts,
                topicCounts,
                lastUpdated: new Date().toISOString()
            };

            // Write to Metadata
            const metadataRef = doc(db, 'metadata', branch);
            await setDoc(metadataRef, metadata, { merge: true });

            console.log(`  - ✅ Metadata updated for ${branch.toUpperCase()}.`);

        } catch (error) {
            console.error(`  - ❌ Error processing ${branch}:`, error);
        }
    }

    console.log("\nRepair Complete.");
    process.exit(0);
}

repairMetadata();
