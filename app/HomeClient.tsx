"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Zap, ArrowRight, BookOpen, BarChart } from 'lucide-react';
// Corrected import paths to be relative to src or alias
import { useAuth } from '@/contexts/AuthContext';
import { useDailyChallenge } from '@/contexts/DailyChallengeContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { db } from '@/firebase';
import { collection, getDocs, query, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { User, Question } from '@/data/mockData';
import { HomeSkeleton } from '@/components/Skeletons';

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


export default function HomeClient() {
    const { userInfo, isAuthenticated, loading: authLoading } = useAuth();
    // --- UPDATED: Get branch-aware metadata ---
    const { metadata, loading: metadataLoading, availableBranches, selectedBranch, questionCollectionPath } = useMetadata();
    const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

    const [dailyChallenge, setDailyChallenge] = useState<Question | null>(null);
    const [leaderboardPreview, setLeaderboardPreview] = useState<User[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

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


    // --- FETCH LEADERBOARD DATA ---
    // --- UPDATED: To be branch-aware ---
    useEffect(() => {
        const fetchLeaderboard = async () => {
            // Wait for branch to be selected
            if (!selectedBranch) return;

            setLoadingLeaderboard(true);
            try {
                // --- NEW: Sort by the branch-specific rating ---
                const usersQuery = query(
                    collection(db, 'users'),
                    orderBy(`ratings.${selectedBranch}`, 'desc'),
                    limit(5)
                );
                const usersSnapshot = await getDocs(usersQuery);

                const fetchedUsers = usersSnapshot.docs.map(doc => {
                    const data = doc.data() as User;
                    // --- NEW: Use branch-specific stats ---
                    const branchStats = data.branchStats?.[selectedBranch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
                    const branchRating = data.ratings?.[selectedBranch] || 0;

                    // Return a "partial" user object shaped for the leaderboard
                    return {
                        ...data,
                        stats: branchStats, // Overwrite old stats with branch-specific
                        rating: branchRating, // Overwrite old rating with branch-specific
                    };
                });

                setLeaderboardPreview(fetchedUsers);

            } catch (error) {
                console.error("Error fetching leaderboard preview:", error);
                setLeaderboardPreview([]);
            } finally {
                setLoadingLeaderboard(false);
            }
        };

        fetchLeaderboard();
    }, [selectedBranch]); // --- Re-fetch if branch changes ---

    // --- FETCH DAILY CHALLENGE OBJECT ---
    useEffect(() => {
        const fetchChallenge = async () => {
            // Use the branch-aware questionCollectionPath
            if (dailyChallengeId && questionCollectionPath) {
                try {
                    const docRef = doc(db, questionCollectionPath, dailyChallengeId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setDailyChallenge({ id: docSnap.id, ...docSnap.data() } as Question);
                    } else {
                        console.warn(`Daily challenge document not found in ${questionCollectionPath}:`, dailyChallengeId);
                        setDailyChallenge(null);
                    }
                } catch (error) {
                    console.error("Error fetching daily challenge object:", error);
                    setDailyChallenge(null);
                }
            } else {
                setDailyChallenge(null); // No ID, so no challenge
            }
        };

        if (!loadingChallenge) {
            fetchChallenge();
        }
    }, [dailyChallengeId, loadingChallenge, questionCollectionPath]); // Re-run if collection path changes

    // Show skeleton if either auth, metadata, or challenge ID is loading
    if (authLoading || metadataLoading || loadingChallenge) {
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
                                "{dailyChallenge.title}" from {dailyChallenge.subject}. Give it a shot!
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
                            Top Performers ({branchName})
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
                                            {/* --- FIXED: Added optional chaining --- */}
                                            {leader.stats?.correct ?? 0} solved
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Performance Rating">
                                        <BarChart className="w-4 h-4" />
                                        {/* --- NEW: Show branch rating --- */}
                                        <span className="font-semibold text-sm">{leader.rating ?? 0}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

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
