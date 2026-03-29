"use client";

import { useRef, useEffect, useState } from 'react';
import { 
    ChevronRight, ChevronLeft, LayoutGrid, Database, Terminal, Cpu, Share2, Code2, Calculator, BookOpen, 
    Activity, Zap, Radio, Combine, Layers, Flame, Droplets, Wrench, Settings, HardHat, Mountain, Map, Car, 
    Leaf, Plug, Lightbulb, Focus, Component, Library, Bookmark as BookmarkIcon 
} from 'lucide-react';

interface TopicFilterBarProps {
    subjects: string[];
    topics: string[];
    subjectCounts: Record<string, number>;
    selectedSubject: string;
    selectedTopic: string;
    onSubjectChange: (subject: string) => void;
    onTopicChange: (topic: string) => void;
}

const getSubjectTheme = (subject: string) => {
    const s = subject.toLowerCase();

    // Deterministic pseudo-random string hash for unknown subjects
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = s.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    // Fallback dynamic color palettes if keyword matching fails
    const fallbackColors = [
        { accent: "text-pink-500", bgHover: "hover:bg-pink-50/50 dark:hover:bg-pink-900/20", bgActive: "bg-pink-600 border-pink-600 text-white shadow-sm shadow-pink-500/20", badgeActive: "bg-pink-500 text-white", badgeInactive: "bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400" },
        { accent: "text-fuchsia-500", bgHover: "hover:bg-fuchsia-50/50 dark:hover:bg-fuchsia-900/20", bgActive: "bg-fuchsia-600 border-fuchsia-600 text-white shadow-sm shadow-fuchsia-500/20", badgeActive: "bg-fuchsia-500 text-white", badgeInactive: "bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
        { accent: "text-violet-500", bgHover: "hover:bg-violet-50/50 dark:hover:bg-violet-900/20", bgActive: "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-500/20", badgeActive: "bg-violet-500 text-white", badgeInactive: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400" },
        { accent: "text-teal-500", bgHover: "hover:bg-teal-50/50 dark:hover:bg-teal-900/20", bgActive: "bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-500/20", badgeActive: "bg-teal-500 text-white", badgeInactive: "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400" },
        { accent: "text-sky-500", bgHover: "hover:bg-sky-50/50 dark:hover:bg-sky-900/20", bgActive: "bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-500/20", badgeActive: "bg-sky-500 text-white", badgeInactive: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" },
        { accent: "text-lime-500", bgHover: "hover:bg-lime-50/50 dark:hover:bg-lime-900/20", bgActive: "bg-lime-600 border-lime-600 text-white shadow-sm shadow-lime-500/20", badgeActive: "bg-lime-500 text-white", badgeInactive: "bg-lime-50 dark:bg-lime-500/10 text-lime-600 dark:text-lime-400" },
    ];
    
    const fallbackIcons = [
        <BookOpen className="w-4 h-4" />, <Library className="w-4 h-4" />, 
        <Focus className="w-4 h-4" />, <Lightbulb className="w-4 h-4" />, 
        <Component className="w-4 h-4" />
    ];

    let theme = {
        icon: fallbackIcons[hash % fallbackIcons.length],
        ...fallbackColors[hash % fallbackColors.length]
    };

    // ========== GENERAL SUBJECTS ==========
    if (s.includes('math') || s.includes('aptitude') || s.includes('probability')) {
        theme.icon = <Calculator className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-blue-500", bgHover: "hover:bg-blue-50/50 dark:hover:bg-blue-900/20", bgActive: "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20", badgeActive: "bg-blue-500 text-white", badgeInactive: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" });
    }
    // ========== COMPUTER SCIENCE (CSE) / IT ==========
    else if (s.includes('algorithm') || s.includes('data structure') || s.includes('theory') || s.includes('compiler') || s.includes('programming')) {
        theme.icon = <Code2 className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-cyan-500", bgHover: "hover:bg-cyan-50/50 dark:hover:bg-cyan-900/20", bgActive: "bg-cyan-600 border-cyan-600 text-white shadow-sm shadow-cyan-500/20", badgeActive: "bg-cyan-500 text-white", badgeInactive: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" });
    }
    else if (s.includes('dbms') || s.includes('database')) {
        theme.icon = <Database className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-orange-500", bgHover: "hover:bg-orange-50/50 dark:hover:bg-orange-900/20", bgActive: "bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-500/20", badgeActive: "bg-orange-500 text-white", badgeInactive: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400" });
    }
    else if (s.includes('os') || s.includes('operating')) {
        theme.icon = <Terminal className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-indigo-500", bgHover: "hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20", bgActive: "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20", badgeActive: "bg-indigo-500 text-white", badgeInactive: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" });
    }
    else if (s.includes('network') || s.includes('communication')) {
        theme.icon = s.includes('communication') ? <Radio className="w-4 h-4" /> : <Share2 className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-emerald-500", bgHover: "hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20", bgActive: "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/20", badgeActive: "bg-emerald-500 text-white", badgeInactive: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" });
    }
    // ========== ELECTRONICS / VLSI (ECE & EE) ==========
    else if (s.includes('signal') || s.includes('control')) {
        theme.icon = s.includes('signal') ? <Activity className="w-4 h-4" /> : <Combine className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-amber-500", bgHover: "hover:bg-amber-50/50 dark:hover:bg-amber-900/20", bgActive: "bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-500/20", badgeActive: "bg-amber-500 text-white", badgeInactive: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" });
    }
    else if (s.includes('analog') || s.includes('magnetic')) {
        theme.icon = s.includes('analog') ? <Zap className="w-4 h-4" /> : <Layers className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-rose-500", bgHover: "hover:bg-rose-50/50 dark:hover:bg-rose-900/20", bgActive: "bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-500/20", badgeActive: "bg-rose-500 text-white", badgeInactive: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" });
    }
    else if (s.includes('digital') || s.includes('cpu') || s.includes('architecture') || s.includes('device') || s.includes('electron')) {
        theme.icon = <Cpu className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-purple-500", bgHover: "hover:bg-purple-50/50 dark:hover:bg-purple-900/20", bgActive: "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-500/20", badgeActive: "bg-purple-500 text-white", badgeInactive: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" });
    }
    // ========== CIVIL ENGINEERING (CE) ==========
    else if (s.includes('structural') || s.includes('structure') || s.includes('geotechnical') || s.includes('soil')) {
        theme.icon = s.includes('soil') || s.includes('geo') ? <Mountain className="w-4 h-4" /> : <HardHat className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-amber-600", bgHover: "hover:bg-amber-50/50 dark:hover:bg-amber-900/20", bgActive: "bg-amber-700 border-amber-700 text-white shadow-sm shadow-amber-600/20", badgeActive: "bg-amber-600 text-white", badgeInactive: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500" });
    }
    else if (s.includes('environmental') || s.includes('water') || s.includes('hydrology') || s.includes('irrigation')) {
        theme.icon = s.includes('water') || s.includes('hydro') ? <Droplets className="w-4 h-4" /> : <Leaf className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-teal-600", bgHover: "hover:bg-teal-50/50 dark:hover:bg-teal-900/20", bgActive: "bg-teal-700 border-teal-700 text-white shadow-sm shadow-teal-600/20", badgeActive: "bg-teal-600 text-white", badgeInactive: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-500" });
    }
    else if (s.includes('transportation') || s.includes('surveying') || s.includes('traffic')) {
        theme.icon = s.includes('transport') || s.includes('traffic') ? <Car className="w-4 h-4" /> : <Map className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-indigo-600", bgHover: "hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20", bgActive: "bg-indigo-700 border-indigo-700 text-white shadow-sm shadow-indigo-600/20", badgeActive: "bg-indigo-600 text-white", badgeInactive: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-500" });
    }
    // ========== MECHANICAL ENGINEERING (ME) ==========
    else if (s.includes('thermo') || s.includes('heat') || s.includes('fluid')) {
        theme.icon = s.includes('fluid') ? <Droplets className="w-4 h-4" /> : <Flame className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-orange-600", bgHover: "hover:bg-orange-50/50 dark:hover:bg-orange-900/20", bgActive: "bg-orange-700 border-orange-700 text-white shadow-sm shadow-orange-600/20", badgeActive: "bg-orange-600 text-white", badgeInactive: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500" });
    }
    else if (s.includes('manufactur') || s.includes('production') || s.includes('machine') || s.includes('mechanics')) {
        theme.icon = s.includes('manufactur') ? <Wrench className="w-4 h-4" /> : <Settings className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-fuchsia-600", bgHover: "hover:bg-fuchsia-50/50 dark:hover:bg-fuchsia-900/20", bgActive: "bg-fuchsia-700 border-fuchsia-700 text-white shadow-sm shadow-fuchsia-600/20", badgeActive: "bg-fuchsia-600 text-white", badgeInactive: "bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-500" });
    }
    // ========== ELECTRICAL ENGINEERING (EE) Extras ==========
    else if (s.includes('power') || s.includes('measurement')) {
        theme.icon = <Plug className="w-4 h-4" />;
        Object.assign(theme, { accent: "text-rose-600", bgHover: "hover:bg-rose-50/50 dark:hover:bg-rose-900/20", bgActive: "bg-rose-700 border-rose-700 text-white shadow-sm shadow-rose-600/20", badgeActive: "bg-rose-600 text-white", badgeInactive: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-500" });
    }

    return theme;
};

export default function TopicFilterBar({
    subjects,
    topics,
    subjectCounts,
    selectedSubject,
    selectedTopic,
    onSubjectChange,
    onTopicChange
}: TopicFilterBarProps) {
    const row1Ref = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        if (row1Ref.current) {
            const { scrollLeft, scrollWidth, clientWidth } = row1Ref.current;
            setCanScrollLeft(scrollLeft > 5);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
        }
    };

    useEffect(() => {
        if (row1Ref.current) {
            checkScroll();
            const ref = row1Ref.current;
            ref.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
            
            // Initial check after a small delay to ensure rendering is complete
            const timer = setTimeout(checkScroll, 100);
            return () => {
                ref.removeEventListener('scroll', checkScroll);
                window.removeEventListener('resize', checkScroll);
                clearTimeout(timer);
            };
        }
    }, [subjects, selectedSubject]);

    const scroll = (direction: 'left' | 'right') => {
        if (row1Ref.current) {
            const scrollAmount = Math.min(row1Ref.current.clientWidth * 0.8, 400);
            row1Ref.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="flex flex-col gap-2 sm:gap-4 mb-4 w-full select-none">
            {/* Row 1: Subjects with Counts (LeetCode Style) */}
            <div className="relative group/row1 w-full overflow-hidden">
                {/* Previous Button */}
                <button 
                    onClick={() => scroll('left')}
                    disabled={!canScrollLeft}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white/95 dark:bg-zinc-900/95 shadow-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110 active:scale-95 translate-x-1 ${!canScrollLeft ? 'opacity-40 cursor-not-allowed grayscale' : 'opacity-100'}`}
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div 
                    ref={row1Ref}
                    className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-8 sm:px-12 scroll-smooth"
                >
                    <button
                        onClick={() => onSubjectChange('all')}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                            selectedSubject === 'all'
                                ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-md'
                                : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        All Subjects
                    </button>
                    {subjects.map((subject) => {
                        const theme = getSubjectTheme(subject);
                        const isSelected = selectedSubject === subject;
                        return (
                            <button
                                key={subject}
                                onClick={() => onSubjectChange(subject)}
                                className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                                    isSelected
                                        ? theme.bgActive
                                        : `bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 ${theme.bgHover}`
                                }`}
                            >
                                <span className={`${isSelected ? 'text-white' : theme.accent}`}>
                                    {theme.icon}
                                </span>
                                <span className="whitespace-nowrap">{subject}</span>
                                {subjectCounts[subject] !== undefined && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        isSelected
                                            ? theme.badgeActive
                                            : theme.badgeInactive
                                    }`}>
                                        {subjectCounts[subject]}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button 
                    onClick={() => scroll('right')}
                    disabled={!canScrollRight}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white/95 dark:bg-zinc-900/95 shadow-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110 active:scale-95 -translate-x-1 ${!canScrollRight ? 'opacity-40 cursor-not-allowed grayscale' : 'opacity-100'}`}
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* Edge Gradients */}
                <div className={`absolute left-0 top-0 bottom-1 w-12 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute right-0 top-0 bottom-1 w-12 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />
            </div>
        </div>
    );
}
