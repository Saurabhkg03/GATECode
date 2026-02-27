"use client";

import React, { useState, useMemo } from 'react';
import { useExam } from '../../contexts/ExamContext';
import { getPaletteColor } from '../../types/exam';

const QuestionPalette = () => {
    const { state, dispatch, submitExam } = useExam();
    const { questions, responses, currentQuestionIndex, sections } = state;
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);

    const stats = useMemo(() => {
        let answered = 0;
        let notAnswered = 0;
        let marked = 0;
        let notVisited = 0;

        questions.forEach(q => {
            const status = responses[q.id]?.status || 'not_visited';
            if (status === 'answered') answered++;
            else if (status === 'not_answered') notAnswered++;
            else if (status === 'not_visited') notVisited++;
            else if (status === 'marked_for_review') marked++;
            else if (status === 'answered_marked_for_review') {
                answered++;
                marked++;
            }
        });

        return {
            total: questions.length,
            answered,
            notAnswered: notAnswered + notVisited,
            marked
        };
    }, [questions, responses]);

    const legendStats = useMemo(() => {
        const counts = {
            answered: 0,
            notAnswered: 0,
            notVisited: 0,
            marked: 0,
            answeredMarked: 0
        };
        questions.forEach(q => {
            const status = responses[q.id]?.status || 'not_visited';
            if (status === 'answered') counts.answered++;
            else if (status === 'not_answered') counts.notAnswered++;
            else if (status === 'not_visited') counts.notVisited++;
            else if (status === 'marked_for_review') counts.marked++;
            else if (status === 'answered_marked_for_review') counts.answeredMarked++;
        });
        return counts;
    }, [questions, responses]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l dark:border-zinc-800 shadow-lg overflow-hidden transition-colors">
            {/* ... (Header and Legend parts remain strictly same) */}

            {/* Header */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-900 border-b dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg dark:text-white">Question Palette</h3>
                </div>

                {/* User Info (Placeholder) */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        U
                    </div>
                    <div className="text-sm font-medium dark:text-gray-300">Candidate Name</div>
                </div>
            </div>

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {sections.map((section, sIdx) => {
                    return (
                        <div key={sIdx} className="mb-6">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-900">
                                {section.name}
                            </h4>
                            <div className="grid grid-cols-4 gap-2">
                                {section.questions.map((q) => {
                                    const qid = q.id;
                                    // Find global index
                                    const globalIndex = questions.findIndex(globalQ => globalQ.id === qid);
                                    if (globalIndex === -1) return null;

                                    const status = responses[qid]?.status || 'not_visited';
                                    const isCurrent = globalIndex === currentQuestionIndex;

                                    // Exact GATE color mapping
                                    let baseClass = "relative h-10 w-10 text-sm font-semibold rounded shadow-sm flex items-center justify-center border transition-all ";

                                    // Default White (Not Visited)
                                    let colorClass = "bg-white text-black border-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700";

                                    if (status === 'not_answered') {
                                        // Red (Visited but not answered) -- Using exact GATE red tone
                                        colorClass = "bg-[#d9534f] text-white border-[#d43f3a] hover:bg-[#c9302c]";
                                    }
                                    else if (status === 'answered') {
                                        // Green (Answered)
                                        colorClass = "bg-[#5cb85c] text-white border-[#4cae4c] hover:bg-[#449d44]";
                                    }
                                    else if (status === 'marked_for_review') {
                                        // Purple (Marked for Review)
                                        colorClass = "bg-[#5bc0de] text-white border-[#46b8da] hover:bg-[#31b0d5] bg-purple-600 border-purple-700 hover:bg-purple-700";
                                        // Actually GATE uses purple. The 'info' blue is for bootstrap. Let's stick to Purple.
                                        colorClass = "bg-purple-600 text-white border-purple-700 hover:bg-purple-700";
                                    }
                                    else if (status === 'answered_marked_for_review') {
                                        // Purple + Green Dot
                                        colorClass = "bg-purple-600 text-white border-purple-700 relative";
                                    }

                                    return (
                                        <button
                                            key={qid}
                                            onClick={() => dispatch({ type: 'SET_CURRENT_QUESTION', payload: globalIndex })}
                                            className={`
                                                ${baseClass}
                                                ${colorClass}
                                                ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-zinc-900 z-10 scale-105' : ''}
                                            `}
                                        >
                                            {globalIndex + 1}

                                            {/* Green dot for Answered & Marked for Review */}
                                            {status === 'answered_marked_for_review' && (
                                                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white dark:border-zinc-800 flex items-center justify-center">
                                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Legend - Compact Grid */}
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 text-[10px] sm:text-xs border-t dark:border-zinc-700 grid grid-cols-2 gap-y-2 gap-x-1 text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-1.5"><div className="w-5 h-5 flex items-center justify-center font-bold bg-[#5cb85c] text-white rounded-sm">{legendStats.answered}</div> Answered</div>
                <div className="flex items-center gap-1.5"><div className="w-5 h-5 flex items-center justify-center font-bold bg-[#d9534f] text-white rounded-sm">{legendStats.notAnswered}</div> Not Answered</div>
                <div className="flex items-center gap-1.5"><div className="w-5 h-5 flex items-center justify-center font-bold bg-white text-gray-600 border border-gray-400 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-600 rounded-sm">{legendStats.notVisited}</div> Not Visited</div>
                <div className="flex items-center gap-1.5"><div className="w-5 h-5 flex items-center justify-center font-bold bg-purple-600 text-white rounded-sm">{legendStats.marked}</div> Marked for Review</div>
                <div className="col-span-2 flex items-center gap-1.5">
                    <div className="w-5 h-5 flex items-center justify-center font-bold bg-purple-600 text-white relative rounded-sm">
                        {legendStats.answeredMarked}
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-zinc-800"></div>
                    </div>
                    Ans & Marked for Review
                </div>
            </div>

            {/* Submit Button */}
            <div className="p-4 border-t dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900">
                <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors text-sm uppercase tracking-wide"
                >
                    Submit
                </button>
            </div>

            {/* Submit Modal */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-zinc-800">
                        <div className="bg-blue-600 p-5 text-white text-center">
                            <h2 className="text-xl font-bold">Exam Summary</h2>
                            <p className="text-blue-100 text-sm mt-1 opacity-90">Please review your progress before submitting</p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg text-center border dark:border-zinc-700">
                                    <div className="text-3xl font-extrabold text-blue-600">{stats.total}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">Total Qs</div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg text-center border border-green-100 dark:border-green-900/30">
                                    <div className="text-3xl font-extrabold text-green-600">{stats.answered}</div>
                                    <div className="text-[10px] text-green-700 dark:text-green-500 uppercase font-bold tracking-wider mt-1">Answered</div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-center border border-red-100 dark:border-red-900/30">
                                    <div className="text-3xl font-extrabold text-red-500">{stats.notAnswered}</div>
                                    <div className="text-[10px] text-red-700 dark:text-red-500 uppercase font-bold tracking-wider mt-1">Not Answered</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg text-center border border-purple-100 dark:border-purple-900/30">
                                    <div className="text-3xl font-extrabold text-purple-600">{stats.marked}</div>
                                    <div className="text-[10px] text-purple-700 dark:text-purple-500 uppercase font-bold tracking-wider mt-1">Review</div>
                                </div>
                            </div>

                            <label className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-900/30 cursor-pointer mb-6 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    checked={confirmChecked}
                                    onChange={(e) => setConfirmChecked(e.target.checked)}
                                />
                                <span className="text-sm text-amber-900 dark:text-amber-200/80 font-medium select-none leading-tight">
                                    I confirm I want to end the test. I understand I cannot change my answers after submission.
                                </span>
                            </label>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowSubmitConfirm(false); setConfirmChecked(false); }}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-300 font-bold rounded-lg transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { if (confirmChecked) submitExam(); }}
                                    disabled={!confirmChecked}
                                    className={`flex-1 py-2.5 font-bold rounded-lg transition-all text-sm ${confirmChecked
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30 hover:-translate-y-0.5'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600 shadow-none'
                                        }`}
                                >
                                    Final Submit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionPalette;
