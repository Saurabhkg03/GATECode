"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, ExternalLink, FileText, Loader2, RotateCcw, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Contest, ContestAttempt } from '@/types/exam';
import CustomAlert from '@/components/ui/CustomAlert';

export default function ExamIntroPage() {
    const params = useParams();
    const contestId = params.contestId as string;
    const router = useRouter();
    const { user, loading } = useAuth();

    const [isRead, setIsRead] = useState(false);
    const [contest, setContest] = useState<Contest | null>(null);
    const [attempts, setAttempts] = useState<ContestAttempt[]>([]);
    const [fetchingAttempts, setFetchingAttempts] = useState(true);
    const [showReattemptConfirm, setShowReattemptConfirm] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!contestId || !user) return;

            try {
                // Fetch Contest
                const contestRef = doc(db, 'contests', contestId);
                const contestSnap = await getDoc(contestRef);

                if (contestSnap.exists()) {
                    setContest(contestSnap.data() as Contest);
                }

                // Query All Attempts for this contest and user
                const attemptsRef = collection(db, 'contest_attempts');
                const q = query(
                    attemptsRef,
                    where('contestId', '==', contestId),
                    where('uid', '==', user.uid)
                );
                const querySnap = await getDocs(q);
                const fetchedAttempts = querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContestAttempt));

                const sorted = fetchedAttempts.sort((a, b) => b.startedAt - a.startedAt);

                // Auto-close stale unsubmitted attempts:
                // If there is a submitted attempt that is newer than an unsubmitted one,
                // that unsubmitted one is orphaned and should be marked as submitted.
                const hasSubmittedAttempt = sorted.some(a => a.isSubmitted);
                const staleAttempts = sorted.filter(a => !a.isSubmitted);

                if (hasSubmittedAttempt && staleAttempts.length > 0) {
                    const now = Date.now();
                    await Promise.all(staleAttempts.map(att =>
                        updateDoc(doc(db, 'contest_attempts', att.id), {
                            isSubmitted: true,
                            timeLeftSeconds: 0,
                            lastUpdated: now
                        })
                    ));
                    // Mark as submitted locally too
                    sorted.forEach(a => { if (!a.isSubmitted) a.isSubmitted = true; });
                }

                setAttempts(sorted);
            } catch (e) {
                console.error("Failed to load exam data", e);
            } finally {
                setFetchingAttempts(false);
            }
        }
        fetchData();
    }, [contestId, user]);

    const activeAttempt = attempts.find(a => {
        if (a.isSubmitted) return false;
        // Check if time has expired (with a small 2-minute buffer for sync delays)
        if (contest) {
            const elapsedTime = (Date.now() - a.startedAt) / 1000;
            const originalDurationSeconds = contest.durationMinutes * 60;
            if (elapsedTime >= originalDurationSeconds + 120) {
                return false;
            }
        }
        return true;
    });

    // Mark all unsubmitted attempts as submitted to prevent stale "live" states
    const closeStaleAttempts = async () => {
        const staleAttempts = attempts.filter(a => !a.isSubmitted);
        const now = Date.now();
        await Promise.all(staleAttempts.map(att =>
            updateDoc(doc(db, 'contest_attempts', att.id), {
                isSubmitted: true,
                timeLeftSeconds: 0,
                lastUpdated: now
            })
        ));
        // Update local state to reflect submitted
        setAttempts(prev => prev.map(a => !a.isSubmitted ? { ...a, isSubmitted: true } : a));
    };

    const handleBegin = () => {
        // Only proceed if the user has confirmed they read the instructions
        if (isRead) {
            router.push(`/exam/${contestId}/live`);
        }
    };

    const handleReattempt = async () => {
        if (!user || !contestId) return;
        try {
            setFetchingAttempts(true);

            // Mark all stale unsubmitted attempts as submitted before starting fresh
            await closeStaleAttempts();

            // Clear local storage progress for this contest
            localStorage.removeItem(`gate_exam_progress_${contestId}`);
            localStorage.removeItem(`exam_target_time_${contestId}_${user.uid}`);

            router.push(`/exam/${contestId}/live?force_fresh=true`);
        } catch (e) {
            console.error("Failed to reset attempt", e);
        } finally {
            setFetchingAttempts(false);
            setShowReattemptConfirm(false);
        }
    };

    if (loading || !user) return <div className="h-screen bg-gray-50 dark:bg-zinc-950"></div>;

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100">
            {/* Header */}
            <header className="h-16 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 shadow-sm">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                    General Instructions
                </h1>
                <div className="flex items-center gap-4">
                    {contest && <span className="font-medium text-gray-600 dark:text-gray-400 hidden sm:block">{contest.title}</span>}
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-gray-300" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 border border-purple-200">
                            <User className="w-6 h-6" />
                        </div>
                    )}
                </div>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8 pb-10">

                    {attempts.length > 0 ? (
                        /* --- MULTI-ATTEMPT HISTORY VIEW --- */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black dark:text-white flex items-center gap-3">
                                    <RotateCcw className="w-6 h-6 text-purple-500" />
                                    Attempt History
                                </h2>
                                {!activeAttempt && (
                                    <button
                                        onClick={() => setShowReattemptConfirm(true)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Start New Attempt
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {attempts.map((att, idx) => {
                                    let isActiveAttempt = !att.isSubmitted;
                                    if (isActiveAttempt && contest) {
                                        const elapsedTime = (Date.now() - att.startedAt) / 1000;
                                        const originalDurationSeconds = contest.durationMinutes * 60;
                                        if (elapsedTime >= originalDurationSeconds + 120) {
                                            isActiveAttempt = false;
                                        }
                                    }

                                    return (
                                        <div
                                            key={att.id}
                                            className={`bg-white dark:bg-zinc-900 p-5 rounded-xl border dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:shadow-md ${isActiveAttempt ? 'ring-2 ring-blue-500/50 bg-blue-50/10' : ''}`}
                                        >
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${!isActiveAttempt ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 animate-pulse'}`}>
                                                    {!isActiveAttempt ? <CheckCircle className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-gray-900 dark:text-white">Attempt #{attempts.length - idx}</span>
                                                        {isActiveAttempt && <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Active</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {new Date(att.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Activities</p>
                                                    <p className="font-bold text-gray-700 dark:text-gray-300">{Object.keys(att.responses || {}).length} Questions</p>
                                                </div>

                                                {!isActiveAttempt ? (
                                                    <button
                                                        onClick={() => router.push(`/exam/${contestId}/result?attemptId=${att.id}`)}
                                                        className="px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-600 hover:text-white text-gray-700 dark:text-gray-200 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                                                    >
                                                        View Result
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleBegin}
                                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-sm shadow-xl shadow-blue-500/20 transform transition-all hover:-translate-y-0.5"
                                                    >
                                                        Resume Exam
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        /* --- INSTRUCTIONS VIEW --- */
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-sm border dark:border-zinc-800">
                            <h2 className="text-2xl font-bold mb-6 text-center border-b pb-4 dark:border-zinc-800">Please read the instructions carefully</h2>

                            <div className="space-y-6 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300">
                                <p><strong>General Instructions:</strong></p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>The clock has been set at the server and the countdown timer at the top right corner of your screen will display the time remaining for you to complete the exam.</li>
                                    <li>Palette status indicators for question navigation:</li>
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Reduced/Refined Palette Info */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded border bg-white flex items-center justify-center shrink-0">1</div>
                                            <span>Not Visited</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded border bg-red-500 text-white flex items-center justify-center shrink-0">3</div>
                                            <span>Not Answered</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded border bg-green-500 text-white flex items-center justify-center shrink-0">5</div>
                                            <span>Answered</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded border bg-purple-600 text-white flex items-center justify-center shrink-0">7</div>
                                            <span>Marked for Review</span>
                                        </div>
                                    </div>
                                </ol>

                                <p><strong>Navigating to a Question:</strong></p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>Click on <strong>Save & Next</strong> to save and move forward.</li>
                                    <li>Click on <strong>Mark for Review & Next</strong> to review later.</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer with Declaration - Only show for instructions */}
            {attempts.length === 0 && (
                <footer className="bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm checked:border-purple-600 checked:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 transition-all mt-0.5"
                                    checked={isRead}
                                    onChange={(e) => setIsRead(e.target.checked)}
                                />
                                <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-white opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                I have read and understood the instructions. I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test.
                            </span>
                        </label>

                        <button
                            onClick={handleBegin}
                            disabled={!isRead}
                            className={`
                                px-8 py-3 rounded text-white font-bold text-lg transition-all transform
                                ${isRead
                                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                                    : 'bg-gray-300 dark:bg-zinc-700 cursor-not-allowed'}
                            `}
                        >
                            I am ready to begin
                        </button>
                    </div>
                </footer>
            )}

            <CustomAlert
                isOpen={showReattemptConfirm}
                onClose={() => setShowReattemptConfirm(false)}
                title="Start New Attempt?"
                description="This will start a fresh attempt of the contest. Your existing results will be preserved in history. Are you sure?"
                type="confirm"
                confirmText="Yes, Start Fresh"
                onConfirm={handleReattempt}
            />

            {fetchingAttempts && (
                <div className="fixed inset-0 z-[110] bg-white/50 dark:bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                </div>
            )}
        </div>
    );
}
