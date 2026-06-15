"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ExamProvider, useExam } from '@/contexts/ExamContext';
import QuestionPalette from '@/components/exam/QuestionPalette';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import { Loader2, Timer, User, Menu, X, ChevronRight, ChevronLeft, Save, Flag, Trash2, Calculator, FileText } from 'lucide-react';
import VirtualCalculator from '@/components/exam/VirtualCalculator';
import VirtualNumpad from '@/components/exam/VirtualNumpad';
import ImageZoom from '@/components/ui/ImageZoom';
import QuestionPaperModal from '@/components/exam/QuestionPaperModal';
import CustomAlert from '@/components/ui/CustomAlert';
import ExamTimer from '@/components/exam/ExamTimer';

const LiveExamUI = () => {
    const { user } = useAuth();
    const { state, dispatch, submitExam, triggerSync } = useExam();
    // Ref to track intentional submission — prevents the browser "Leave site?" popup
    const isIntentionalSubmit = useRef(false);
    const {
        questions, sections, currentQuestionIndex, responses,
        timeLeft, isLoading, contest, isSubmitting, isSubmitted, isTimeUp, isSyncing
    } = state;

    // Keep ref in sync with isSubmitting state (set before page navigates away)
    useEffect(() => {
        if (isSubmitting) isIntentionalSubmit.current = true;
    }, [isSubmitting]);

    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false); // Mobile toggle
    const [showCalculator, setShowCalculator] = useState(false);
    const [showQuestionPaper, setShowQuestionPaper] = useState(false);
    const [showNavWarning, setShowNavWarning] = useState(false);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // --- Navigation Protection ---
    useEffect(() => {
        if (isSubmitted) return;

        // 1. Prevent refresh/tab close (Browser standard)
        // Skip the prompt if the student deliberately clicked "Final Submit"
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isIntentionalSubmit.current) return; // allow navigation silently
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

    // --- Tab / Window Visibility Monitoring ---
    useEffect(() => {
        if (isSubmitted) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount(prev => {
                    const next = prev + 1;

                    // Log the violation to Firestore (fire-and-forget)
                    const attemptId = state.attemptId;
                    if (attemptId) {
                        import('firebase/firestore').then(({ doc, updateDoc, arrayUnion }) => {
                            import('@/firebase').then(({ db }) => {
                                updateDoc(doc(db, 'contest_attempts', attemptId), {
                                    tabSwitchViolations: arrayUnion(Date.now())
                                }).catch(() => {/* silent */ });
                            });
                        });
                    }

                    return next;
                });

                setShowTabWarning(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isSubmitted, state.attemptId]);

    // --- Fullscreen Monitoring ---
    useEffect(() => {
        if (isSubmitted || isMobile) return;

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                // User exited fullscreen
                setIsFullscreen(false);
                setShowFullscreenWarning(true);

                // Log violation
                const attemptId = state.attemptId;
                if (attemptId) {
                    import('firebase/firestore').then(({ doc, updateDoc, arrayUnion }) => {
                        import('@/firebase').then(({ db }) => {
                            updateDoc(doc(db, 'contest_attempts', attemptId), {
                                fullscreenViolations: arrayUnion(Date.now())
                            }).catch(() => {/* silent */ });
                        });
                    });
                }
            } else {
                setIsFullscreen(true);
                setShowFullscreenWarning(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isSubmitted, isMobile, state.attemptId]);

    const enterFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.error("Error attempting to enable fullscreen:", err);
            // Fallback: let them proceed if browser blocks it entirely, 
            // but log to console. For actual exam, you might want strict blocking.
            setIsFullscreen(true);
        }
    };

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

    // Format time removed (moved to ExamTimer)

    if (state.error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950 p-4">
                <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-8 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <X className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Exam Error</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">{state.error}</p>
                    <button
                        onClick={() => window.location.href = '/contests'}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/25"
                    >
                        Return to Contests
                    </button>
                </div>
            </div>
        );
    }

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
                        Thank you for taking the contest. You can now view your detailed analysis and solutions.
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
            // Strict MCQ: Prevent deselection via clicking the same option again.
            if (selectedOpts.includes(optLabel)) return;

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
            {/* --- FULLSCREEN ENFORCEMENT OVERLAY --- */}
            {!isFullscreen && !isSubmitted && !isMobile && isLoading === false && contest && (
                <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
                    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                        <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⛶</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">
                            {showFullscreenWarning ? "Fullscreen Exited!" : "Enter Fullscreen"}
                        </h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            {showFullscreenWarning
                                ? "You have exited fullscreen mode. This incident has been logged. You must return to fullscreen to continue the exam."
                                : "This exam requires fullscreen mode to prevent distractions and ensure security. Please click the button below to begin."}
                        </p>
                        <button
                            onClick={enterFullscreen}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/25"
                        >
                            {showFullscreenWarning ? "Return to Fullscreen" : "Enter Fullscreen"}
                        </button>
                    </div>
                </div>
            )}

            {/* --- TIME UP AUTO-SUBMIT OVERLAY --- */}
            {isTimeUp && !isSubmitted && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                    <h2 className="2xl font-bold text-white mb-2">Time is up!</h2>
                    <p className="text-gray-300">Auto-submitting your answers securely...</p>
                </div>
            )}
            {/* --- Tab Switch Warning Banner --- */}
            {showTabWarning && (
                <div className="relative bg-red-600 text-white text-sm font-semibold px-4 py-2 flex items-center justify-between z-50 animate-in slide-in-from-top-2 duration-300">
                    <span>
                        ⚠️ Warning: You left the exam tab. Tab switches are logged and may lead to disqualification.
                        {tabSwitchCount > 1 && <span className="ml-2 opacity-80">({tabSwitchCount} violation{tabSwitchCount > 1 ? 's' : ''} recorded)</span>}
                    </span>
                    <button
                        onClick={() => setShowTabWarning(false)}
                        className="ml-4 p-1 rounded hover:bg-red-700 transition-colors"
                        aria-label="Dismiss warning"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

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
                    {user && <ExamTimer />}

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
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex flex-wrap items-center px-4 gap-2 shrink-0 z-20 pt-2 pb-0">
                <span className="text-sm font-semibold text-gray-500 mr-2 uppercase tracking-wide mb-2">Sections:</span>
                {sections.map((section, idx) => {
                    const secStats = section.questions.reduce((acc, q) => {
                        const s = responses[q.id]?.status || 'not_visited';
                        if (s === 'answered' || s === 'answered_marked_for_review') acc.attempted++;
                        else if (s === 'not_visited') acc.notVisited++;
                        else acc.notAttempted++;
                        return acc;
                    }, { attempted: 0, notAttempted: 0, notVisited: 0 });

                    return (
                        <div key={idx} className="group relative inline-block">
                            <button
                                onClick={() => {
                                    const firstQ = section.questions[0];
                                    const gIdx = questions.findIndex(q => q.id === firstQ.id);
                                    if (gIdx !== -1) dispatch({ type: 'SET_CURRENT_QUESTION', payload: gIdx });
                                }}
                                className={`
                                    px-4 py-2.5 mb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2
                                    ${selectedSectionIndex === idx
                                        ? 'border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-900/10'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}
                                `}
                            >
                                {section.name}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedSectionIndex === idx ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'}`}>
                                    {section.questions.length}
                                </span>
                            </button>

                            {/* Hover Tooltip */}
                            <div className="absolute top-full left-0 z-50 mt-1 hidden group-hover:block w-56 bg-gray-800 text-white text-sm rounded shadow-xl p-4 border border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="font-bold mb-2 border-b border-gray-600 pb-1">{section.name} Progress</div>
                                <div className="space-y-1.5 font-medium">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Attempted:</span>
                                        <span className="text-green-400 bg-green-400/10 px-1.5 rounded">{secStats.attempted}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Visited (Not Ans):</span>
                                        <span className="text-red-400 bg-red-400/10 px-1.5 rounded">{secStats.notAttempted}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Not Visited:</span>
                                        <span className="text-gray-400 bg-gray-600/30 px-1.5 rounded">{secStats.notVisited}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
                            <div
                                className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-lg leading-relaxed select-none mb-6"
                                onCopy={(e) => {
                                    e.preventDefault();
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <LatexRenderer content={extractAndCleanHtml(currentQuestion.question_html)} />
                            </div>

                            {/* Question Images */}
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

                            {/* Options / Inputs (Reverted to single pane, stacked below question) */}
                            <div className="space-y-3 mt-8">
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
                                                    w-6 h-6 flex items-center justify-center border shrink-0 mt-0.5 transition-colors
                                                    ${currentQuestion.question_type === 'mcq' ? 'rounded-full' : 'rounded'}
                                                    ${isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-gray-400 group-hover:border-blue-400'}
                                                `}>
                                                    {isSelected && (
                                                        currentQuestion.question_type === 'mcq' ? (
                                                            <div className="w-2.5 h-2.5 bg-white rounded-full" />
                                                        ) : (
                                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )
                                                    )}
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
                                        <label className="block w-full sm:w-2/3 lg:w-3/4 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                                            Enter your numerical answer:
                                        </label>
                                        <div className="flex flex-col">
                                            <input
                                                type="text"
                                                readOnly
                                                value={natAns}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.currentTarget.blur();
                                                        handleSaveNext();
                                                    }
                                                }}
                                                className="w-full sm:w-2/3 lg:w-3/4 p-4 text-2xl font-mono font-bold tracking-wider border-2 border-gray-300 dark:border-zinc-700 rounded-t-lg bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none cursor-default shadow-inner focus:border-blue-500 focus:ring-0"
                                                placeholder="-"
                                            />
                                            <div className="w-full sm:w-2/3 lg:w-3/4 rounded-b-lg overflow-hidden border-2 border-t-0 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
                                                <VirtualNumpad value={natAns} onChange={handleNatChange} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Bottom Action Bar */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 flex flex-wrap gap-2 items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                            <button
                                onClick={() => dispatch({ type: 'SET_CURRENT_QUESTION', payload: currentQuestionIndex - 1 })}
                                disabled={currentQuestionIndex === 0}
                                className="px-3 sm:px-4 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-50 focus:bg-gray-100 text-gray-700 disabled:text-gray-400 disabled:opacity-70 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:opacity-60 rounded border border-gray-300 dark:border-zinc-600 font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="inline">Previous</span>
                            </button>
                            <button
                                onClick={handleMarkReviewNext}
                                className="px-3 sm:px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded border border-purple-200 dark:border-purple-800 font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0"
                            >
                                <Flag className="w-4 h-4" />
                                <span className="hidden sm:inline">Mark for Review & Next</span>
                                <span className="sm:hidden">Review</span>
                            </button>
                            <button
                                onClick={handleClearResponse}
                                className="px-3 sm:px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 rounded border border-gray-300 dark:border-zinc-600 font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0"
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

    if (loading || !user) return <div className="h-screen bg-white dark:bg-zinc-950"></div>;

    return (
        <ExamProvider contestId={contestId} uid={user.uid}>
            <LiveExamUI />
        </ExamProvider>
    );
}
