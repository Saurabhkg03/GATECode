"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Target, Crown, ChevronLeft, ChevronRight, Info, X, Award } from 'lucide-react';
import { db } from '@/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast } from 'firebase/firestore';
import { User } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { LeaderboardSkeleton } from '@/components/Skeletons';
import { getRankTier } from '@/utils/rating';

const PAGE_SIZE = 10;

interface LeaderboardUser extends User {
    contestElo: number;
    practiceRating: number;
}

const PodiumCard = ({ user, rank }: { user: LeaderboardUser; rank: number }) => {
    const rankStyles: Record<number, any> = {
        1: { gradient: 'from-amber-400 to-yellow-500', shadow: 'shadow-yellow-500/40', iconColor: 'text-amber-600 dark:text-amber-300', ring: 'ring-yellow-400', order: 'order-1 md:order-2', height: 'mt-0 md:-mt-6' },
        2: { gradient: 'from-zinc-400 to-gray-500', shadow: 'shadow-gray-500/40', iconColor: 'text-gray-600 dark:text-zinc-300', ring: 'ring-gray-400', order: 'order-2 md:order-1', height: 'mt-0' },
        3: { gradient: 'from-orange-400 to-amber-600', shadow: 'shadow-orange-600/40', iconColor: 'text-orange-600 dark:text-orange-300', ring: 'ring-orange-500', order: 'order-3', height: 'mt-0' },
    };
    const styles = rankStyles[rank] || {};

    return (
        <div className={`w-full ${styles.order} ${styles.height}`}>
            <div className={`relative w-full glass-card p-4 rounded-2xl flex flex-row md:flex-col items-center text-left md:text-center gap-5 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${styles.shadow}`}>
                {rank === 1 && <Crown className="absolute -top-3.5 md:-top-4 left-6 md:left-1/2 md:-translate-x-1/2 w-7 h-7 text-yellow-400 drop-shadow-lg z-10" fill="currentColor" />}
                <div className={`absolute top-2 right-4 md:top-2 md:right-2 text-xl font-bold ${styles.iconColor} opacity-40 md:opacity-70`}>#{rank}</div>
                
                <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={user.avatar || '/user.png'}
                        alt={user.name}
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-full object-cover ring-4 ${styles.ring} shadow-md`}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/user.png'; }}
                    />
                </div>

                <div className="flex-1 min-w-0 md:w-full">
                    <Link href={`/profile/${user.username}`} className={`font-bold text-lg md:text-base hover:underline truncate block ${getRankTier(user.contestElo).color}`}>
                        {user.name}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        @{user.username} • <span className={getRankTier(user.contestElo).color}>{getRankTier(user.contestElo).title}</span>
                    </p>
                    
                    <div className={`mt-3 w-full bg-gradient-to-r ${styles.gradient} p-2.5 rounded-xl shadow-inner md:mt-4`}>
                        <div className="grid grid-cols-3 gap-1 items-center text-white text-center">
                            <div>
                                <p className="font-bold text-sm md:text-base leading-tight">{user.contestElo}</p>
                                <p className="text-[9px] md:text-[10px] opacity-90">Contest Elo</p>
                            </div>
                            <div className="border-x border-white/25">
                                <p className="font-bold text-sm md:text-base leading-tight">{user.practiceRating.toFixed(1)}</p>
                                <p className="text-[9px] md:text-[10px] opacity-90">Practice</p>
                            </div>
                            <div>
                                <p className="font-bold text-sm md:text-base leading-tight">{(user.stats?.accuracy ?? 0).toFixed(1)}%</p>
                                <p className="text-[9px] md:text-[10px] opacity-90">Accuracy</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RatingInfoModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl p-6 max-w-lg w-full relative transform transition-all border border-zinc-200/50 dark:border-zinc-800/80 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors z-10"
                    aria-label="Close rating explanation"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 flex items-center gap-2 tracking-tight">
                    <Info className="w-6 h-6 text-blue-500" />
                    Ratings Explained
                </h3>

                <div className="space-y-6 text-sm text-zinc-650 dark:text-zinc-300 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Contest Elo Section */}
                    <div className="space-y-3">
                        <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-base">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            Contest Elo
                        </h4>
                        <p className="leading-relaxed">
                            Contest Elo evaluates your competitive performance in official Live Contests. 
                            It implements a multiplayer Elo rating algorithm where your Elo updates depending on your actual rank versus expected rank against all other participants.
                        </p>
                        
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 space-y-4 shadow-sm">
                            <div className="space-y-1.5">
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">1. Expected Rank (ER):</span>
                                <div className="flex items-center justify-center py-3 px-4 text-sm font-mono bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-zinc-150 dark:border-zinc-900 text-zinc-800 dark:text-zinc-200">
                                    ER<sub>i</sub> = 1 + &Sigma;<sub>j &ne; i</sub> [ 1 / (1 + 10<sup>(R<sub>i</sub> - R<sub>j</sub>) / 400</sup>) ]
                                </div>
                            </div>
                            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1.5">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">2. Rating Update:</span>
                                <div className="flex items-center justify-center py-3 px-4 text-sm font-mono bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-zinc-150 dark:border-zinc-900 text-zinc-800 dark:text-zinc-200">
                                    R&apos;<sub>i</sub> = R<sub>i</sub> + K &times; (ER<sub>i</sub> - AR<sub>i</sub>)
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                                    Where <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-zinc-700 dark:text-zinc-300">R</code> is your previous Elo, <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-zinc-700 dark:text-zinc-300">AR</code> is your actual rank (tie-broken by time spent), and <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-zinc-700 dark:text-zinc-300">K</code> is volatility (50 for first 3 contests, scales down to 20). Base Elo starts at <strong>1500</strong>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Practice Rating Section */}
                    <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-900 pt-6">
                        <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-base">
                            <Award className="w-5 h-5 text-blue-500" />
                            Practice Rating
                        </h4>
                        <p className="leading-relaxed">
                            Practice Rating measures your proficiency and consistency in self-paced practice. 
                            It dynamically scales based on correct answers and accuracy to represent overall mastery.
                        </p>

                        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 space-y-3 shadow-sm">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Rating Formula:</span>
                            <div className="flex items-center justify-center py-3 px-4 text-sm font-mono bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-zinc-150 dark:border-zinc-900 text-zinc-800 dark:text-zinc-200">
                                Rating = Accuracy &times; log<sub>10</sub>(Correct + 1)
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                                Where <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-zinc-700 dark:text-zinc-300">Accuracy</code> is your correctness percentage, and <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-zinc-700 dark:text-zinc-300">Correct</code> is the total number of unique correct questions solved. Rating starts at <strong>0.00</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100/60 dark:border-blue-900/50 mt-4 shadow-sm">
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                            💡 <strong>Tip:</strong> Toggle the sorting tabs on the leaderboard to view rankings by timed live contests or self-paced daily practice!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function Leaderboard() {
    const { loading: authLoading } = useAuth();
    const { selectedBranch, availableBranches, loading: metadataLoading } = useMetadata();

    const [sortBy, setSortBy] = useState<'contest' | 'practice'>('contest');
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
    const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
    const [totalUsers, setTotalUsers] = useState(0);

    // ── Opportunistic cleanup: auto-submit any stale unsubmitted attempts ──
    useEffect(() => {
        // Fire-and-forget — don't block the UI
        fetch('/api/exam/cleanup', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.cleaned > 0) {
                    console.log(`[Cleanup] Auto-submitted ${data.cleaned} stale contest attempt(s).`);
                }
            })
            .catch(err => console.warn('[Cleanup] Cleanup check failed:', err));
    }, []);

    const fetchLeaderboard = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first', cursorDoc: DocumentSnapshot | null = null) => {
        if (!selectedBranch) {
            setLoadingData(true);
            return;
        }

        if (direction === 'first') setLoadingData(true);
        else setLoadingMore(true);

        try {
            const usersCollection = collection(db, 'users');
            const sortField = sortBy === 'contest' ? `branchRatings.${selectedBranch}` : `ratings.${selectedBranch}`;

            if (direction === 'first') {
                // Fix: Count only users who have a rating for this specific branch and sort option
                const countQuery = query(usersCollection, orderBy(sortField));
                const countSnapshot = await getCountFromServer(countQuery);
                setTotalUsers(countSnapshot.data().count);
            }

            let q = query(usersCollection, orderBy(sortField, 'desc'));

            if (direction === 'next' && cursorDoc) {
                q = query(q, startAfter(cursorDoc), limit(PAGE_SIZE));
            } else if (direction === 'prev' && cursorDoc) {
                q = query(q, endBefore(cursorDoc), limitToLast(PAGE_SIZE));
            } else {
                q = query(q, limit(PAGE_SIZE));
            }

            const usersSnapshot = await getDocs(q);

            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data() as User;
                const branchStats = data.branchStats?.[selectedBranch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
                const practiceRating = data.ratings?.[selectedBranch] || 0;
                const contestElo = data.branchRatings?.[selectedBranch] || 1500;

                return {
                    ...data,
                    stats: branchStats,
                    practiceRating,
                    contestElo,
                    rating: sortBy === 'contest' ? contestElo : practiceRating,
                };
            });

            setLeaderboard(usersData as LeaderboardUser[]);

            if (usersSnapshot.docs.length > 0) {
                setFirstVisible(usersSnapshot.docs[0]);
                setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
            } else if (direction !== 'prev') {
                setFirstVisible(null);
                setLastVisible(null);
            }

            setCurrentPage(page);

        } catch (error) {
            console.error("Error fetching leaderboard data:", error);
            setLeaderboard([]); setTotalUsers(0); setFirstVisible(null); setLastVisible(null);
        } finally {
            setLoadingData(false); setLoadingMore(false);
        }
    }, [selectedBranch, sortBy]);

    useEffect(() => {
        if (selectedBranch) {
            setFirstVisible(null); setLastVisible(null);
            fetchLeaderboard(1, 'first');
        }
    }, [selectedBranch, sortBy, fetchLeaderboard]);

    const handleNextPage = () => {
        if (!loadingMore && lastVisible && currentPage < totalPages) {
            fetchLeaderboard(currentPage + 1, 'next', lastVisible);
        }
    };
    const handlePrevPage = () => {
        if (!loadingMore && firstVisible && currentPage > 1) {
            fetchLeaderboard(currentPage - 1, 'prev', firstVisible);
        }
    };

    const handleSortChange = (newSortBy: 'contest' | 'practice') => {
        if (newSortBy !== sortBy) {
            setSortBy(newSortBy);
            setCurrentPage(1);
            setFirstVisible(null);
            setLastVisible(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
    const topThreePodium = !loadingData && currentPage === 1 ? leaderboard.slice(0, 3) : [];
    const listUsers = !loadingData && currentPage === 1 ? leaderboard.slice(topThreePodium.length) : leaderboard;

    const branchName = availableBranches[selectedBranch] || 'Overall';

    if (authLoading || loadingData || metadataLoading) {
        return <LeaderboardSkeleton />;
    }

    return (
        <div className="min-h-screen w-full px-4 py-6">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center gap-3 mb-1">
                        <Trophy className="w-8 h-8 text-yellow-400" />
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Leaderboard ({branchName})</h1>
                        <button
                            onClick={() => setIsInfoModalOpen(true)}
                            className="p-1 rounded-full text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            aria-label="How rating is calculated"
                        >
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                        {totalUsers > 0
                            ? `Showing ranks ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalUsers)} of ${totalUsers} total users`
                            : `Top performers for ${branchName}`
                        }
                    </p>
                </div>

                {/* Sorting Tabs */}
                <div className="flex justify-center mb-6">
                    <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex gap-1 shadow-inner border border-zinc-200/50 dark:border-zinc-700/50">
                        <button
                            onClick={() => handleSortChange('contest')}
                            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                                sortBy === 'contest'
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-md'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Trophy className="w-4 h-4" />
                            Contest Elo
                        </button>
                        <button
                            onClick={() => handleSortChange('practice')}
                            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                                sortBy === 'practice'
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-md'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Award className="w-4 h-4" />
                            Practice Rating
                        </button>
                    </div>
                </div>

                {currentPage === 1 && topThreePodium.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
                        {topThreePodium[1] && <PodiumCard user={topThreePodium[1]} rank={2} />}
                        {topThreePodium[0] && <PodiumCard user={topThreePodium[0]} rank={1} />}
                        {topThreePodium[2] && <PodiumCard user={topThreePodium[2]} rank={3} />}
                    </div>
                )}

                <div className="glass-card overflow-hidden relative mt-4">
                    {loadingMore && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
                    
                    {/* Table Header */}
                    <div className="flex items-center px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] sm:text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        <div className="w-12 text-center">Rank</div>
                        <div className="flex-1">User</div>
                        <div className="flex items-center justify-end gap-3 sm:gap-5 md:gap-8 text-right flex-shrink-0 pl-2">
                            <div className="min-w-[65px] sm:min-w-[75px]">Elo</div>
                            <div className="min-w-[65px] sm:min-w-[75px]">Practice</div>
                            <div className="min-w-[50px] sm:min-w-[60px]">Accuracy</div>
                        </div>
                    </div>

                    <div>
                        {listUsers.map((user, index) => {
                            const rankOffset = currentPage === 1 ? topThreePodium.length : 0;
                            const rank = (currentPage - 1) * PAGE_SIZE + rankOffset + index + 1;

                            return (
                                <div key={user.uid} className={`flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors`}>
                                    <div className="w-12 text-center font-bold text-zinc-500 dark:text-zinc-400 text-sm">
                                        {rank}
                                    </div>
                                    <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={user.avatar || '/user.png'}
                                            alt={user.name}
                                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border dark:border-zinc-700"
                                            onError={(e) => { (e.target as HTMLImageElement).src = '/user.png'; }}
                                        />
                                        <div className="overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/profile/${user.username}`} className={`font-medium hover:underline truncate text-sm block ${getRankTier(user.contestElo).color}`}>{user.name}</Link>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${getRankTier(user.contestElo).bg} ${getRankTier(user.contestElo).color}`}>{getRankTier(user.contestElo).title}</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">@{user.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 sm:gap-5 md:gap-8 text-right flex-shrink-0 pl-2">
                                        <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-yellow-600 dark:text-yellow-400 text-xs sm:text-sm min-w-[65px] sm:min-w-[75px]" title="Contest Elo">
                                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span className="font-semibold">{user.contestElo}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-blue-600 dark:text-blue-400 text-xs sm:text-sm min-w-[65px] sm:min-w-[75px]" title="Practice Rating">
                                            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span className="font-semibold">{user.practiceRating.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm min-w-[50px] sm:min-w-[60px]" title="Accuracy">
                                            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span className="font-semibold">{(user.stats?.accuracy ?? 0).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {listUsers.length === 0 && !loadingData && (
                            <p className="text-center py-10 text-zinc-500 dark:text-zinc-400">No users found for this page.</p>
                        )}
                    </div>
                </div>

                {totalUsers > PAGE_SIZE && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1 || loadingMore}
                            className="pagination-button"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages || loadingMore || leaderboard.length < PAGE_SIZE || !lastVisible}
                            className="pagination-button"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <RatingInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

            <style>{`
            .pagination-button {
                @apply w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed;
            }
      `}</style>
        </div>
    );
}
