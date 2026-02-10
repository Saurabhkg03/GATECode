"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/firebase';
import { collection, getDocs, query, limit, orderBy, startAfter, QueryDocumentSnapshot, DocumentData, endBefore, limitToLast } from 'firebase/firestore';
import { Contest } from '@/types/exam';

import ContestGenerator from '@/components/admin/ContestGenerator';
import { BrainCircuit, Clock, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';

const ContestsPage = () => {
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [page, setPage] = useState(1);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isNextAvailable, setIsNextAvailable] = useState(true);
    // History of "first visible" docs to enable previous button logic correctly with cursor pagination
    // Actually simpler: For "Previous", we can use endBefore(firstVisible).
    // But for Next, startAfter(lastVisible).

    const PAGE_SIZE = 9; // Grid of 3x3 looks nice

    const fetchContests = async (direction: 'first' | 'next' | 'prev' = 'first') => {
        try {
            setLoading(true);
            const contestsRef = collection(db, 'contests');

            // Default: Newest first (assuming ID starts with timestamp or we trust natural order if we don't have createdAt)
            // The generator makes IDs: `mock-${branch}-${Date.now()}`. 
            // String sorting these IDs (descending) puts newest first! 
            // 'mock-ece-170...' > 'mock-ece-160...'
            let q = query(contestsRef, orderBy('id', 'desc'), limit(PAGE_SIZE));

            if (direction === 'next' && lastVisible) {
                q = query(contestsRef, orderBy('id', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
            } else if (direction === 'prev' && firstVisible) {
                // To go back, we find the ones ending before the current first
                // limitToLast gives us the previous page size ending exactly before current
                q = query(contestsRef, orderBy('id', 'desc'), endBefore(firstVisible), limitToLast(PAGE_SIZE));
            }

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const fetchedContests: Contest[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedContests.push({ id: doc.id, ...doc.data() } as Contest);
                });

                setContests(fetchedContests);
                setFirstVisible(querySnapshot.docs[0]);
                setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);

                // Update Page Number
                if (direction === 'next') setPage(p => p + 1);
                if (direction === 'prev') setPage(p => Math.max(1, p - 1));
                if (direction === 'first') setPage(1);

                // Check availability (rough check: if we got full page, assume next might exist)
                setIsNextAvailable(querySnapshot.docs.length === PAGE_SIZE);
            } else {
                if (direction === 'first') {
                    setContests([]);
                    setIsNextAvailable(false);
                }
                // If next was empty, we just don't update (end of list)
            }

        } catch (error) {
            console.error("Error fetching contests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContests('first');
    }, []);

    // For the auto-refresh from generator, we reset to first page to show new item
    const handleRefresh = () => fetchContests('first');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Contests</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Prepare for GATE with real-time mock tests.</p>
                    </div>
                </div>

                {/* Developer Tools Section */}
                <div className="mb-12 space-y-6">
                    <ContestGenerator onContestCreated={handleRefresh} />
                </div>

                {loading ? (
                    <div className="text-center py-12 dark:text-gray-400">Loading contests...</div>
                ) : contests.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg shadow border dark:border-zinc-800">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No active contests found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Check back later or use the generator above.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-6">
                            {contests.map((contest) => (
                                <div key={contest.id} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase rounded-full">Live</span>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{contest.title}</h3>
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mt-3">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>{contest.durationMinutes} Minutes</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <BrainCircuit className="w-4 h-4" />
                                                <span>{contest.totalMarks || 100} Marks</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>{contest.sections?.length || 2} Sections</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/exam/${contest.id}/intro`}
                                        className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-transform hover:scale-105 flex items-center justify-center gap-2"
                                    >
                                        Start Contest <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        <div className="mt-8 flex items-center justify-between border-t dark:border-zinc-800 pt-6">
                            <button
                                onClick={() => fetchContests('prev')}
                                disabled={page === 1 || loading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Page <span className="font-semibold text-gray-900 dark:text-white">{page}</span>
                            </span>
                            <button
                                onClick={() => fetchContests('next')}
                                disabled={!isNextAvailable || loading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
export default ContestsPage;
