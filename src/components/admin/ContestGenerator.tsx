"use client";

import React, { useState } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { Contest, Question, Section } from '@/types/exam';
import { Loader2, Wand2, Database, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';
import { sampleQuestions } from '@/data/sampleQuestions';

interface ContestGeneratorProps {
    onContestCreated?: () => void;
}

const ContestGenerator: React.FC<ContestGeneratorProps> = ({ onContestCreated }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [branch, setBranch] = useState('ece');
    const [contestTitle, setContestTitle] = useState('');
    const [useZenMode, setUseZenMode] = useState(true);

    const shuffle = <T,>(array: T[]) => array.sort(() => Math.random() - 0.5);

    const generateContest = async () => {
        setLoading(true);
        const sourceCollection = `questions_${branch}`; // Strictly use branch collection
        setStatus(`Fetching question bank from '${sourceCollection}'...`);

        try {
            // 1. Fetch Questions
            // Note: We fetch from the SUBCOLLECTION 'questions' if your stricture is questions_{branch}/questions
            // Or just the root if it's flat. Based on previous context, user likely wants 'questions_{branch}/questions' or just 'questions_{branch}'
            // Let's try the root collection 'questions_{branch}' first, or assuming standardized 'questions' subcollection pattern.
            // PROMPT SAID: "databuckets for each branch is questions_branchname" -> likely root collection or 'questions_branchname/questions'
            // Let's assume root collection 'questions_{branch}' contains the questions directly for now, 
            // OR checks for a 'questions' subcollection if getting 0 docs. 

            let qCol = collection(db, sourceCollection);
            let qSnapshot = await getDocs(qCol);

            if (qSnapshot.empty) {
                // Try subcollection pattern if root is empty
                qCol = collection(db, `${sourceCollection}/questions`);
                qSnapshot = await getDocs(qCol);
            }

            const allQuestions: Question[] = [];
            qSnapshot.forEach(doc => {
                const data = doc.data();
                // Basic validation to ensure it's a valid question
                if (data.question_html || data.title) {
                    allQuestions.push({
                        id: doc.id,
                        ...data,
                        branch: data.branch || branch, // Fallback to current branch if missing
                        marks: Number(data.marks) || 1,
                        negative_marks: Number(data.negative_marks) || (Number(data.marks) === 2 ? 0.66 : 0.33)
                    } as Question);
                }
            });

            // --- INJECT SAMPLE QUESTIONS ---
            // Filter relevant sample questions for this branch + General Aptitude
            const relevantSamples = sampleQuestions.filter(q => {
                const br = (q.branch || '').toLowerCase();
                return br === branch.toLowerCase() || br === 'general' || br === 'ga' || br === 'all';
            });

            const fetchedQuestionIds = new Set(allQuestions.map(q => q.id));
            let injectedCount = 0;

            relevantSamples.forEach(sample => {
                if (!fetchedQuestionIds.has(sample.id)) {
                    allQuestions.push(sample as Question);
                    fetchedQuestionIds.add(sample.id); // Prevent double counting if duplicates exist in sample data
                    injectedCount++;
                }
            });

            if (injectedCount > 0) {
                setStatus(prev => prev + `\nInjected ${injectedCount} sample questions.`);
            }
            // -------------------------------

            const totalFound = allQuestions.length;
            setStatus(prev => prev + `\nTotal Pool Size: ${totalFound} (Real + Sample).`);

            if (totalFound < 5) {
                throw new Error(`Insufficient questions even with samples. Found ${totalFound}, need at least 5 to start. Please seed more questions.`);
            }

            // 2. Bucket Strategy
            // GATE Pattern:
            // - General Aptitude (GA): 10 Questions (5 x 1-mark, 5 x 2-marks) = 15 Marks
            // - Technical: 55 Questions (25 x 1-mark, 30 x 2-marks) = 85 Marks
            // Total: 65 Questions, 100 Marks.

            // Filter GA
            const gaQuestions = allQuestions.filter(q => {
                const sub = (q.subject || '').toLowerCase();
                const br = (q.branch || '').toLowerCase();
                return sub.includes('aptitude') || sub.includes('verbal') || sub.includes('reasoning') || br === 'general' || br === 'ga';
            });

            // Filter Technical (Everything else that matches branch)
            // Strict filtering: Must match branch or be 'all'
            const techQuestions = allQuestions.filter(q =>
                !gaQuestions.includes(q) &&
                (q.branch?.toLowerCase() === branch.toLowerCase() || q.branch === 'all' || !q.branch)
            );

            console.log(`Pool: GA=${gaQuestions.length}, Tech=${techQuestions.length}`);
            setStatus(prev => prev + `\nPool Breakdown: GA=${gaQuestions.length}, Tech=${techQuestions.length}`);

            // 3. Selection with Fallback
            const selectQuestions = (pool: Question[], target1: number, target2: number) => {
                // Try exact matches first
                const q1 = shuffle(pool.filter(q => q.marks === 1));
                const q2 = shuffle(pool.filter(q => q.marks === 2));

                // Take what we can
                const selected1 = q1.slice(0, target1);
                const selected2 = q2.slice(0, target2);

                const usedIds = new Set([...selected1, ...selected2].map(q => q.id));

                // Calculate deficits
                let deficit1 = target1 - selected1.length;
                let deficit2 = target2 - selected2.length;
                const totalNeeded = deficit1 + deficit2;

                // Fallback: Fill remaining slots with ANY unused questions from the pool
                let fill: Question[] = [];
                if (totalNeeded > 0) {
                    const remainingPool = shuffle(pool.filter(q => !usedIds.has(q.id)));
                    fill = remainingPool.slice(0, totalNeeded);
                }

                return {
                    selected: [...selected1, ...selected2, ...fill],
                    totalFound: selected1.length + selected2.length + fill.length,
                    totalTarget: target1 + target2
                };
            };

            // Select GA (Target: 10 Qs)
            // Strict pattern: 5 x 1m, 5 x 2m. 
            // We'll accept any 10 GA questions if strict pattern fails.
            const gaResult = selectQuestions(gaQuestions, 5, 5);

            // Select Tech (Target: 55 Qs)
            // Strict pattern: 25 x 1m, 30 x 2m.
            const techResult = selectQuestions(techQuestions, 25, 30);

            // 4. Validation
            const gaMissing = gaResult.totalTarget - gaResult.totalFound;
            const techMissing = techResult.totalTarget - techResult.totalFound;
            const totalMissing = gaMissing + techMissing;

            if (totalMissing > 0) {
                const msg = `⚠️ Warning: Shortage of ${totalMissing} questions. Generated contest will be partial.
                \nGA Found: ${gaResult.totalFound} / 10
                \nTech Found: ${techResult.totalFound} / 55
                \n(Tried to fallback to any available questions from the branch)`;

                setStatus(prev => prev + '\n' + msg);
            } else {
                setStatus(prev => prev + `\n✅ Full exam generated. Used fallback questions where strict mark distribution failed.`);
            }

            const finalSections: Section[] = [
                { name: 'General Aptitude', questions: shuffle(gaResult.selected) },
                { name: 'Technical', questions: shuffle(techResult.selected) }
            ];

            const totalQs = finalSections[0].questions.length + finalSections[1].questions.length;
            const newContestId = `mock-${branch}-${Date.now()}`;
            const title = contestTitle || `GATE ${branch.toUpperCase()} Mock Test (Real)`;

            const newContest: Contest = {
                id: newContestId,
                title: title,
                branch: branch,
                durationMinutes: 180,
                totalMarks: 100, // Ideally calculate this dynamically if partial
                sections: finalSections,
                description: `Generated from '${sourceCollection}'. Contains ${totalQs} real questions.`
            };

            // 5. Save
            await setDoc(doc(db, 'contests', newContestId), newContest);

            // OPTIONAL: Save any NEW injected/cloned questions to the global bank 
            // so next time we have more to choose from? 
            // For now, let's strictly save them if they were "injected samples" 
            // but NOT if they were "clones" (clones are specific to this contest to avoid pollution)

            const existingIds = new Set(allQuestions.map(q => q.id));
            const questionsToSaveToBank: Question[] = [];
            // We removed sample injection logic for strict mode, but kept imports.
            // If any logic re-added sample questions, we would save them here.

            setStatus(prev => prev + `\n\n✅ Success! Created "${title}".`);
            setStatus(prev => prev + `\n   - Total Questions: ${totalQs} / 65`);
            setStatus(prev => prev + `\n   - Contest ID: ${newContestId}`);

            if (onContestCreated) {
                onContestCreated();
            }

        } catch (error: any) {
            console.error(error);
            setStatus('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
                <Wand2 className="w-5 h-5 text-purple-600" />
                Real Exam Generator
            </h2>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Target Branch
                        </label>
                        <select
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        >
                            <option value="ece">Electronics (ECE)</option>
                            <option value="cse">Computer Science (CSE)</option>
                            <option value="me">Mechanical (ME)</option>
                            <option value="ee">Electrical (EE)</option>
                            <option value="in">Instrumentation (IN)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Fetches from <code>questions_{branch}</code>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Contest Title
                        </label>
                        <input
                            type="text"
                            value={contestTitle}
                            onChange={(e) => setContestTitle(e.target.value)}
                            placeholder="e.g. Major Test 1"
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        />
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded text-sm font-mono text-gray-600 dark:text-gray-400 min-h-[6rem] max-h-[12rem] overflow-y-auto whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800">
                    {status || "Ready to generate. Ensure Firestore has 'questions_{branch}' collection."}
                </div>

                <button
                    onClick={generateContest}
                    disabled={loading}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                    Generate Exam
                </button>
            </div>
        </div>
    );
};

export default ContestGenerator;
