"use client";

import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { useExam } from '@/contexts/ExamContext';

interface ExamTimerProps {
    contestId: string;
    uid: string;
}

export default function ExamTimer({ contestId, uid }: ExamTimerProps) {
    const { state } = useExam();
    const [timeLeft, setTimeLeft] = useState(state.timeLeft);

    useEffect(() => {
        if (state.isLoading || state.isSubmitted || !state.contest) return;

        const TARGET_TIME_KEY = `exam_target_time_${contestId}_${uid}`;

        const tick = () => {
            const targetStr = typeof window !== 'undefined' ? localStorage.getItem(TARGET_TIME_KEY) : null;
            if (!targetStr) return;
            const targetEndTime = parseInt(targetStr, 10);
            if (targetEndTime <= 0) return;
            const now = Date.now();
            const diff = targetEndTime - now;
            const secondsLeft = Math.max(0, Math.floor(diff / 1000));
            setTimeLeft(secondsLeft);
        };

        // Initial tick
        tick();

        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [state.isLoading, state.isSubmitted, state.contest, contestId, uid]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isWarning = timeLeft < 300;

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
