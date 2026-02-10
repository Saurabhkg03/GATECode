"use client";

import React, { useState } from 'react';
import { useExam } from '../../contexts/ExamContext';
import { getPaletteColor } from '../../types/exam';
import CustomAlert from '../ui/CustomAlert';

const QuestionPalette = () => {
    const { state, dispatch, submitExam } = useExam();
    const { questions, responses, currentQuestionIndex, sections } = state;
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    // ... (rest of the component logic remains strictly same until return)

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
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Answered</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#d9534f] rounded-sm"></div> Not Answered</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white border border-gray-400 rounded-sm"></div> Not Visited</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-600 rounded-sm"></div> Marked for Review</div>
                <div className="col-span-2 flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-600 relative rounded-sm"><div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white"></div></div> Ans & Marked for Review</div>
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

            <CustomAlert
                isOpen={showSubmitConfirm}
                onClose={() => setShowSubmitConfirm(false)}
                title="Submit Exam?"
                description="Are you sure you want to submit? You cannot change your answers after submission."
                type="confirm"
                confirmText="Submit Exam"
                onConfirm={submitExam}
            />
        </div>
    );
};

export default QuestionPalette;
