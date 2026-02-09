import Link from 'next/link';
import { CheckCircle, Circle, ChevronRight } from 'lucide-react';
import { Question } from '@/data/mockData';

interface QuestionCardProps {
    question: Question;
    isSolved: boolean;
}

export default function QuestionCard({ question, isSolved }: QuestionCardProps) {
    const getQuestionTypeColor = (type: string | undefined) => {
        switch (type) {
            case 'mcq': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50';
            case 'msq': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50';
            case 'nat': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
        }
    };

    return (
        <Link
            href={`/question/${question.id}`}
            className="block group"
        >
            <div className={`bg-white dark:bg-zinc-900 rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${isSolved
                ? 'border-green-200 dark:border-green-900/30 bg-green-50/10 dark:bg-green-900/5'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500'
                }`}>
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1">
                        {isSolved ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                            <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                #{question.qIndex ?? '???'}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getQuestionTypeColor(question.question_type)}`}>
                                {question.question_type}
                            </span>
                            {question.year && (
                                <span className="text-[10px] font-semibold text-zinc-500 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">
                                    {question.year}
                                </span>
                            )}
                            {question.tags && question.tags.map((tag: string, idx: number) => (
                                <span key={idx} className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded hidden sm:inline-block">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <h3 className="font-medium text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                            {question.title || "Untitled Question"}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                                {question.subject}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">
                                {question.topic}
                            </span>
                        </div>
                    </div>
                    <div className="flex-shrink-0 self-center">
                        <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500" />
                    </div>
                </div>
            </div>
        </Link>
    );
}
