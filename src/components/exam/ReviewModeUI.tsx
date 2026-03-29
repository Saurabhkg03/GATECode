"use client";

import React, { useState, useEffect } from 'react';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import ImageZoom from '@/components/ui/ImageZoom';
import { ChevronLeft, ChevronRight, X, CheckCircle, XCircle, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

export default function ReviewModeUI({ questionAnalysis, contest, onExit }: any) {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [savingBookmark, setSavingBookmark] = useState(false);

    if (!questionAnalysis || questionAnalysis.length === 0) return null;

    const currentQA = questionAnalysis[currentIndex];
    const { question, response, isCorrect, isAttempted, userVal } = currentQA;

    useEffect(() => {
        // Find which section this question belongs to
        if (contest?.sections) {
            const sIdx = contest.sections.findIndex((s: any) => s.questions.some((q: any) => q.id === question.id));
            if (sIdx !== -1 && sIdx !== selectedSectionIndex) {
                setSelectedSectionIndex(sIdx);
            }
        }
    }, [currentIndex, contest, question.id]);

    useEffect(() => {
        // Check if bookmarked
        if (user && question.id) {
            const checkBookmark = async () => {
                try {
                    const docRef = doc(db, 'users', user.uid, 'bookmarks', question.id);
                    const snap = await getDoc(docRef);
                    setIsBookmarked(snap.exists());
                } catch (e) { console.error("Error checking bookmark:", e); }
            };
            checkBookmark();
        }
    }, [user, question.id]);

    const handleToggleBookmark = async () => {
        if (!user || savingBookmark) return;
        setSavingBookmark(true);
        try {
            const batch = writeBatch(db);
            const docRef = doc(db, 'users', user.uid, 'bookmarks', question.id);
            const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, question.id);
            const favoritesListRef = doc(db, `users/${user.uid}/questionLists`, 'favorites');

            if (isBookmarked) {
                batch.delete(docRef);
                batch.set(userQuestionDataRef, { isFavorite: false }, { merge: true });
                batch.update(favoritesListRef, { questionIds: arrayRemove(question.id) });
                setIsBookmarked(false);
            } else {
                batch.set(docRef, {
                    ...question,
                    bookmarkedAt: Date.now(),
                    contestId: contest.id,
                    contestTitle: contest.title
                });
                batch.set(userQuestionDataRef, { isFavorite: true }, { merge: true });
                batch.set(favoritesListRef, {
                    questionIds: arrayUnion(question.id),
                    name: "Favorites",
                    uid: user.uid,
                    createdAt: serverTimestamp()
                }, { merge: true });
                setIsBookmarked(true);
            }
            await batch.commit();
        } catch (e) {
            console.error("Error toggling bookmark:", e);
        } finally {
            setSavingBookmark(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col h-screen bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 z-10">
                <div className="font-bold text-lg truncate flex items-center gap-2">
                    <span className="text-purple-600">Review Mode</span>
                    <span className="text-gray-400">|</span>
                    <span className="truncate">{contest?.title}</span>
                </div>
                <button onClick={onExit} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors">
                    <X className="w-4 h-4" /> Exit Review
                </button>
            </header>

            {/* --- SUB HEADER (SECTIONS) --- */}
            {contest?.sections && (
                <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex flex-wrap items-center px-4 gap-2 shrink-0 z-20 pt-2 pb-0">
                    <span className="text-sm font-semibold text-gray-500 mr-2 uppercase tracking-wide mb-2">Sections:</span>
                    {contest.sections.map((section: any, idx: number) => {
                        // Calculate stats for this section
                        const sectionQIds = section.questions.map((q: any) => q.id);
                        const secResults = questionAnalysis.filter((qa: any) => sectionQIds.includes(qa.question.id));

                        const attempted = secResults.filter((r: any) => r.isAttempted).length;
                        const notAttempted = secResults.filter((r: any) => !r.isAttempted).length;

                        return (
                            <div key={idx} className="group relative inline-block">
                                <button
                                    onClick={() => {
                                        const firstQ = section.questions[0];
                                        const gIdx = questionAnalysis.findIndex((qa: any) => qa.question.id === firstQ.id);
                                        if (gIdx !== -1) setCurrentIndex(gIdx);
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
                                            <span className="text-blue-400 bg-blue-400/10 px-1.5 rounded">{attempted}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-300">Not Attempted:</span>
                                            <span className="text-gray-400 bg-gray-600/30 px-1.5 rounded">{notAttempted}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Pane */}
                <main className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden relative border-r dark:border-zinc-800">
                    <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50 shrink-0">
                        <h2 className="text-lg font-bold">Question No. {currentIndex + 1}</h2>
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <button
                                onClick={handleToggleBookmark}
                                disabled={savingBookmark}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${isBookmarked ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700'}`}
                            >
                                <Star className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                <span className="hidden sm:inline">{isBookmarked ? 'Saved' : 'Save for Later'}</span>
                            </button>
                            <span className="w-px h-4 bg-gray-300 dark:bg-zinc-700 mx-1"></span>
                            <span className="text-gray-500">Type: <span className="uppercase">{question.question_type}</span></span>
                            <span className="w-px h-4 bg-gray-300 dark:bg-zinc-700 mx-1"></span>
                            <span className="text-green-600">+{question.marks} Marks</span>
                            <span className="text-red-500">-{question.negative_marks || 0} Neg</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="max-w-4xl mx-auto pb-20">
                            {/* Question Body */}
                            <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-lg leading-relaxed select-none mb-6">
                                <LatexRenderer content={extractAndCleanHtml(question.question_html)} />
                            </div>

                            {/* Images */}
                            {question.question_image_links && question.question_image_links.length > 0 && (
                                <div className="space-y-6 mb-8 flex flex-col items-center">
                                    {question.question_image_links.map((link: string, idx: number) => (
                                        <ImageZoom key={idx} src={link} alt={`Figure ${idx + 1}`} className="max-h-[400px]" />
                                    ))}
                                </div>
                            )}

                            {/* Options Area */}
                            <div className="mt-8 space-y-3">
                                {question.question_type === 'nat' ? (
                                    <div className="flex gap-4 items-center flex-wrap mb-6">
                                        <div className={`p-4 rounded border font-mono ${!isAttempted ? 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700' : (isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800')}`}>
                                            <span className="text-xs text-gray-500 block mb-1">Your Answer</span>
                                            <span className="font-bold text-xl">{isAttempted ? userVal : '-'}</span>
                                        </div>
                                        <div className="p-4 rounded border bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 font-mono">
                                            <span className="text-xs text-green-600 dark:text-green-400 block mb-1">Correct Range</span>
                                            <span className="font-bold text-green-800 dark:text-green-300 text-xl">{question.nat_answer_min} - {question.nat_answer_max}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mb-6">
                                        {question.options?.map((opt: any, oIdx: number) => {
                                            const isUserSelected = response?.selectedOptions?.includes(opt.label);
                                            const isOptCorrect = opt.is_correct;

                                            let optColor = "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700";
                                            if (isOptCorrect) {
                                                optColor = "bg-green-50 dark:bg-green-900/20 border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,1)]";
                                            } else if (isUserSelected && !isOptCorrect) {
                                                optColor = "bg-red-50 dark:bg-red-900/20 border-red-500";
                                            }

                                            return (
                                                <div key={opt.label} className={`flex items-start p-4 rounded-xl border-2 transition-all ${optColor}`}>
                                                    <div className="flex-shrink-0 mt-0.5 w-6 flex justify-center">
                                                        <span className={`font-bold ${isOptCorrect ? 'text-green-600' : (isUserSelected ? 'text-red-500' : 'text-gray-500')}`}>{opt.label}.</span>
                                                    </div>
                                                    <div className={`ml-3 flex-1 prose-sm sm:prose dark:prose-invert max-w-none ${isOptCorrect ? 'text-green-900 dark:text-green-100' : (isUserSelected ? 'text-red-900 dark:text-red-100' : '')}`}>
                                                        <LatexRenderer content={opt.text_html || ""} />
                                                    </div>
                                                    <div className="flex-shrink-0 ml-3">
                                                        {isOptCorrect && <CheckCircle className="w-6 h-6 text-green-500" />}
                                                        {isUserSelected && !isOptCorrect && <XCircle className="w-6 h-6 text-red-500" />}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Explanation */}
                            {question.explanation_html && (
                                <div className="mt-8 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-900/30 p-6">
                                    <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                                        <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                                        Detailed Solution
                                    </h3>
                                    <div className="prose dark:prose-invert max-w-none text-blue-900 dark:text-blue-100">
                                        <LatexRenderer content={extractAndCleanHtml(question.explanation_html)} />
                                    </div>
                                    {question.explanation_image_links && question.explanation_image_links.length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            {question.explanation_image_links.map((link: string, idx: number) => (
                                                <ImageZoom key={idx} src={link} alt={`Explanation Figure ${idx + 1}`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="h-16 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 w-full shadow-[0_-4px_20px_rgba(0,0,0,0.05)] text-sm mt-auto">
                        <button
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            disabled={currentIndex === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded shadow-sm transition-colors border border-gray-200 dark:border-zinc-700 font-semibold disabled:opacity-50"
                        >
                            <ChevronLeft className="w-5 h-5 mx-[-4px]" /> Previous
                        </button>
                        <button
                            onClick={() => setCurrentIndex(Math.min(questionAnalysis.length - 1, currentIndex + 1))}
                            disabled={currentIndex === questionAnalysis.length - 1}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-colors font-semibold disabled:opacity-50"
                        >
                            Next <ChevronRight className="w-5 h-5 mx-[-4px]" />
                        </button>
                    </div>
                </main>

                {/* Right Pane (Palette) */}
                <aside className="w-80 bg-white dark:bg-zinc-900 border-l dark:border-zinc-800 hidden lg:flex lg:flex-col h-full">
                    <div className="p-4 bg-gray-50 dark:bg-zinc-900 border-b dark:border-zinc-800">
                        <h3 className="font-bold text-lg dark:text-white">Questions Review</h3>
                    </div>
                    {/* Legend */}
                    <div className="p-3 bg-white dark:bg-zinc-900 text-xs border-b dark:border-zinc-800 grid grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Correct</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Wrong</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-sm"></div> Not Attempted</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="grid grid-cols-5 gap-2">
                            {questionAnalysis.map((qa: any, idx: number) => {
                                let colorClass = "bg-white text-gray-600 border-gray-300 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700"; // not attempted
                                if (qa.isAttempted) {
                                    if (qa.isCorrect) colorClass = "bg-green-500 text-white border-green-600 dark:border-green-700";
                                    else colorClass = "bg-red-500 text-white border-red-600 dark:border-red-700";
                                }

                                const isCurrent = idx === currentIndex;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`h-10 w-10 text-sm font-semibold rounded shadow-sm flex items-center justify-center border transition-all ${colorClass} ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-zinc-900 scale-110 z-10' : 'hover:opacity-80'}`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
