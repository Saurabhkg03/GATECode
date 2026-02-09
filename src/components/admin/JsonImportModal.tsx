"use client";

import { useState, useRef } from 'react';
import { db } from '@/firebase';
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore';
import { X, Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface JsonImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

// Types based on the structure in seed6.js and Question interface
interface ImportedQuestion {
    question_id: string;
    title?: string;
    subject: string;
    topic: string;
    year: string;
    branch: string;
    question_type: string;
    question_label?: string;
    question_html?: string;
    question_text?: string;
    question_images?: { original_url: string }[];
    explanation_html?: string;
    explanation_images?: { original_url: string }[];
    options: {
        label?: string;
        text_html?: string;
        text?: string;
        is_correct?: boolean;
    }[];
    nat_answer_min?: string;
    nat_answer_max?: string;
    tags?: string[];
}

export default function JsonImportModal({ isOpen, onClose, onSuccess }: JsonImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic Collection Selection State
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const branches = ["CSE", "ECE", "EE", "ME", "CE", "IN", "DA"];

    if (!isOpen) return null;

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setLogs([]);
            setProgress(0);
        }
    };

    // --- Helper Functions ported from seed6.js ---

    const extractOriginalImageUrls = (imageArray: any) => {
        if (!Array.isArray(imageArray)) return [];
        return imageArray.map((img: any) => img.original_url).filter(Boolean);
    };

    const cleanValue = (value: any) => {
        if (!value || value === "General" || value === "N/A" || value === "Unknown" || value === "UnknownYear" || value === "UnknownBranch") {
            return null;
        }
        return value;
    };

    const convertMapOfSetsToSortedArrays = (mapOfSets: Record<string, Set<string>>) => {
        const finalMap: Record<string, string[]> = {};
        for (const [key, set] of Object.entries(mapOfSets)) {
            finalMap[key] = Array.from(set).sort();
        }
        return finalMap;
    };

    const handleImport = async () => {
        if (!file) return;
        if (!selectedBranch) {
            setError("Please select a target branch.");
            return;
        }

        setIsUploading(true);
        setError(null);
        setLogs([]);
        setProgress(0);
        addLog(`Starting import process for Branch: ${selectedBranch}...`);

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const questions: ImportedQuestion[] = JSON.parse(content);
                const totalQuestionCount = questions.length;

                addLog(`✅ File parsed. Found ${totalQuestionCount} questions.`);

                if (totalQuestionCount === 0) {
                    throw new Error("No questions found in the JSON file.");
                }

                // --- Part 1: Calculate Metadata ---
                addLog("Calculating metadata...");

                const subjectCounts: Record<string, number> = {};
                const topicCounts: Record<string, number> = {};
                const yearCounts: Record<string, number> = {};
                const branchCounts: Record<string, number> = {};
                const questionTypeCounts: Record<string, number> = {};

                const allBranches = new Set<string>();
                const allQuestionTypes = new Set<string>();
                const subjectTopicMap: Record<string, Set<string>> = {};
                const branchSubjectMap: Record<string, Set<string>> = {};
                const questionsForSorting: { id: string, title: string }[] = [];

                // 1. Metadata Calculation Pass
                for (const q of questions) {
                    const subject = cleanValue(q.subject);
                    const topic = cleanValue(q.topic);
                    const year = cleanValue(q.year);
                    const branch = cleanValue(q.branch);
                    const question_type = cleanValue(q.question_type);

                    if (subject) subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
                    if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                    if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
                    if (branch) branchCounts[branch] = (branchCounts[branch] || 0) + 1;
                    if (question_type) questionTypeCounts[question_type] = (questionTypeCounts[question_type] || 0) + 1;

                    if (branch) allBranches.add(branch);
                    if (question_type) allQuestionTypes.add(question_type);

                    if (subject && topic) {
                        if (!subjectTopicMap[subject]) subjectTopicMap[subject] = new Set();
                        subjectTopicMap[subject].add(topic);
                    }
                    if (branch && subject) {
                        if (!branchSubjectMap[branch]) branchSubjectMap[branch] = new Set();
                        branchSubjectMap[branch].add(subject);
                    }
                }
                addLog("✅ Metadata calculated.");

                // --- Part 2: Seed Questions ---
                const targetCollectionName = `questions_${selectedBranch.toLowerCase()}`;
                addLog(`Starting database upload to '${targetCollectionName}'...`);

                const questionsCollection = collection(db, targetCollectionName);
                const MAX_WRITES_PER_BATCH = 500;
                let batch = writeBatch(db);
                let count = 0;
                let batchCount = 0;

                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    const docRef = doc(questionsCollection); // Auto-generate ID

                    const subject = q.subject || "General";
                    // Override branch with selected branch to ensure consistency if needed, 
                    // or keep original. usually better to ensure it matches the collection.
                    // But let's respect the JSON if valid, or fallback.
                    const branch = q.branch || selectedBranch;
                    const topic = q.topic || "General";
                    const year = q.year || "N/A";
                    const sequentialIndex = i + 1;
                    const newLabel = `Question ${sequentialIndex}`;
                    const title = q.title || newLabel;

                    const question_images = extractOriginalImageUrls(q.question_images);
                    const explanation_images = extractOriginalImageUrls(q.explanation_images);

                    const correctOptions = (q.options || []).filter(opt => opt.is_correct);
                    let correctAnswerLabel = null;
                    let correctAnswerLabels: string[] = [];

                    if (q.question_type === 'msq') {
                        correctAnswerLabels = correctOptions.map(opt => opt.label || "").filter(Boolean);
                    } else if (q.question_type === 'mcq' && correctOptions.length > 0) {
                        correctAnswerLabel = correctOptions[0].label || null;
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
                        accuracy: 0,
                        // Add an index for sorting if needed, or rely on title parsing
                        qIndex: sequentialIndex // Sequential index as per user request
                    };

                    batch.set(docRef, questionData);
                    count++;

                    // Track for metadata sorting
                    questionsForSorting.push({ id: docRef.id, title: title });

                    if (count % MAX_WRITES_PER_BATCH === 0) {
                        batchCount++;
                        addLog(`Committing batch ${batchCount} (${count}/${totalQuestionCount})...`);
                        await batch.commit();
                        batch = writeBatch(db);
                        setProgress(Math.round((count / totalQuestionCount) * 90)); // Up to 90% for questions
                    }
                }

                // Commit remaining
                if (count % MAX_WRITES_PER_BATCH !== 0) {
                    batchCount++;
                    addLog(`Committing final batch ${batchCount}...`);
                    await batch.commit();
                }

                addLog(`✅ Seeding complete. ${count} questions uploaded to ${targetCollectionName}.`);
                setProgress(95);

                // --- Part 3: Save Metadata ---
                addLog("Finalizing metadata...");

                // Base metadata structure (assuming we don't have the original 'metadata.json' file)
                // In seed6.js it reads a separate metadata.json file for 'subjects', 'topics', 'years', 'tags'.
                // Since we only have the questions JSON, we must derive these lists from the unique values we found.
                // This is a slight deviation but necessary if the user only uploads one file.
                // OR we can fetch existing metadata first. 
                // For now, I will derive them from the mapped data to ensure self-consistency.

                const finalSubjects = Object.keys(subjectCounts).sort();
                const finalTopics = Object.keys(topicCounts).sort();
                const finalYears = Object.keys(yearCounts).sort();
                // Tags are harder to aggregate efficiently without a massive Set, but we can try or just leave empty/basic.
                // seed6 used a pre-existing list. I'll just use a generic list or derived types.

                // Sorting for Daily Challenge
                questionsForSorting.sort((a, b) => {
                    const numA = parseInt((a.title || '0').replace(/\D/g, ''), 10);
                    const numB = parseInt((b.title || '0').replace(/\D/g, ''), 10);
                    return numA - numB;
                });
                const sortedQuestionIds = questionsForSorting.map(q => q.id);

                const finalMetadata = {
                    branch: selectedBranch,
                    subjects: finalSubjects,
                    topics: finalTopics,
                    years: finalYears,
                    tags: [], // Leaving empty or you could aggregate from questions if needed

                    branches: Array.from(allBranches).sort(),
                    questionTypes: Array.from(allQuestionTypes).sort(),
                    questionCount: totalQuestionCount,

                    subjectCounts,
                    topicCounts,
                    yearCounts,
                    branchCounts,
                    questionTypeCounts,

                    subjectTopicMap: convertMapOfSetsToSortedArrays(subjectTopicMap),
                    branchSubjectMap: convertMapOfSetsToSortedArrays(branchSubjectMap),

                    allQuestionIds: sortedQuestionIds,
                    lastUpdated: new Date().toISOString()
                };

                // Write to branch-specific metadata document (e.g., metadata/ece)
                // IMPORTANT: Ensure branch ID is lowercase to match MetadataContext expectations
                await setDoc(doc(db, "metadata", selectedBranch.toLowerCase()), finalMetadata);

                addLog("✅ Metadata document updated successfully.");
                addLog("🎉 All Done!");
                setProgress(100);

                if (onSuccess) onSuccess();
                // Close after a short delay or let user close
                // setTimeout(onClose, 2000);

            } catch (err: any) {
                console.error(err);
                setError(err.message || "An error occurred during import.");
                addLog(`❌ Error: ${err.message}`);
            } finally {
                setIsUploading(false);
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileJson className="w-5 h-5 text-blue-500" />
                        Import Question Data
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">

                    {!isUploading && progress === 0 && (
                        <div className="space-y-4">
                            {/* Branch Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select Target Branch
                                </label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="" disabled>Select a branch...</option>
                                    {branches.map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleFileChange}
                                />
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {file ? file.name : "Click to select a JSON file"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Must be a valid array of questions structure
                                </p>
                            </div>

                            {file && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleImport}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        Start Import
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {(isUploading || progress > 0) && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>

                            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto space-y-1 shadow-inner">
                                {logs.length === 0 && <span className="text-gray-500">Initializing...</span>}
                                {logs.map((log, idx) => (
                                    <div key={idx}>{log}</div>
                                ))}
                                {isUploading && (
                                    <div className="flex items-center gap-2 text-blue-400 mt-2">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                )}
                                {progress === 100 && (
                                    <div className="flex items-center gap-2 text-green-400 mt-2 font-bold">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Import Successful!</span>
                                    </div>
                                )}
                            </div>

                            {progress === 100 && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
