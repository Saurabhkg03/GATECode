"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Zap, ArrowRight, BookOpen, BarChart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyChallenge } from '@/contexts/DailyChallengeContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { HomeSkeleton } from '@/components/Skeletons';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useQuestion } from '@/hooks/useQuestions';

// Imports for recent questions fetch
import { useQuery } from '@tanstack/react-query';
import { db } from '@/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface SubjectStats {
    name: string;
    count: number;
    color: string;
}

const COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
    'bg-yellow-500', 'bg-cyan-500'
];

const getColorForString = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return COLORS[0];
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const index = Math.abs(hash % COLORS.length);
    return COLORS[index];
};


export default function HomeClient({ initialQuestions = [] }: { initialQuestions?: any[] }) {
    const { userInfo, isAuthenticated, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading, availableBranches, selectedBranch } = useMetadata();
    const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

    // --- Data Fetching with React Query ---

    // 1. Leaderboard
    const {
        data: leaderboardPreview = [],
        isLoading: loadingLeaderboard
    } = useLeaderboard(5);

    // 2. Daily Challenge
    const {
        data: dailyChallenge,
        isLoading: loadingDailyChallengeData
    } = useQuestion(dailyChallengeId || '');

    // 3. Recent Questions (Hydrated from Server)
    // We use a query to keep it real-time or at least refreshable
    // Assuming 'ece' for now as per server fetch, or use selectedBranch if context available
    const { data: recentQuestions } = useQuery({
        queryKey: ['recentQuestions', 'ece'], // Match server default
        queryFn: async () => {
            const q = query(
                collection(db, 'questions/ece/questions'),
                orderBy('year', 'desc'),
                limit(20)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        },
        initialData: initialQuestions,
        staleTime: 1000 * 60, // 1 minute
    });

    // --- DERIVE SUBJECTS FROM METADATA ---
    const subjectStats: SubjectStats[] = useMemo(() => {
        if (!metadata?.subjectCounts) {
            return [];
        }
        return Object.entries(metadata.subjectCounts)
            .map(([name, count]) => ({
                name,
                count: count || 0,
                color: getColorForString(name),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [metadata]);

    // --- PREDICTIVE AUTH LOGIC ---
    // If loading is true (meaning we think user is logged in but waiting for Firebase), show DashboardSkeleton.
    // If not loading and authenticated, show Dashboard (the main content).
    // If not loading and NOT authenticated, show Landing Page (the public view).

    const isDailyChallengeLoading = loadingChallenge || (!!dailyChallengeId && loadingDailyChallengeData);

    // Case 1: Loading state (waiting for Auth or initial data)
    if (authLoading || metadataLoading) {
        // If we have 'isLoggedIn' in localStorage, we expect a dashboard.
        // Show DashboardSkeleton to prevent flash.
        if (typeof window !== 'undefined' && localStorage.getItem('isLoggedIn') === 'true') {
            return <DashboardSkeleton />;
        }
        // Otherwise, generic loading or just wait (should be fast for non-logged in)
        return <HomeSkeleton />;
    }

    if (isDailyChallengeLoading) {
        return <HomeSkeleton />;
    }

    const branchName = availableBranches[selectedBranch] || 'Preparation';

    // --- NEW: Get branch-specific rating for welcome message ---
    const userBranchRating = userInfo?.ratings?.[selectedBranch] || 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
            {/* Header Section */}
            <div className="text-center mb-16">
                <h1 className="text-4xl md:text-6xl font-extrabold text-zinc-900 dark:text-white mb-4 tracking-tight">
                    Practice. Analyze. <span className="text-blue-500">Master GATE.</span>
                </h1>
                <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto">
                    {/* UPDATED: Dynamic text */}
                    Your complete platform for GATE {branchName} preparation, with curated questions, performance tracking, and community leaderboards.
                </p>
                {/* Welcome Message */}
                {isAuthenticated && userInfo && (
                    <div className="mt-8 inline-block glass-card p-4">
                        <p className="text-lg text-zinc-700 dark:text-zinc-300">
                            Welcome back, <span className="font-semibold text-blue-600 dark:text-blue-300">{userInfo.name}</span>!
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {/* --- NEW: Show branch-specific rating --- */}
                            Current Rating ({branchName}): <span className="font-semibold text-blue-600 dark:text-blue-400">{userBranchRating}</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Daily Challenge Section */}
            {isAuthenticated && dailyChallenge && (
                <div className="mb-16 glass-card p-6 md:p-8 border-blue-500/20">
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                        <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Daily Challenge ({branchName})</h2>
                            <p className="text-zinc-600 dark:text-zinc-300 mt-1">
                                &quot;{dailyChallenge.title}&quot; from {dailyChallenge.subject}. Give it a shot!
                            </p>
                        </div>
                        <Link
                            href={`/question/${dailyChallenge.id}`}
                            className="inline-flex items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            Start Now
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Main Grid: Subjects & Leaderboard Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {/* Subjects Section */}
                <div className="lg:col-span-2">
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-6">
                        Subjects Overview ({branchName})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {subjectStats.map((subject) => (
                            <Link
                                key={subject.name}
                                href={`/practice?subject=${encodeURIComponent(subject.name)}`}
                                className={`glass-card p-6 transition-all duration-300 group ${subject.count > 0
                                    ? 'hover:shadow-xl hover:-translate-y-1'
                                    : 'opacity-60 cursor-not-allowed'
                                    }`}
                                onClick={(e) => { if (subject.count === 0) e.preventDefault(); }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform ${subject.color} ${subject.count > 0 ? 'group-hover:scale-110' : ''} shadow-md`}>
                                        <BookOpen className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg text-zinc-800 dark:text-white">
                                            {subject.name}
                                        </h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {subject.count} questions
                                        </p>
                                    </div>
                                    {subject.count > 0 && (
                                        <ArrowRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                    )}
                                </div>
                            </Link>
                        ))}
                        {/* Placeholder if no subjects */}
                        {subjectStats.length === 0 && (
                            <p className="md:col-span-2 text-center text-zinc-500 dark:text-zinc-400 py-6">
                                No subjects found for this branch.
                            </p>
                        )}
                    </div>
                </div>

                {/* Leaderboard Preview Section */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            Top Performers
                        </h2>
                        <Link href="/leaderboard" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            View All
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {loadingLeaderboard ? (
                            // Simple skeleton for leaderboard
                            Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 animate-pulse">
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
                                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700 w-3/4"></div>
                                        <div className="h-3 rounded bg-zinc-200 dark:bg-zinc-700 w-1/2"></div>
                                    </div>
                                    <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700 w-1/4"></div>
                                </div>
                            ))
                        ) : leaderboardPreview.length === 0 ? (
                            <p className="p-4 text-center text-zinc-500 dark:text-zinc-400">No users yet.</p>
                        ) : (
                            leaderboardPreview.map((leader, index) => (
                                <div key={leader.uid} className="flex items-center gap-4">
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${index === 0 ? 'bg-yellow-400 text-white' :
                                        index === 1 ? 'bg-zinc-400 text-white' :
                                            index === 2 ? 'bg-orange-500 text-white' :
                                                'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <Image
                                        src={leader.avatar || '/user.png'}
                                        alt={leader.name}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover w-10 h-10 border dark:border-zinc-700"
                                        unoptimized={leader.avatar?.startsWith('https://lh3.googleusercontent.com') === false && leader.avatar?.startsWith('https://firebasestorage.googleapis.com') === false}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-zinc-800 dark:text-white truncate">{leader.name}</p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            {leader.stats?.correct ?? 0} solved
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Performance Rating">
                                        <BarChart className="w-4 h-4" />
                                        <span className="font-semibold text-sm">{leader.rating ?? 0}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Questions Preview (using Server Fetched Data) */}
            {recentQuestions && recentQuestions.length > 0 && (
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                            Latest Practice Questions
                        </h2>
                        <Link href="/practice" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                            View All Questions
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recentQuestions.slice(0, 6).map((q: any) => (
                            <Link key={q.id} href={`/question/${q.id}`} className="glass-card p-6 hover:shadow-lg transition-all group block">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                        {q.subject}
                                    </span>
                                    <span className="text-xs text-zinc-500">{q.year}</span>
                                </div>
                                <h3 className="font-semibold text-lg text-zinc-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {q.title || "Untitled Question"}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    <span className="uppercase text-xs font-bold tracking-wider">{q.question_type}</span>
                                    <span>•</span>
                                    <span>{q.topic}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Call to Action (if not logged in) */}
            {!isAuthenticated && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 md:pb-20">
                    <div className="glass-card p-8 text-center">
                        <h3 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">
                            Ready to start?
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            Create an account or log in to track your progress.
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            Get Started <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
