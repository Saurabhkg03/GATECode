"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ExamProvider, useExam } from '@/contexts/ExamContext';
import QuestionPalette from '@/components/exam/QuestionPalette';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import { Loader2, Timer, User, Menu, X, ChevronRight, ChevronLeft, Save, Flag, Trash2, Calculator, FileText } from 'lucide-react';
import VirtualCalculator from '@/components/exam/VirtualCalculator';
import ImageZoom from '@/components/ui/ImageZoom';
import QuestionPaperModal from '@/components/exam/QuestionPaperModal';
import CustomAlert from '@/components/ui/CustomAlert';

const LiveExamUI = () => {
    const { state, dispatch, submitExam, triggerSync } = useExam();
    const {
        questions, sections, currentQuestionIndex, responses,
        timeLeft, isLoading, contest, isSubmitting, isSubmitted, isSyncing
    } = state;

    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false); // Mobile toggle
    const [showCalculator, setShowCalculator] = useState(false);
    const [showQuestionPaper, setShowQuestionPaper] = useState(false);
    const [showNavWarning, setShowNavWarning] = useState(false);

    // --- Navigation Protection ---
    useEffect(() => {
        if (isSubmitted) return;

        // 1. Prevent refresh/tab close (Browser standard)
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Required for most browsers
        };

        // 2. Prevent Back Button
        const handlePopState = (e: PopStateEvent) => {
            // Push state back to prevent navigation
            window.history.pushState(null, '', window.location.href);
            setShowNavWarning(true);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Initial push to history to create a "previous" state we can intercept
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isSubmitted]);

    // Sync section selection with current question
    useEffect(() => {
        if (questions.length > 0) {
            const currentQ = questions[currentQuestionIndex];
            // Find which section this Q belongs to
            const sIdx = sections.findIndex(s => s.questions.some(q => q.id === currentQ.id));
            if (sIdx !== -1 && sIdx !== selectedSectionIndex) {
                setSelectedSectionIndex(sIdx);
            }

            // Mark as visited if not already
            const status = responses[currentQ.id]?.status;
            if (!status || status === 'not_visited') {
                dispatch({ type: 'VISIT_QUESTION', payload: { questionId: currentQ.id } });
            }
        }
    }, [currentQuestionIndex, questions, sections, responses, dispatch]);

    // Format time
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (isLoading || !contest) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading your exam environment...</p>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950">
                <div className="text-center max-w-md p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-600 mb-4">Exam Submitted Successfully!</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Thank you for taking the mock test. You can now view your detailed analysis and solutions.
                    </p>
                    <a
                        href={`/exam/${contest.id}/result`}
                        className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded hover:bg-purple-700 transition"
                    >
                        View Result
                    </a>
                </div>
            </div>
        )
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return <div>Error loading question.</div>;

    const currentResponse = responses[currentQuestion.id];
    const selectedOpts = currentResponse?.selectedOptions || [];
    const natAns = currentResponse?.natAnswer || '';


    // --- Actions ---

    const handleOptionSelect = (optLabel: string) => {
        if (currentQuestion.question_type === 'mcq') {
            dispatch({
                type: 'MARK_ANSWER',
                payload: { questionId: currentQuestion.id, selectedOptions: [optLabel] }
            });
        } else if (currentQuestion.question_type === 'msq') {
            const newOpts = selectedOpts.includes(optLabel)
                ? selectedOpts.filter(o => o !== optLabel)
                : [...selectedOpts, optLabel];
            dispatch({
                type: 'MARK_ANSWER',
                payload: { questionId: currentQuestion.id, selectedOptions: newOpts }
            });
        }
    };

    const handleNatChange = (val: string) => {
        // Strict NAT Validation: ^-?\d*\.?\d*$
        // Allows: "-", "-5", "5", "5.", "5.5", ".5"
        // Rejects: "abc", "5..5", "5-5", "e", "+", etc.
        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
            dispatch({
                type: 'MARK_ANSWER',
                payload: { questionId: currentQuestion.id, selectedOptions: [], natAnswer: val }
            });
        }
    };

    const handleSaveNext = () => {
        // Optimistic UI: Sync happens in background via triggerSync
        triggerSync();
        if (currentQuestionIndex < questions.length - 1) {
            dispatch({ type: 'SET_CURRENT_QUESTION', payload: currentQuestionIndex + 1 });
        }
    };

    const handleMarkReviewNext = () => {
        dispatch({ type: 'MARK_REVIEW', payload: { questionId: currentQuestion.id } });
        triggerSync();
        if (currentQuestionIndex < questions.length - 1) {
            dispatch({ type: 'SET_CURRENT_QUESTION', payload: currentQuestionIndex + 1 });
        }
    };

    const handleClearResponse = () => {
        dispatch({ type: 'CLEAR_RESPONSE', payload: { questionId: currentQuestion.id } });
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden select-none overscroll-none">
            {/* --- TOP HEADER --- */}
            <header className="h-14 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 z-10">
                <div className="font-bold text-lg truncate flex items-center gap-2">
                    <span className="hidden sm:inline text-purple-600">GATE 2025</span>
                    <span className="text-gray-400 hidden sm:inline">|</span>
                    <span className="truncate max-w-[200px] sm:max-w-md">{contest.title}</span>
                </div>

                {/* Cloud Sync Status */}
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium mr-auto ml-4">
                    {isSyncing ? (
                        <span className="text-gray-400 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
                        </span>
                    ) : (
                        <span className="text-green-500 flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity" title="Answers synced to cloud">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Saved
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md border dark:border-zinc-700">
                        <Timer className={`w-4 h-4 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} />
                        <span className={`font-mono font-bold text-lg ${timeLeft < 300 ? 'text-red-600' : ''}`}>
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Left</span>
                    </div>


                    <div className="hidden sm:flex items-center gap-2">
                        {/* Question Paper Button */}
                        <button
                            onClick={() => setShowQuestionPaper(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                            title="View Full Question Paper"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden lg:inline">Question Paper</span>
                        </button>

                        <button
                            onClick={() => setShowCalculator(!showCalculator)}
                            className={`p-2 rounded-full transition-colors ${showCalculator ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                            title="Scientific Calculator"
                        >
                            <Calculator className="w-5 h-5" />
                        </button>

                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300">
                            <User className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Mobile Palette Toggle */}
                    <button
                        className="sm:hidden p-2"
                        onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                    >
                        {isPaletteOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </header>

            {/* --- SUB HEADER (SECTIONS) --- */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex items-center px-4 overflow-x-auto gap-1 shrink-0 no-scrollbar z-10">
                <span className="text-sm font-semibold text-gray-500 mr-2 uppercase tracking-wide">Sections:</span>
                {sections.map((section, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            const firstQ = section.questions[0];
                            const gIdx = questions.findIndex(q => q.id === firstQ.id);
                            if (gIdx !== -1) dispatch({ type: 'SET_CURRENT_QUESTION', payload: gIdx });
                        }}
                        className={`
                            px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                            ${selectedSectionIndex === idx
                                ? 'border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-900/10'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}
                        `}
                    >
                        {section.name}
                        <span className="ml-2 text-xs bg-gray-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-600 dark:text-gray-400">
                            {section.questions.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* LEFT: QUESTION AREA */}
                <main className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden relative border-r dark:border-zinc-800">

                    {/* Fixed Question Header */}
                    <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50 shrink-0">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                            Question No. {currentQuestionIndex + 1}
                        </h2>
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <span className="text-gray-500 dark:text-gray-400">
                                Type: <span className="text-gray-900 dark:text-gray-200 uppercase">{currentQuestion.question_type}</span>
                            </span>
                            <span className="w-px h-4 bg-gray-300 dark:bg-zinc-700"></span>
                            <span className="text-green-600">
                                +{currentQuestion.marks} Marks
                            </span>
                            <span className="text-red-500">
                                -{currentQuestion.negative_marks || 0} Neg
                            </span>
                        </div>
                    </div>

                    {/* SCROLLABLE CONTENT BODY */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="max-w-4xl mx-auto pb-20">
                            {/* Question Text */}
                            <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-lg leading-relaxed select-text mb-6">
                                <LatexRenderer content={extractAndCleanHtml(currentQuestion.question_html)} />
                            </div>

                            {/* Question Images (NEW) */}
                            {currentQuestion.question_image_links && currentQuestion.question_image_links.length > 0 && (
                                <div className="space-y-6 mb-8 flex flex-col items-center">
                                    {currentQuestion.question_image_links.map((link, idx) => (
                                        <ImageZoom
                                            key={idx}
                                            src={link}
                                            alt={`Question Figure ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Options / Inputs */}
                            <div className="space-y-3">
                                {(currentQuestion.question_type === 'mcq' || currentQuestion.question_type === 'msq') && (
                                    currentQuestion.options?.map((opt, idx) => {
                                        const isSelected = selectedOpts.includes(opt.label);
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleOptionSelect(opt.label)}
                                                className={`
                                                    flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all group
                                                    ${isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md transform scale-[1.01]'
                                                        : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'}
                                                `}
                                            >
                                                <div className={`
                                                    w-6 h-6 rounded-full flex items-center justify-center border shrink-0 mt-0.5 transition-colors
                                                    ${isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-gray-400 group-hover:border-blue-400'}
                                                `}>
                                                    {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="font-bold mr-2 text-gray-500 dark:text-gray-400">{opt.label}.</span>
                                                    <div className="inline-block prose dark:prose-invert">
                                                        <LatexRenderer content={extractAndCleanHtml(opt.text_html)} inline />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}

                                {currentQuestion.question_type === 'nat' && (
                                    <div className="mt-6">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Enter your numerical answer:
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={natAns}
                                            onChange={(e) => handleNatChange(e.target.value)}
                                            onPaste={(e) => {
                                                const pastedData = e.clipboardData.getData('text');
                                                if (!/^-?\d*\.?\d*$/.test(pastedData)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            className="w-full sm:w-1/2 p-4 text-xl font-mono border-2 border-gray-300 dark:border-zinc-700 rounded focus:border-blue-500 focus:ring-0 dark:bg-zinc-900 dark:text-white"
                                            placeholder="Type answer here..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Bottom Action Bar */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 flex flex-wrap gap-2 items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={handleMarkReviewNext}
                                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded border border-purple-200 dark:border-purple-800 font-semibold flex items-center gap-2 transition-colors"
                            >
                                <Flag className="w-4 h-4" />
                                <span className="hidden sm:inline">Mark for Review & Next</span>
                                <span className="sm:hidden">Review</span>
                            </button>
                            <button
                                onClick={handleClearResponse}
                                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 rounded border border-gray-300 dark:border-zinc-600 font-semibold flex items-center gap-2 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Clear Response</span>
                                <span className="sm:hidden">Clear</span>
                            </button>
                        </div>

                        <button
                            onClick={handleSaveNext}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <span className="hidden sm:inline">Save & Next</span>
                            <span className="sm:hidden">Next</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </main>

                {/* RIGHT: PALETTE (Responsive) */}
                <aside className={`
                    w-80 bg-white dark:bg-zinc-900 border-l dark:border-zinc-800 absolute right-0 top-0 bottom-0 z-30 transform transition-transform duration-300 ease-in-out
                    ${isPaletteOpen ? 'translate-x-0' : 'translate-x-full'}
                    sm:static sm:translate-x-0 sm:block overflow-y-auto
                `}>
                    <QuestionPalette />
                </aside>

                {/* Overlay for mobile palette */}
                {isPaletteOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-20 sm:hidden"
                        onClick={() => setIsPaletteOpen(false)}
                    ></div>
                )}
            </div>



            <VirtualCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
            <QuestionPaperModal
                isOpen={showQuestionPaper}
                onClose={() => setShowQuestionPaper(false)}
                questions={state.questions}
                sections={state.sections}
                contestTitle={contest.title}
            />

            <CustomAlert
                isOpen={!!state.error}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                title="Error"
                description={state.error || "An unknown error occurred."}
                type="error"
                confirmText="OK"
            />

            <CustomAlert
                isOpen={showNavWarning}
                onClose={() => setShowNavWarning(false)}
                title="Navigation Restricted"
                description="You cannot leave the exam page while the test is in progress. Please use the 'Submit' button in the question palette to finish your exam."
                type="warning"
                confirmText="I Understand"
            />
        </div>
    );
};

export default function ExamPage() {
    const params = useParams();
    const contestId = params.contestId as string;
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/login?redirect=/exam/${contestId}/live`);
        }
    }, [user, loading, router, contestId]);

    if (loading || !user) return <div className="h-screen bg-white dark:bg-zinc-950"></div>;

    return (
        <ExamProvider contestId={contestId} uid={user.uid}>
            <LiveExamUI />
        </ExamProvider>
    );
}
