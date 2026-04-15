import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Circle } from 'lucide-react';
import { Question } from '@/data/mockData';

// Dynamic import for Code Splitting
const LatexRenderer = dynamic(() => import('./LatexRenderer'), {
    ssr: false,
    loading: () => <span className="animate-pulse bg-zinc-200 dark:bg-zinc-700 rounded h-4 w-24 inline-block align-middle" />
});

interface QuestionCardProps {
    question: Question;
    isSolved: boolean;
}

export default function QuestionCard({ question, isSolved }: QuestionCardProps) {
    const getQuestionTypeColor = (type: string | undefined) => {
        switch (type) {
            case 'mcq': return 'text-blue-600 dark:text-blue-400';
            case 'msq': return 'text-purple-600 dark:text-purple-400';
            case 'nat': return 'text-indigo-600 dark:text-indigo-400';
            default: return 'text-zinc-500';
        }
    };

    return (
        <Link
            href={`/question/${question.id}`}
            className="block group"
        >
            <div className={`flex items-center gap-4 px-4 py-3 sm:py-5 transition-colors duration-150 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${isSolved
                ? 'bg-zinc-50/10 dark:bg-zinc-900/10'
                : 'bg-transparent'
                }`}>
                
                {/* 1. Status Column */}
                <div className="flex-shrink-0 w-8 flex justify-center">
                    {isSolved ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500" />
                    )}
                </div>

                {/* 2. Title Column */}
                <div className="flex-1 min-w-0 mr-4">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        <LatexRenderer content={`${question.qIndex ?? '???'}. ${question.title || "Untitled Question"}`} inline={true} />
                    </h3>
                </div>

                {/* 3. Acceptance/Accuracy Column (hidden on mobile) */}
                <div className="hidden sm:flex flex-shrink-0 w-24 text-sm justify-end text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {(!question.attempts || question.attempts === 0)
                        ? '—'
                        : `${question.accuracy?.toFixed(1)}%`
                    }
                </div>

                {/* 4. Type Column (hidden on small screens) */}
                <div className="hidden md:flex flex-shrink-0 w-20 text-xs font-bold uppercase justify-center">
                    <span className={getQuestionTypeColor(question.question_type)}>
                        {question.question_type}
                    </span>
                </div>

                {/* 5. Year Column (hidden on small screens) */}
                <div className="hidden lg:flex flex-shrink-0 w-16 text-xs text-zinc-500 justify-center">
                    {question.year || '—'}
                </div>

                {/* 6. Tags/Subject Column (Combined) */}
                <div className="hidden xl:flex flex-shrink-0 w-64 text-[10px] gap-1.5 justify-end items-center overflow-hidden">
                    <span className="truncate text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-700/50">
                        {question.subject}
                    </span>
                    {question.tags && question.tags
                        .filter(tag => {
                            const t = tag.toLowerCase();
                            const branch = question.branch?.toLowerCase() || '';
                            return t !== branch && !t.startsWith('gate') && t !== question.subject.toLowerCase() && t !== question.topic?.toLowerCase();
                        })
                        .slice(0, 2)
                        .map((tag: string, idx: number) => (
                            <span key={idx} className="truncate text-zinc-400 dark:text-zinc-500 border border-zinc-200/30 dark:border-zinc-700/30 px-1.5 py-0.5 rounded">
                                {tag}
                            </span>
                        ))
                    }
                </div>
            </div>
        </Link>
    );
}
