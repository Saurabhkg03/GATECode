"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
  compact?: boolean; // Inline single-line variant for cards
  className?: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  onComplete,
  compact = false,
  className,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference <= 0) {
        if (onComplete) {
          onComplete();
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (Object.values(remaining).every((val) => val === 0)) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (!timeLeft) {
    return (
      <div className="animate-pulse w-24 h-6 bg-gray-200 dark:bg-zinc-800 rounded"></div>
    );
  }

  const format = (num: number) => num.toString().padStart(2, "0");

  const isZero =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  if (isZero) {
    return (
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-bold text-sm">
        <Clock className="w-4 h-4" />
        <span>Live Now</span>
      </div>
    );
  }

  // ── Compact (inline) variant for contest cards ──
  if (compact) {
    const parts: string[] = [];
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0) parts.push(`${timeLeft.hours}h`);
    if (timeLeft.minutes > 0) parts.push(`${timeLeft.minutes}m`);
    if (timeLeft.days === 0) parts.push(`${format(timeLeft.seconds)}s`);
    return (
      <span className={`font-mono font-bold ${className || "text-amber-600 dark:text-amber-400"}`}>
        {parts.join(" ")}
      </span>
    );
  }

  // ── Full block variant (used in upcoming section) ──
  return (
    <div className={`flex gap-2 items-center font-mono text-sm tracking-tighter ${className || ""}`}>
      {timeLeft.days > 0 && (
        <div className="flex flex-col items-center">
          <span className="font-bold text-white bg-black/65 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-sm min-w-[34px] text-center">
            {format(timeLeft.days)}
          </span>
          <span className="text-[10px] font-bold uppercase text-white/80 mt-1">d</span>
        </div>
      )}
      {timeLeft.days > 0 && (
        <span className="text-white/60 font-black -mt-4 mx-0.5">:</span>
      )}
      <div className="flex flex-col items-center">
        <span className="font-bold text-white bg-black/65 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-sm min-w-[34px] text-center">
          {format(timeLeft.hours)}
        </span>
        <span className="text-[10px] font-bold uppercase text-white/80 mt-1">h</span>
      </div>
      <span className="text-white/60 font-black -mt-4 mx-0.5">:</span>
      <div className="flex flex-col items-center">
        <span className="font-bold text-white bg-black/65 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-sm min-w-[34px] text-center">
          {format(timeLeft.minutes)}
        </span>
        <span className="text-[10px] font-bold uppercase text-white/80 mt-1">m</span>
      </div>
      <span className="text-white/60 font-black -mt-4 mx-0.5">:</span>
      <div className="flex flex-col items-center">
        <span className="font-bold text-white bg-black/65 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-sm min-w-[34px] text-center">
          {format(timeLeft.seconds)}
        </span>
        <span className="text-[10px] font-bold uppercase text-white/80 mt-1">s</span>
      </div>
    </div>
  );
};

export default CountdownTimer;
