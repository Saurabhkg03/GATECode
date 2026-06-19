"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Trophy, Activity, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";
import { db } from "@/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Contest, ContestAttempt } from "@/types/exam";
import Link from "next/link";
import { getRankTier } from "@/utils/rating";

interface LeaderboardEntry {
  uid: string;
  name: string;
  username: string;
  score: number;
  timeSpent: number;
  oldRating?: number;
  newRating?: number;
  ratingChange?: number;
}

export default function ContestLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const contestId = params.contestId as string;

  const [contest, setContest] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const contestRef = doc(db, "contests", contestId);
        const contestSnap = await getDoc(contestRef);
        if (!contestSnap.exists()) {
          setLoading(false);
          return;
        }
        
        const contestData = { id: contestId, ...contestSnap.data() } as Contest;
        setContest(contestData);
        
        const branch = contestData.branch || 'ece';

        // Fetch valid attempts
        const attemptsQuery = query(
          collection(db, "contest_attempts"),
          where("contestId", "==", contestId)
        );
        
        const attemptsSnap = await getDocs(attemptsQuery);
        
        // Group attempts by user and take highest score
        const userAttempts = new Map<string, ContestAttempt>();
        attemptsSnap.docs.forEach(docSnap => {
          const attempt = docSnap.data() as ContestAttempt;
          if (!attempt.isSubmitted || attempt.isPractice) return;
          const existing = userAttempts.get(attempt.uid);
          if (!existing || (attempt.score || 0) > (existing.score || 0)) {
            userAttempts.set(attempt.uid, attempt);
          }
        });

        // Fetch user profiles to get names and rating history
        const uids = Array.from(userAttempts.keys());
        const userEntries: LeaderboardEntry[] = [];
        
        const BATCH_SIZE = 10;
        for (let i = 0; i < uids.length; i += BATCH_SIZE) {
            const uidsChunk = uids.slice(i, i + BATCH_SIZE);
            const userQuery = query(collection(db, "users"), where("uid", "in", uidsChunk));
            const userSnaps = await getDocs(userQuery);
            
            userSnaps.forEach(userDoc => {
                const userData = userDoc.data();
                const attempt = userAttempts.get(userDoc.id);
                if (!attempt) return;
                
                let timeSpent = 0;
                Object.values(attempt.responses || {}).forEach((r: any) => timeSpent += (r.timeSpent || 0));
                if (timeSpent === 0) timeSpent = Math.floor((attempt.submittedAt! - attempt.startedAt!) / 1000);
                
                // Find Elo change for this contest
                const history = userData.branchRatingHistory?.[branch] || [];
                const contestHistory = history.find((h: any) => h.contestId === contestId);
                
                userEntries.push({
                    uid: userDoc.id,
                    name: userData.name || "Anonymous",
                    username: userData.username || userDoc.id.substring(0, 8),
                    score: attempt.score || 0,
                    timeSpent,
                    oldRating: contestHistory?.oldRating,
                    newRating: contestHistory?.newRating,
                    ratingChange: contestHistory ? (contestHistory.newRating - contestHistory.oldRating) : undefined
                });
            });
        }
        
        // Sort entries: Score Desc, then Time Asc
        userEntries.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.timeSpent - b.timeSpent;
        });
        
        setEntries(userEntries);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ffa116] animate-spin" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center">
        <Trophy className="w-12 h-12 text-zinc-600 mb-4" />
        <h1 className="text-2xl font-bold">Contest Not Found</h1>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-gray-300 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white">{contest.title}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400 font-medium">
                    <Trophy className="w-4 h-4 text-[#ffa116]" />
                    Leaderboard &amp; Ratings
                </div>
            </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#282828] border border-white/5 rounded-2xl p-5">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Participants</p>
                <p className="text-2xl font-black text-white">{entries.length}</p>
            </div>
            <div className="bg-[#282828] border border-white/5 rounded-2xl p-5">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-2 text-2xl font-black text-white">
                    {contest.isRatingsProcessed ? (
                        <><Activity className="w-6 h-6 text-emerald-500" /> Ratings Processed</>
                    ) : (
                        <><Minus className="w-6 h-6 text-zinc-500" /> Unprocessed</>
                    )}
                </div>
            </div>
            <div className="bg-[#282828] border border-white/5 rounded-2xl p-5">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Marks</p>
                <p className="text-2xl font-black text-white">{contest.totalMarks}</p>
            </div>
        </div>

        {/* Table */}
        <div className="bg-[#282828] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/50 text-xs text-zinc-400 uppercase tracking-wider font-bold border-b border-white/5">
                            <th className="p-4 w-20 text-center">Rank</th>
                            <th className="p-4">User</th>
                            <th className="p-4 text-right">Score</th>
                            {contest.isRatingsProcessed && (
                                <>
                                    <th className="p-4 text-center">Elo Change</th>
                                    <th className="p-4 text-right pr-6">New Elo</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-zinc-500 font-medium">No participants found.</td>
                            </tr>
                        ) : (
                            entries.map((entry, index) => {
                                const rank = index + 1;
                                const isTop3 = rank <= 3;
                                const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-zinc-500';
                                
                                return (
                                    <tr key={entry.uid} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 text-center">
                                            <span className={`font-black ${isTop3 ? 'text-lg' : ''} ${rankColor}`}>
                                                #{rank}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <Link href={`/profile/${entry.username}`} className="font-bold text-white hover:text-blue-400 transition-colors block">
                                                {entry.name}
                                            </Link>
                                            <span className="text-xs text-zinc-500">@{entry.username}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-[#ffa116] text-lg">{entry.score}</span>
                                            <span className="text-xs text-zinc-500 ml-1">/{contest.totalMarks}</span>
                                        </td>
                                        
                                        {contest.isRatingsProcessed && (
                                            <>
                                                <td className="p-4">
                                                    <div className="flex justify-center">
                                                    {entry.ratingChange !== undefined ? (
                                                        <span className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full ${
                                                            entry.ratingChange > 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                                            entry.ratingChange < 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                                                            'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                                                        }`}>
                                                            {entry.ratingChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : 
                                                             entry.ratingChange < 0 ? <ArrowDownRight className="w-3 h-3" /> : 
                                                             <Minus className="w-3 h-3" />}
                                                            {entry.ratingChange > 0 ? '+' : ''}{entry.ratingChange}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-600">-</span>
                                                    )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right pr-6">
                                                    {entry.newRating ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-white">{entry.newRating}</span>
                                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${getRankTier(entry.newRating).color}`}>
                                                                {getRankTier(entry.newRating).title}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600">-</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}
