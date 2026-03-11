"use client";

import React from 'react';
import { Timer } from 'lucide-react';
import { useExam } from '@/contexts/ExamContext';

export default function ExamTimer() {
    const { state } = useExam();

    // Read directly from the context, which ticks every second
    const timeLeft = state.timeLeft;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isWarning = timeLeft > 0 && timeLeft < 300; // Under 5 mins

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${isWarning ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 animate-pulse' : 'bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700'}`}>
            <Timer className={`w-4 h-4 ${isWarning ? 'text-red-600 dark:text-red-500' : 'text-gray-500'}`} />
            <span className={`font-mono font-bold text-lg ${isWarning ? 'text-red-600 dark:text-red-500' : ''}`}>
                {formatTime(timeLeft)}
            </span>
            <span className={`text-xs uppercase font-semibold ${isWarning ? 'text-red-500/80 dark:text-red-400/80' : 'text-gray-500 dark:text-gray-400'}`}>Left</span>
        </div>
    );
}
