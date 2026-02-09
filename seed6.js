import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from 'dotenv';

// Load environment variables from a .env file in the root directory.
dotenv.config();

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

// --- Script Logic ---

// Validate that all Firebase configuration keys are present.
for (const key in firebaseConfig) {
    if (!firebaseConfig[key]) {
        const envVarName = `VITE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
        console.error(`❌ Missing Firebase config key in .env file: ${envVarName}`);
        process.exit(1);
    }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define file paths
const questionsJsonPath = path.resolve(__dirname, "gate_output", "all_questions.json");
const metadataJsonPath = path.resolve(__dirname, "gate_output", "metadata.json");

/**
 * Extracts the original source URLs from the image metadata objects.
 */
function extractOriginalImageUrls(imageArray) {
    if (!Array.isArray(imageArray)) return [];
    return imageArray.map(img => img.original_url).filter(Boolean);
}

/**
 * Cleans a metadata value, returning null if it's a generic holder.
 */
function cleanValue(value) {
    if (!value || value === "General" || value === "N/A" || value === "Unknown" || value === "UnknownYear" || value === "UnknownBranch") {
        return null;
    }
    return value;
}

/**
 * Converts a map of Sets into a map of sorted Arrays.
 */
function convertMapOfSetsToSortedArrays(mapOfSets) {
    const finalMap = {};
    for (const [key, set] of Object.entries(mapOfSets)) {
        finalMap[key] = Array.from(set).sort();
    }
    return finalMap;
}


/**
 * Uploads question data and metadata from JSON files to your Firestore database.
 */
async function seedDatabase() {
    let questionsSeeded = false;
    let metadataSeeded = false;
    let totalQuestionCount = 0;
    
    // --- NEW: Structures for all metadata ---
    const subjectCounts = {};
    const topicCounts = {};
    const yearCounts = {};
    const branchCounts = {};
    const questionTypeCounts = {};

    const allBranches = new Set();
    const allQuestionTypes = new Set();

    // Dependency maps (using Sets for efficient unique additions)
    const subjectTopicMap = {};
    const branchSubjectMap = {};

    // --- NEW: For Daily Challenge ---
    // This array will hold { id, title } for sorting
    const questionsForSorting = []; 


    // --- Part 1: Read JSON and Calculate Metadata ---
    let questions = [];
    try {
        console.log(`Reading questions from: ${questionsJsonPath}`);
        const fileContents = readFileSync(questionsJsonPath, "utf8");
        questions = JSON.parse(fileContents);
        totalQuestionCount = questions.length;
        console.log(`✅ Found ${totalQuestionCount} questions to import.`);

        // --- NEW: Calculate all metadata in one pass ---
        console.log("Calculating all metadata (counts, maps, and unique values)...");
        for (const q of questions) {
            const subject = cleanValue(q.subject);
            const topic = cleanValue(q.topic);
            const year = cleanValue(q.year);
            const branch = cleanValue(q.branch);
            const question_type = cleanValue(q.question_type);

            // 1. Increment Counts
            if (subject) subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
            if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
            if (branch) branchCounts[branch] = (branchCounts[branch] || 0) + 1;
            if (question_type) questionTypeCounts[question_type] = (questionTypeCounts[question_type] || 0) + 1;
        
            // 2. Collect Unique Values
            if (branch) allBranches.add(branch);
            if (question_type) allQuestionTypes.add(question_type);

            // 3. Build Dependency Maps
            if (subject && topic) {
                if (!subjectTopicMap[subject]) subjectTopicMap[subject] = new Set();
                subjectTopicMap[subject].add(topic);
            }
            if (branch && subject) {
                if (!branchSubjectMap[branch]) branchSubjectMap[branch] = new Set();
                branchSubjectMap[branch].add(subject);
            }
        }

        console.log("✅ All metadata calculated.");
        // --- End of new logic ---

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Error: Could not find the JSON file at '${questionsJsonPath}'.`);
            console.error("Please make sure you have run the scraper and 'all_questions.json' exists.");
        } else {
            console.error("❌ Error reading 'all_questions.json':", error);
        }
        process.exit(1);
    }


    // --- Part 2: Seed Questions ---
    try {
        const questionsCollection = collection(db, "questions");
        
        const MAX_WRITES_PER_BATCH = 500;
        let batch = writeBatch(db);
        let count = 0;
        let batchCount = 0;

        console.log("Starting to seed questions collection...");
        for (const q of questions) {
            const docRef = doc(questionsCollection); // Auto-generate ID

            // Clean data from scraper
            const subject = q.subject || "General";
            const branch = q.branch || "N/A";
            const topic = q.topic || "General";
            const year = q.year || "N/A";
            const title = q.question_label || `Question from ${year}`;
            const question_images = extractOriginalImageUrls(q.question_images);
            const explanation_images = extractOriginalImageUrls(q.explanation_images);
            
            const correctOptions = q.options.filter(opt => opt.is_correct);
            let correctAnswerLabel = null;
            let correctAnswerLabels = [];

            if (q.question_type === 'msq') {
                correctAnswerLabels = correctOptions.map(opt => opt.label).filter(Boolean);
            } else if (q.question_type === 'mcq' && correctOptions.length > 0) {
                correctAnswerLabel = correctOptions[0].label;
            }

            const questionData = {
                scraped_id: q.question_id, 
                title: title,
                question_html: q.question_html || q.question_text || "",
                question_image_links: question_images,
                
                explanation_html: q.explanation_html || "",
                explanation_image_links: explanation_images,

                options: (q.options || []).map(opt => ({
                    label: opt.label || null,
                    text_html: opt.text_html || opt.text || "",
                    is_correct: opt.is_correct || false
                })),
                
                correctAnswerLabel: correctAnswerLabel,
                correctAnswerLabels: correctAnswerLabels,
                question_type: q.question_type || "unknown",
                
                nat_answer_min: q.nat_answer_min || null,
                nat_answer_max: q.nat_answer_max || null,

                year: year,
                subject: subject,
                branch: branch,
                topic: topic,
                tags: q.tags || [branch, subject, topic, `GATE ${year}`].filter(Boolean),
                createdAt: new Date().toISOString(),
                
                verified: false,
                attempts: 0,
                accuracy: 0
            };
            
            batch.set(docRef, questionData);
            count++;

            // --- ADDED: Populate sorting array with the new doc ID and title ---
            questionsForSorting.push({ id: docRef.id, title: title });

            if (count % MAX_WRITES_PER_BATCH === 0) {
                batchCount++;
                console.log(`Committing batch ${batchCount} (${count} questions)...`);
                await batch.commit();
                batch = writeBatch(db);
            }
        }

        if (count % MAX_WRITES_PER_BATCH !== 0 && count > 0) {
            batchCount++;
            console.log(`Committing final batch ${batchCount} (total ${count} questions)...`);
            await batch.commit();
        }

        if (count === 0) {
            console.log("No questions to upload.");
        } else {
            console.log(`✅ Firestore 'questions' collection seeded successfully with ${count} questions!`);
            questionsSeeded = true;
        }

    } catch (error) {
        console.error("❌ Error seeding 'questions' collection:", error);
        process.exit(1);
    }

    // --- Part 3: Seed Metadata ---
    try {
        console.log(`Reading base metadata from: ${metadataJsonPath}`);
        const metadataFileContents = readFileSync(metadataJsonPath, "utf8");
        const metadata = JSON.parse(metadataFileContents);

        if (!metadata.subjects || !metadata.topics || !metadata.years || !metadata.tags) {
            console.error("❌ Metadata file is missing required fields (subjects, topics, years, tags).");
            process.exit(1);
        }

        // --- ADDED: Sort questions by title to get stable ID list ---
        console.log("Sorting question IDs for daily challenge...");
        questionsForSorting.sort((a, b) => {
            const numA = parseInt((a.title || '0').replace(/\D/g,''), 10);
            const numB = parseInt((b.title || '0').replace(/\D/g,''), 10);
            return numA - numB;
        });
        const sortedQuestionIds = questionsForSorting.map(q => q.id);
        console.log(`✅ Created sorted list of ${sortedQuestionIds.length} question IDs.`);

        // Convert sets to sorted arrays
        const finalBranches = Array.from(allBranches).sort();
        const finalQuestionTypes = Array.from(allQuestionTypes).sort();
        const finalSubjectTopicMap = convertMapOfSetsToSortedArrays(subjectTopicMap);
        const finalBranchSubjectMap = convertMapOfSetsToSortedArrays(branchSubjectMap);


        const metadataDocRef = doc(db, "metadata", "filterOptions");

        console.log("Writing metadata to 'metadata/filterOptions' document... (1 write)");
        
        // --- MODIFIED: Combine base metadata with all new calculated metadata ---
        const finalMetadata = {
            // Base lists from metadata.json (truth source from scraper)
            subjects: metadata.subjects,
            topics: metadata.topics,
            years: metadata.years,
            tags: metadata.tags,
            
            // New unique lists calculated from all_questions.json
            branches: finalBranches,
            questionTypes: finalQuestionTypes,

            // Overall count
            questionCount: totalQuestionCount,
            
            // All counts
            subjectCounts: subjectCounts,
            topicCounts: topicCounts,
            yearCounts: yearCounts,
            branchCounts: branchCounts,
            questionTypeCounts: questionTypeCounts,

            // Dependency maps
            subjectTopicMap: finalSubjectTopicMap,
            branchSubjectMap: finalBranchSubjectMap,

            // --- ADDED: Sorted ID list for Daily Challenge ---
            allQuestionIds: sortedQuestionIds,

            // Timestamp
            lastUpdated: new Date().toISOString()
        };

        await setDoc(metadataDocRef, finalMetadata);
        
        console.log("✅ Firestore metadata document seeded successfully!");
        console.log("--- Final Metadata Object (summary) ---");
        console.log(`{ subjects: ${finalMetadata.subjects.length}, topics: ${finalMetadata.topics.length}, questionCount: ${finalMetadata.questionCount}, allQuestionIds: ${finalMetadata.allQuestionIds.length} }`);
        console.log("-----------------------------");
        metadataSeeded = true;

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Error: Could not find the JSON file at '${metadataJsonPath}'.`);
            console.error("Please make sure you have run the scraper and 'metadata.json' exists.");
        } else {
            console.error("❌ Error seeding 'metadata' document:", error);
        }
        process.exit(1);
    }

    if(questionsSeeded && metadataSeeded) {
        console.log("\n🎉 All seeding complete!");
    }
}

seedDatabase();

