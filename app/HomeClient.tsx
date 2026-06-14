"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Zap, ArrowRight, BookOpen, BarChart, Timer, Trophy, Sparkles, History, CheckCircle, Target, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyChallenge } from "@/contexts/DailyChallengeContext";
import { useMetadata } from "@/contexts/MetadataContext";
import { HomeSkeleton } from "@/components/Skeletons";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useQuestion } from "@/hooks/useQuestions";
import { getNextWeeklyContest, getNextBiweeklyContest } from "@/utils/contestSchedule";
import CountdownTimer from "@/components/contests/CountdownTimer";

// Imports for recent questions fetch
import { useQuery } from "@tanstack/react-query";
import { db } from "@/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

interface SubjectStats {
  name: string;
  count: number;
  color: string;
}

const COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-yellow-500",
  "bg-cyan-500",
];

const getColorForString = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return COLORS[0];
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

export default function HomeClient({
  initialQuestions = [],
  initialBranch = "ece",
}: {
  initialQuestions?: any[];
  initialBranch?: string;
}) {
  const { userInfo, isAuthenticated, loading: authLoading } = useAuth();
  const {
    metadata,
    loading: metadataLoading,
    availableBranches,
    selectedBranch,
  } = useMetadata();
  const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false);

  useEffect(() => {
    setIsClientLoggedIn(localStorage.getItem("isLoggedIn") === "true");
  }, []);

  // --- Data Fetching with React Query ---

  // 1. Leaderboard
  const { data: leaderboardPreview = [], isLoading: loadingLeaderboard } =
    useLeaderboard(5);

  // 2. Daily Challenge
  const { data: dailyChallenge, isLoading: loadingDailyChallengeData } =
    useQuestion(dailyChallengeId || "");

  // 3. Recent Questions (Hydrated from Server)
  // Use selectedBranch from context so it stays in sync when the user switches branches
  const activeBranch = selectedBranch || initialBranch;
  const { data: recentQuestions, isLoading: loadingRecentQuestions } = useQuery({
    queryKey: ["recentQuestions", activeBranch],
    queryFn: async () => {
      const q = query(
        collection(db, `questions_${activeBranch}`),
        orderBy("year", "desc"),
        limit(20),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    },
    initialData: activeBranch === initialBranch ? initialQuestions : undefined,
    staleTime: 1000 * 60, // 1 minute
  });

  // 4. Recent Mistakes for Authenticated Users
  const { data: recentMistakes, isLoading: loadingMistakes } = useQuery({
    queryKey: ["recentMistakes", userInfo?.uid, selectedBranch],
    queryFn: async () => {
      if (!userInfo?.uid || !selectedBranch) return [];
      // Fetch user submissions where correct is false for the selected branch
      const q = query(
        collection(db, `users/${userInfo.uid}/submissions`),
        orderBy("timestamp", "desc"),
        limit(10), // fetch top 10 mistakes for displaying in Quick Resume
      );
      const snapshot = await getDocs(q);
      const submissions = snapshot.docs.map((d) => d.data());
      // Filter correctly by branch client side if no composite index exists
      return submissions.filter(s => s.branch === selectedBranch && s.correct === false).slice(0, 4);
    },
    enabled: isAuthenticated && !!userInfo?.uid,
    staleTime: 1000 * 60 * 5,
  });

  // Scheduled contest IDs for registration check
  const weeklyInfo = useMemo(() => getNextWeeklyContest(), []);
  const biweeklyInfo = useMemo(() => getNextBiweeklyContest(), []);


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

  const isDailyChallengeLoading =
    loadingChallenge || (!!dailyChallengeId && loadingDailyChallengeData);

  // Case 1: Loading state (waiting for Auth or initial data)
  if (authLoading || metadataLoading) {
    // If we have 'isLoggedIn' in localStorage, we expect a dashboard.
    // Show DashboardSkeleton to prevent flash.
    if (isClientLoggedIn) {
      return <DashboardSkeleton />;
    }
    // Otherwise, generic loading or just wait (should be fast for non-logged in)
    return <HomeSkeleton />;
  }

  if (isDailyChallengeLoading) {
    return <HomeSkeleton />;
  }

  const branchName = availableBranches[selectedBranch] || "Preparation";

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
          Your complete platform for GATE {branchName} preparation, with curated
          questions, performance tracking, and community leaderboards.
        </p>
        {/* Welcome Message */}
        {isAuthenticated && userInfo && (
          <div className="mt-8 inline-block glass-card p-4">
            <p className="text-lg text-zinc-700 dark:text-zinc-300">
              Welcome back,{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-300">
                {userInfo.name}
              </span>
              !
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {/* --- NEW: Show branch-specific rating --- */}
              Practice Rating ({branchName}):{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {userBranchRating}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Authenticated Dashboard widgets */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Daily Challenge Card */}
          {dailyChallenge && (
            <div className="glass-card p-6 border-blue-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
                    Daily Challenge
                  </h2>
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 mb-4 line-clamp-2">
                  &quot;{dailyChallenge.title}&quot; from {dailyChallenge.subject}
                </p>
              </div>
              <Link
                href={`/question/${dailyChallenge.id}`}
                className="w-full inline-flex justify-center items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-sm"
              >
                Start Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Profile Activity & Streak */}
          <div className="glass-card p-6 border-orange-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
                  Your Activity
                </h2>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-orange-500">
                  {userInfo?.branchStreakData?.[selectedBranch]?.currentStreak || 0}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">Day Streak! 🔥</span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Solve a question today in {branchName} to keep your streak alive.
              </p>
            </div>
            <Link
              href={`/profile/${userInfo?.username}`}
              className="mt-4 w-full inline-flex justify-center items-center gap-2 bg-zinc-100 text-zinc-800 px-6 py-3 rounded-xl font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              View Full Profile
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming & Live Contests Widget */}
      {isAuthenticated && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Timer className="w-6 h-6 text-amber-500" /> Active & Upcoming Mocks
            </h2>
            <Link href="/contests" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
              View Schedule
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weekly Contest Card */}
            <Link href={`/contests/${weeklyInfo.id}-${activeBranch.toLowerCase()}`} className="relative rounded-2xl overflow-hidden group shadow-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
              {/* Premium Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_28%_38%,rgba(255,255,255,0.25),transparent_65%)]" />
              
              {/* Decorative Elements */}
              <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)]" />
              <div className="absolute top-3 right-10 w-16 h-16 rounded-full border border-white/10" />
              
              {/* Lightning Illustration */}
              <div className="absolute bottom-6 right-4 select-none leading-none filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-transform duration-700 group-hover:-translate-y-3 group-hover:scale-110">
                <span className="text-[80px] drop-shadow-lg">⚡</span>
              </div>

              <div className="relative z-10 p-6 flex flex-col justify-between h-full min-h-[180px]">
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full px-4 py-1.5 border border-white/10 shadow-inner">
                    <Trophy className="w-3.5 h-3.5" /> Weekly Contest
                  </span>
                  <div className="bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/15 shadow-lg">
                    <Timer className="w-3.5 h-3.5 text-white/90" />
                    <span className="text-white text-[12px] font-black tabular-nums">
                      <CountdownTimer targetDate={weeklyInfo.startTime} compact={true} onComplete={() => { }} />
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-black text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">Weekly Mock {weeklyInfo.number}</h3>
                  <div className="flex items-center gap-2 text-white/90 text-sm mt-1.5 font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>Starts {weeklyInfo.startTime.toLocaleDateString("en-IN", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Biweekly Contest Card */}
            <Link href={`/contests/${biweeklyInfo.id}-${activeBranch.toLowerCase()}`} className="relative rounded-2xl overflow-hidden group shadow-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
              {/* Premium Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_28%,rgba(255,255,255,0.2),transparent_60%)]" />
              
              {/* Decorative Elements */}
              <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_70%)]" />
              <div className="absolute top-3 left-10 w-16 h-16 rounded-full border border-white/10" />

              {/* Lightning Illustrations */}
              <div className="absolute bottom-4 right-4 select-none leading-none filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-transform duration-700 group-hover:-translate-y-3 group-hover:scale-110">
                <span className="text-[54px] block drop-shadow-lg">⚡</span>
                <span className="text-[38px] block -mt-3 ml-6 opacity-80 drop-shadow-lg">⚡</span>
              </div>

              <div className="relative z-10 p-6 flex flex-col justify-between h-full min-h-[180px]">
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full px-4 py-1.5 border border-white/10 shadow-inner">
                    <Sparkles className="w-3.5 h-3.5" /> Biweekly Contest
                  </span>
                  <div className="bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/15 shadow-lg">
                    <Timer className="w-3.5 h-3.5 text-white/90" />
                    <span className="text-white text-[12px] font-black tabular-nums">
                      <CountdownTimer targetDate={biweeklyInfo.startTime} compact={true} onComplete={() => { }} />
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-black text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">Biweekly Mock {biweeklyInfo.number}</h3>
                  <div className="flex items-center gap-2 text-white/90 text-sm mt-1.5 font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>Starts {biweeklyInfo.startTime.toLocaleDateString("en-IN", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>
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
                  ? "hover:shadow-xl hover:-translate-y-1"
                  : "opacity-60 cursor-not-allowed"
                  }`}
                onClick={(e) => {
                  if (subject.count === 0) e.preventDefault();
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform ${subject.color} ${subject.count > 0 ? "group-hover:scale-110" : ""} shadow-md`}
                  >
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
            <Link
              href="/leaderboard"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {loadingLeaderboard ? (
              // Simple skeleton for leaderboard
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 animate-pulse"
                >
                  <div className="w-8 h-8 rounded-full bg-muted"></div>
                  <div className="w-10 h-10 rounded-full bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded bg-muted w-3/4"></div>
                    <div className="h-3 rounded bg-muted w-1/2"></div>
                  </div>
                  <div className="h-4 rounded bg-muted w-1/4"></div>
                </div>
              ))
            ) : leaderboardPreview.length === 0 ? (
              <p className="p-4 text-center text-zinc-500 dark:text-zinc-400">
                No users yet.
              </p>
            ) : (
              leaderboardPreview.map((leader, index) => (
                <div key={leader.uid || `leader-${index}`} className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${index === 0
                      ? "bg-yellow-400 text-white"
                      : index === 1
                        ? "bg-zinc-400 text-white"
                        : index === 2
                          ? "bg-orange-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                  >
                    {index + 1}
                  </div>
                  <Image
                    src={leader.avatar || "/user.png"}
                    alt={leader.name || "Leader Avatar"}
                    width={40}
                    height={40}
                    className="rounded-full object-cover w-10 h-10 border dark:border-zinc-700"
                    unoptimized={
                      leader.avatar?.startsWith(
                        "https://lh3.googleusercontent.com",
                      ) === false &&
                      leader.avatar?.startsWith(
                        "https://firebasestorage.googleapis.com",
                      ) === false
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-800 dark:text-white truncate">
                      {leader.name}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {leader.stats?.correct ?? 0} solved
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"
                    title="Contest Elo"
                  >
                    <Trophy className="w-4 h-4" />
                    <span className="font-semibold text-sm">
                      {leader.rating ?? 0}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dashboard: Recent Mistakes & Practice (Authenticated) */}
      {isAuthenticated && (
        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Resume - Mistakes */}
          <div className="glass-card p-6 flex flex-col h-full border-red-500/10 dark:border-red-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-red-500" /> Recent Mistakes
              </h2>
            </div>
            <div className="flex-1 space-y-3">
              {loadingMistakes ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
                </div>
              ) : recentMistakes && recentMistakes.length > 0 ? (
                recentMistakes.map((m: any, index: number) => (
                  <Link key={m.qid || `mistake-${index}`} href={`/question/${m.qid}`} className="block p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-red-500/50 dark:hover:border-red-500/50 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">Needs Review</span>
                      <span className="text-xs text-zinc-500">{new Date(m.timestamp).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{m.questionTitle || "Review Question"}</h3>
                  </Link>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl shadow-inner">
                  <div className="w-16 h-16 bg-white dark:bg-emerald-900/40 rounded-full flex items-center justify-center shadow-sm mb-4 border border-emerald-100 dark:border-emerald-800">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="font-bold text-lg text-emerald-900 dark:text-emerald-400 mb-1">All caught up!</p>
                  <p className="text-sm text-emerald-700/70 dark:text-emerald-500/70">You have no recent incorrect submissions.</p>
                </div>
              )}
            </div>
          </div>

          {/* Latest Practice Recommendations */}
          <div className="glass-card p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" /> Continue Learning
              </h2>
              <Link href="/practice" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                View All
              </Link>
            </div>
            <div className="flex-1 space-y-3">
              {loadingRecentQuestions ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
                </div>
              ) : recentQuestions && recentQuestions.length > 0 ? (
                recentQuestions.slice(0, 4).map((q: any, index: number) => (
                  <Link key={q.id || `question-${index}`} href={`/question/${q.id}`} className="block p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{q.subject}</span>
                      <span className="text-xs text-zinc-500">{q.year}</span>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{q.title || "Untitled Question"}</h3>
                  </Link>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl shadow-inner">
                  <div className="w-16 h-16 bg-white dark:bg-blue-900/40 rounded-full flex items-center justify-center shadow-sm mb-4 border border-blue-100 dark:border-blue-800">
                    <BookOpen className="w-8 h-8 text-blue-500" />
                  </div>
                  <p className="font-bold text-lg text-blue-900 dark:text-blue-400 mb-1">No questions yet</p>
                  <p className="text-sm text-blue-700/70 dark:text-blue-500/70">Start practicing to see personalized recommendations.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Marketing View: Unauthenticated Landing Page Features */}
      {!isAuthenticated && (
        <>
          <div className="mb-24 mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl bg-zinc-100 dark:bg-zinc-900 p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_70%)] rounded-bl-full -z-10" />
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-900 border border-red-200 dark:border-red-500/30">L</div>
                  <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className={`h-8 rounded ${i === 2 ? 'bg-blue-500 text-white shadow-md' : i === 5 ? 'bg-green-500 text-white' : i === 7 ? 'bg-red-500 text-white' : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'} flex items-center justify-center text-xs font-medium`}>{i}</div>
                  ))}
                </div>
                <div className="h-32 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 shadow-sm relative">
                  <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-700 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-700 rounded" />
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                    <div className="h-8 w-24 bg-blue-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 text-sm font-bold uppercase tracking-wider rounded-full px-4 py-1.5 border border-blue-200 dark:border-blue-500/20">
                <Sparkles className="w-4 h-4" /> Realistic Interface
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white leading-tight">
                Experience the exact <br className="hidden md:block" /> TCS iON interface.
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Don't let the exam UI be a surprise on test day. Practice with our pixel-perfect replica of the official GATE computer-based test interface.
              </p>
              <ul className="space-y-3 mt-4">
                {['Virtual Calculator included', 'Exact color-coded question palette', 'Mark for Review workflows', 'Keyboard navigation support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 text-sm font-bold uppercase tracking-wider rounded-full px-4 py-1.5 border border-purple-200 dark:border-purple-500/20">
                <Trophy className="w-4 h-4" /> Global Elo Ratings
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white leading-tight">
                Climb the ranks from <br className="hidden md:block" /> Novice to Grandmaster.
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Every mock test affects your global rating. Track your progress against thousands of aspirants nationwide and compete on the real-time leaderboard.
              </p>
              <Link href="/login" className="mt-4 inline-flex items-center gap-2 bg-zinc-900 text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">
                Start Climbing <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col gap-4">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.15),transparent_70%)] rounded-full -z-10" />
              {['Grandmaster', 'Master', 'Expert'].map((rank, i) => (
                <div key={rank} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950/50 shadow-sm relative overflow-hidden">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-white shadow-inner ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-purple-500'}`}>
                    {8 - i}
                  </div>
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
                    <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                  <span className={`font-bold ${i === 0 ? 'text-red-500' : i === 1 ? 'text-orange-500' : 'text-purple-500'}`}>{2400 - (i * 200)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 md:pb-20">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              <div className="relative p-8 md:p-12 text-center flex flex-col items-center">
                <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-4 shadow-sm">
                  Ready to crack GATE?
                </h3>
                <p className="text-blue-100 mb-8 max-w-2xl text-lg">
                  Join thousands of students practicing with GATECode. Track your progress, identify weak subjects, and master your branch today.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-full font-extrabold text-lg hover:bg-zinc-50 hover:scale-105 transition-all shadow-xl"
                >
                  Create Free Account <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
