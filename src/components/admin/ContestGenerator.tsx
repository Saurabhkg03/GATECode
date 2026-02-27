"use client";

import React, { useState } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { Contest, Question, Section } from '@/types/exam';
import { Loader2, Wand2, AlertTriangle, CheckCircle, Calendar, Clock } from 'lucide-react';
import { sampleQuestions } from '@/data/sampleQuestions';
import { useAuth } from '@/contexts/AuthContext';

interface ContestGeneratorProps {
    onContestCreated?: () => void;
    isAdminContest?: boolean;
}

const ContestGenerator: React.FC<ContestGeneratorProps> = ({ onContestCreated, isAdminContest = false }) => {
    const { userInfo } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [branch, setBranch] = useState('ece');
    const [contestTitle, setContestTitle] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');

    // Get local datetime string for min attribute (now)
    const getLocalDatetimeMin = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    const shuffle = <T,>(array: T[]) => array.sort(() => Math.random() - 0.5);

    const generateContest = async () => {
        setLoading(true);
        const sourceCollection = `questions_${branch}`;
        setStatus(`Fetching question bank from '${sourceCollection}'...`);

        try {
            let qCol = collection(db, sourceCollection);
            let qSnapshot = await getDocs(qCol);

            if (qSnapshot.empty) {
                qCol = collection(db, `${sourceCollection}/questions`);
                qSnapshot = await getDocs(qCol);
            }

            const allQuestions: Question[] = [];
            qSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.question_html || data.title) {
                    allQuestions.push({
                        id: docSnap.id,
                        ...data,
                        branch: data.branch || branch,
                        marks: Number(data.marks) || 1,
                        negative_marks: Number(data.negative_marks) || (Number(data.marks) === 2 ? 0.66 : 0.33)
                    } as Question);
                }
            });

            const relevantSamples = sampleQuestions.filter(q => {
                const br = (q.branch || '').toLowerCase();
                return br === branch.toLowerCase() || br === 'general' || br === 'ga' || br === 'all';
            });

            const fetchedQuestionIds = new Set(allQuestions.map(q => q.id));
            let injectedCount = 0;

            relevantSamples.forEach(sample => {
                if (!fetchedQuestionIds.has(sample.id)) {
                    allQuestions.push(sample as Question);
                    fetchedQuestionIds.add(sample.id);
                    injectedCount++;
                }
            });

            if (injectedCount > 0) {
                setStatus(prev => prev + `\nInjected ${injectedCount} sample questions.`);
            }

            const totalFound = allQuestions.length;
            setStatus(prev => prev + `\nTotal Pool Size: ${totalFound} (Real + Sample).`);

            if (totalFound < 5) {
                throw new Error(`Insufficient questions even with samples. Found ${totalFound}, need at least 5.`);
            }

            const gaQuestions = allQuestions.filter(q => {
                const sub = (q.subject || '').toLowerCase();
                const br = (q.branch || '').toLowerCase();
                return sub.includes('aptitude') || sub.includes('verbal') || sub.includes('reasoning') || br === 'general' || br === 'ga';
            });

            const techQuestions = allQuestions.filter(q =>
                !gaQuestions.includes(q) &&
                (q.branch?.toLowerCase() === branch.toLowerCase() || q.branch === 'all' || !q.branch)
            );

            setStatus(prev => prev + `\nPool Breakdown: GA=${gaQuestions.length}, Tech=${techQuestions.length}`);

            const selectQuestions = (pool: Question[], target1: number, target2: number) => {
                const q1 = shuffle(pool.filter(q => q.marks === 1));
                const q2 = shuffle(pool.filter(q => q.marks === 2));
                const selected1 = q1.slice(0, target1);
                const selected2 = q2.slice(0, target2);
                const usedIds = new Set([...selected1, ...selected2].map(q => q.id));
                const deficit1 = target1 - selected1.length;
                const deficit2 = target2 - selected2.length;
                const totalNeeded = deficit1 + deficit2;
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

            const gaResult = selectQuestions(gaQuestions, 5, 5);
            const techResult = selectQuestions(techQuestions, 25, 30);

            const gaMissing = gaResult.totalTarget - gaResult.totalFound;
            const techMissing = techResult.totalTarget - techResult.totalFound;
            const totalMissing = gaMissing + techMissing;

            if (totalMissing > 0) {
                setStatus(prev => prev + `\n⚠️ Warning: Shortage of ${totalMissing} questions.\nGA Found: ${gaResult.totalFound}/10, Tech Found: ${techResult.totalFound}/55`);
            } else {
                setStatus(prev => prev + `\n✅ Full exam generated.`);
            }

            const finalSections: Section[] = [
                { name: 'General Aptitude', questions: shuffle(gaResult.selected) },
                { name: 'Technical', questions: shuffle(techResult.selected) }
            ];

            const totalQs = finalSections[0].questions.length + finalSections[1].questions.length;
            const prefix = isAdminContest ? 'admin' : 'mock';
            const newContestId = `${Date.now()}-${prefix}-${branch}`;
            const defaultTitle = `GATE ${branch.toUpperCase()} ${isAdminContest ? 'Live Competition' : 'Mock Practice'} (Real)`;
            const title = contestTitle || defaultTitle;

            // Build the scheduled start time ISO string if provided
            let startTimeISO: string | undefined = undefined;
            let endTimeISO: string | undefined = undefined;
            if (enableSchedule && scheduledDateTime) {
                startTimeISO = new Date(scheduledDateTime).toISOString();
            }
            if (enableSchedule && endDateTime) {
                endTimeISO = new Date(endDateTime).toISOString();
            }

            const newContest: Contest = {
                id: newContestId,
                title: title,
                type: isAdminContest ? 'admin' : 'mock',
                branch: branch,
                createdBy: userInfo?.uid || 'anonymous',
                isPublic: isAdminContest ? true : isPublic,
                durationMinutes: 180,
                totalMarks: 100,
                sections: finalSections,
                description: `Generated from '${sourceCollection}'. Contains ${totalQs} real questions.`,
                ...(startTimeISO && { startTime: startTimeISO }),
                ...(endTimeISO && { endTime: endTimeISO }),
            };

            await setDoc(doc(db, 'contests', newContestId), newContest);

            setStatus(prev => prev + `\n\n✅ Success! Created "${title}".`);
            setStatus(prev => prev + `\n   - Total Questions: ${totalQs} / 65`);
            if (startTimeISO) {
                setStatus(prev => prev + `\n   - Starts: ${new Date(startTimeISO).toLocaleString()}`);
            }
            if (endTimeISO) {
                setStatus(prev => prev + `\n   - Ends:   ${new Date(endTimeISO).toLocaleString()}`);
            }

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
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-5">
            <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <Wand2 className="w-5 h-5 text-purple-600" />
                Real Exam Generator
            </h2>

            {/* Row 1: Branch + Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target Branch
                    </label>
                    <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full p-2.5 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none transition"
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
                        className="w-full p-2.5 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none transition"
                    />
                </div>
            </div>

            {/* Schedule Toggle */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setEnableSchedule(!enableSchedule)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${enableSchedule
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-700/40'
                        : 'bg-gray-50 dark:bg-zinc-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Start Date & Time
                        {!enableSchedule && (
                            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                                (optional — leave off to allow immediate access)
                            </span>
                        )}
                    </span>
                    <span className={`w-8 h-4 rounded-full transition-colors flex items-center ${enableSchedule ? 'bg-amber-500' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                        <span className={`w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${enableSchedule ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                </button>

                {enableSchedule && (
                    <div className="px-4 py-4 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-600 dark:text-amber-400" />
                                    Contest Start Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledDateTime}
                                    onChange={(e) => setScheduledDateTime(e.target.value)}
                                    min={getLocalDatetimeMin()}
                                    className="w-full p-2.5 border border-amber-200 dark:border-amber-700/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none transition cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    <Clock className="w-3.5 h-3.5 inline mr-1 text-red-500 dark:text-red-400" />
                                    Contest End Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={endDateTime}
                                    onChange={(e) => setEndDateTime(e.target.value)}
                                    min={scheduledDateTime || getLocalDatetimeMin()}
                                    className="w-full p-2.5 border border-red-200 dark:border-red-700/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-red-400 outline-none transition cursor-pointer"
                                />
                            </div>
                        </div>
                        {scheduledDateTime && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/30 rounded-lg px-3 py-2">
                                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                    Contest will be locked until{' '}
                                    <strong>{new Date(scheduledDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
                                    A live countdown will be shown on the contest card.
                                </span>
                            </div>
                        )}
                        {!scheduledDateTime && (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                Please pick a date and time above to schedule the contest.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Public Toggle (non-admin only) */}
            {!isAdminContest && (
                <div className="flex items-center gap-2.5">
                    <input
                        type="checkbox"
                        id="isPublic"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Publish to Community (Visible to everyone)
                    </label>
                </div>
            )}

            {/* Status Log */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl text-sm font-mono text-gray-600 dark:text-gray-400 min-h-[6rem] max-h-[12rem] overflow-y-auto whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800">
                {status || "Ready to generate. Ensure Firestore has a 'questions_{branch}' collection."}
            </div>

            {/* Generate Button */}
            <button
                onClick={generateContest}
                disabled={loading || (enableSchedule && !scheduledDateTime)}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-sm"
            >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                {loading ? 'Generating…' : 'Generate Exam'}
            </button>

            {enableSchedule && !scheduledDateTime && (
                <p className="text-xs text-center text-red-500 dark:text-red-400 -mt-2">
                    Please set a start date &amp; time before generating.
                </p>
            )}
        </div>
    );
};

export default ContestGenerator;
