import React from 'react';
import { X, FileText } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import { Question, Section } from '@/types/exam';
import ImageZoom from '@/components/ui/ImageZoom';

interface QuestionPaperModalProps {
    isOpen: boolean;
    onClose: () => void;
    questions: Question[];
    sections: Section[];
    contestTitle: string;
}

const QuestionPaperModal: React.FC<QuestionPaperModalProps> = ({
    isOpen,
    onClose,
    questions,
    sections,
    contestTitle
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="h-14 bg-purple-700 text-white flex items-center justify-between px-4 shrink-0 shadow-md">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span className="font-bold text-lg">Question Paper</span>
                </div>
                <div className="font-medium hidden sm:block truncate max-w-md">
                    {contestTitle}
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-purple-600 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-zinc-900 p-4 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8 pb-10">
                    {sections.map((section, secIdx) => (
                        <div key={secIdx} className="space-y-4">
                            {/* Sticky Section Header */}
                            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-800 p-3 shadow-sm border-b dark:border-zinc-700 flex justify-between items-center rounded-md">
                                <h3 className="font-bold text-lg text-purple-700 dark:text-purple-400">
                                    {section.name}
                                </h3>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {section.questions.length} Questions
                                </span>
                            </div>

                            {/* Questions List */}
                            {section.questions.map((q, qIdx) => {
                                // Find global index if needed, or just use section index
                                return (
                                    <div key={q.id} className="bg-white dark:bg-zinc-950 p-6 rounded-lg shadow-sm border dark:border-zinc-800">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    Q.{qIdx + 1}
                                                </span>
                                                <span className="text-xs font-semibold bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-500 uppercase">
                                                    {q.question_type}
                                                </span>
                                            </div>
                                            <div className="text-xs font-medium text-gray-500">
                                                Marks: {q.marks} | Neg: {q.negative_marks || 0}
                                            </div>
                                        </div>

                                        {/* Question Text */}
                                        <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 mb-4 text-sm sm:text-base">
                                            <LatexRenderer content={extractAndCleanHtml(q.question_html)} />
                                        </div>

                                        {/* Images */}
                                        {q.question_image_links && q.question_image_links.length > 0 && (
                                            <div className="flex flex-col gap-4 mb-4">
                                                {q.question_image_links.map((link, i) => (
                                                    <ImageZoom
                                                        key={i}
                                                        src={link}
                                                        alt={`Question Figure ${i + 1}`}
                                                        className="max-h-[300px] border rounded"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Options (Read Only) */}
                                        {(q.question_type === 'mcq' || q.question_type === 'msq') && (
                                            <div className="space-y-2 pl-2">
                                                {q.options?.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-500 min-w-[20px]">{opt.label}.</span>
                                                        <div>
                                                            <LatexRenderer content={extractAndCleanHtml(opt.text_html)} inline />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default QuestionPaperModal;
