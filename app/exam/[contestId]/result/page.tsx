"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Contest, ContestAttempt, Question } from '@/types/exam';
import { Loader2, CheckCircle, XCircle, AlertCircle, Home, FileText, ChevronUp, Clock } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import ImageZoom from '@/components/ui/ImageZoom';
import ReviewModeUI from '@/components/exam/ReviewModeUI';
import { getRankTier } from '@/utils/rating';

import { useSearchParams } from 'next/navigation';

export default function ExamResultPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const contestId = params.contestId as string;
    const attemptIdFromUrl = searchParams.get('attemptId');
    const { user, loading } = useAuth();
    const router = useRouter();

    const [attempt, setAttempt] = useState<ContestAttempt | null>(null);
    const [contest, setContest] = useState<Contest | null>(null);
    const [userRatingData, setUserRatingData] = useState<{ oldRating: number; newRating: number } | null>(null);
    const [enrichedQuestions, setEnrichedQuestions] = useState<Record<string, Question>>({});
    const [fetching, setFetching] = useState(true);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [globalRank, setGlobalRank] = useState<{ rank: number; total: number } | null>(null);
    const [globalAvgTimes, setGlobalAvgTimes] = useState<Record<string, number>>({});
    const [loadingRank, setLoadingRank] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchData = async () => {
                try {
                    // Use attemptId from URL if provided, otherwise legacy fallback
                    const finalAttemptId = attemptIdFromUrl || `${contestId}_${user.uid}`;

                    // Parallel fetch
                    const [contestSnap, attemptSnap] = await Promise.all([
                        getDoc(doc(db, 'contests', contestId)),
                        getDoc(doc(db, 'contest_attempts', finalAttemptId))
                    ]);

                    let fetchedContest: Contest | null = null;

                    if (contestSnap.exists()) {
                        fetchedContest = contestSnap.data() as Contest;
                        setContest(fetchedContest);
                    }
                    if (attemptSnap.exists()) {
                        setAttempt(attemptSnap.data() as ContestAttempt);
                    }

                    if (fetchedContest && fetchedContest.isRatingsProcessed && user) {
                        const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
                        if (userProfileSnap.exists()) {
                            const userData = userProfileSnap.data();
                            const ratingHistory = userData.ratingHistory || [];
                            const historyEntry = ratingHistory.find((entry: any) => entry.contestId === contestId);
                            if (historyEntry) {
                                setUserRatingData({
                                    oldRating: historyEntry.oldRating,
                                    newRating: historyEntry.newRating
                                });
                            }
                        }
                    }

                    // Hydrate questions if contest exists
                    if (fetchedContest && fetchedContest.branch) {
                        const branch = fetchedContest.branch.toLowerCase();
                        const questionCollection = `questions_${branch}`;
                        const allQIds = fetchedContest.sections.flatMap(s => s.questions.map(q => q.id));

                        // Fetch unique questions
                        const uniqueIds = Array.from(new Set(allQIds));
                        const questionPromises = uniqueIds.map(id => getDoc(doc(db, questionCollection, id)));

                        const questionSnaps = await Promise.all(questionPromises);
                        const enrichmentMap: Record<string, Question> = {};

                        questionSnaps.forEach(snap => {
                            if (snap.exists()) {
                                enrichmentMap[snap.id] = { id: snap.id, ...snap.data() } as Question;
                            }
                        });

                        setEnrichedQuestions(enrichmentMap);
                    }

                    // Fetch Global Rank securely via API
                    if (attemptSnap.exists()) {
                        const attData = attemptSnap.data() as ContestAttempt;
                        if (!attemptIdFromUrl && !attData.isPractice) {
                            try {
                                const res = await fetch(`/api/exam/rank?contestId=${contestId}&score=${attData.score || 0}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    setGlobalRank({
                                        rank: data.rank,
                                        total: data.totalUsers
                                    });
                                }
                            } catch (err) {
                                console.error("Error fetching ranking:", err);
                            }
                        }
                    }

                } catch (error) {
                    console.error("Error fetching results:", error);
                } finally {
                    setFetching(false);
                    setLoadingRank(false);
                }
            };
            fetchData();
        }
    }, [user, loading, contestId, router, attemptIdFromUrl]);

    if (loading || fetching) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!attempt || !contest) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950 text-gray-600 dark:text-gray-400">
                <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
                <h2 className="text-xl font-bold mb-2">Result Not Found</h2>
                <p>Could not load the result for this exam.</p>
                <button onClick={() => router.push('/contests')} className="mt-4 text-purple-600 hover:underline">
                    Go to Contests
                </button>
            </div>
        );
    }

    // --- Analysis Calculation ---
    const allQuestions = contest.sections.flatMap(s => s.questions);
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let score = 0;



    const questionAnalysis = allQuestions.map(basicQ => {
        // Merge: Use enriched data but fallback to basicQ for missing fields like marks
        const enrichedQ = enrichedQuestions[basicQ.id];
        const q: Question = enrichedQ ? { ...basicQ, ...enrichedQ } : basicQ;

        // Ensure marks is a number
        const marks = Number(q.marks) || Number(basicQ.marks) || 0;

        // Determine Negative Marks (Standard GATE Rule: 1/3rd of marks for MCQ, 0 for NAT/MSQ)
        let negativeMarks = Number(q.negative_marks);
        if (isNaN(negativeMarks)) {
            if (q.question_type === 'mcq') {
                negativeMarks = marks / 3;
            } else {
                negativeMarks = 0;
            }
        }

        // Re-assign for consistency in the object
        q.marks = marks;
        q.negative_marks = negativeMarks;

        const response = attempt.responses[q.id];
        // Defensive check for response existence
        // GATE Rule: 'marked_for_review' (Purple) without answer -> Score 0 (Not Attempted)
        // 'answered_marked_for_review' (Purple + Green) -> Evaluated (Attempted)
        const isAttempted = response && (response.status === 'answered' || response.status === 'answered_marked_for_review');

        let isCorrect = false;
        let userVal: any = null;

        if (isAttempted) {
            if (q.question_type === 'mcq') {
                const correctOption = q.options?.find(o => o.is_correct);
                const correctLabel = correctOption?.label;
                userVal = response.selectedOptions?.[0];

                if (correctLabel && userVal === correctLabel) isCorrect = true;
            } else if (q.question_type === 'msq') {
                const correctLabels = q.options?.filter(o => o.is_correct).map(o => o.label).sort();
                userVal = response.selectedOptions?.sort();
                if (correctLabels && userVal &&
                    correctLabels.length === userVal.length &&
                    correctLabels.every((val, index) => val === userVal[index])) {
                    isCorrect = true;
                }
            } else if (q.question_type === 'nat') {
                const val = parseFloat(response.natAnswer || '');
                const min = parseFloat(q.nat_answer_min || '');
                const max = parseFloat(q.nat_answer_max || '');
                userVal = response.natAnswer;
                if (!isNaN(val) && !isNaN(min) && !isNaN(max) && val >= min && val <= max) {
                    isCorrect = true;
                }
            }
        }

        // Tally
        if (!isAttempted) {
            skippedCount++;
        } else if (isCorrect) {
            correctCount++;
            score += marks;
        } else {
            wrongCount++;
            score -= negativeMarks;
        }

        return { question: q, response, isCorrect, isAttempted, userVal };
    });


    // --- Sectional Analysis ---
    const sectionalAnalysis = contest.sections.map(section => {
        const sectionQIds = section.questions.map(q => q.id);
        // Filter analysis for this section's questions
        const secResults = questionAnalysis.filter(qa => sectionQIds.includes(qa.question.id));

        const totalQ = section.questions.length;
        const attempted = secResults.filter(r => r.isAttempted).length;
        const correct = secResults.filter(r => r.isCorrect).length;
        // Wrong is attempted minus correct (simplification, but sufficient for counts)
        const wrong = attempted - correct;

        // Calculate score for this section
        const secScore = secResults.reduce((acc, r) => {
            if (!r.isAttempted) return acc;
            if (r.isCorrect) return acc + r.question.marks;
            return acc - (r.question.negative_marks || 0);
        }, 0);

        const totalMarks = secResults.reduce((acc, r) => acc + r.question.marks, 0);

        return {
            name: section.name,
            totalQ,
            attempted,
            correct,
            wrong,
            score: secScore,
            totalMarks
        };
    });




    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 py-8 font-sans">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white dark:bg-zinc-900 shadow-sm border-b dark:border-zinc-800 mb-8 px-4 py-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-md">{contest.title}</h1>
                    <p className="text-sm text-gray-500">Result Analysis</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsReviewMode(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium text-sm transition-colors border flex items-center gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        Review Exam
                    </button>
                    <button
                        onClick={() => router.push('/contests')}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-md flex items-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Contests
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">

                {!isReviewMode && (
                    /* --- SCORECARD VIEW --- */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border dark:border-zinc-800 text-center transform transition-transform hover:scale-[1.02]">
                                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Score</div>
                                <div className="text-4xl font-extrabold text-purple-600">{score.toFixed(2)}</div>
                                <div className="text-xs text-gray-400 mt-1">/ {contest.totalMarks} Marks</div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border dark:border-zinc-800 text-center transform transition-transform hover:scale-[1.02]">
                                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Global Rank</div>
                                {loadingRank ? (
                                    <div className="flex justify-center py-2"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                                ) : globalRank && globalRank.rank > 0 ? (
                                    <>
                                        <div className="text-4xl font-extrabold text-amber-500">
                                            {Math.max(0, ((globalRank.total - globalRank.rank) / globalRank.total) * 100).toFixed(1)}<span className="text-xl">%ile</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Rank #{globalRank.rank} / {globalRank.total}</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-4xl font-extrabold text-gray-400">N/A</div>
                                        <div className="text-xs text-gray-400 mt-1">Practice Mode</div>
                                    </>
                                )}
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border dark:border-zinc-800 text-center transform transition-transform hover:scale-[1.02]">
                                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Accuracy</div>
                                <div className="text-4xl font-extrabold text-green-600">
                                    {(correctCount + wrongCount) > 0 ? ((correctCount / (correctCount + wrongCount)) * 100).toFixed(1) : 0}%
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border dark:border-zinc-800 text-center transform transition-transform hover:scale-[1.02]">
                                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Attempted</div>
                                <div className="text-4xl font-extrabold text-blue-600">{correctCount + wrongCount}</div>
                                <div className="text-xs text-gray-400 mt-1">/ {allQuestions.length} Questions</div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border dark:border-zinc-800 transform transition-transform hover:scale-[1.02]">
                                <div className="space-y-3 h-full justify-center flex flex-col">
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Correct</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{correctCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Incorrect</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{wrongCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-gray-400" /> Skipped</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{skippedCount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Rating Change Card (Conditional) */}
                            {contest.isRatingsProcessed && userRatingData && (
                                <div className="md:col-span-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-4 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-full shadow-sm">
                                            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Rating Update</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Contest Rating has been finalized</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center justify-end gap-2">
                                            <span className="text-gray-400 text-lg line-through">{userRatingData.oldRating}</span>
                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                            <span className={getRankTier(userRatingData.newRating).color}>{userRatingData.newRating}</span>
                                            <span className={`text-sm ml-2 ${userRatingData.newRating >= userRatingData.oldRating ? 'text-green-500' : 'text-red-500'}`}>
                                                ({userRatingData.newRating >= userRatingData.oldRating ? '+' : ''}{userRatingData.newRating - userRatingData.oldRating})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>


                        {/* --- NEW: Sectional Analysis --- */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 p-1.5 rounded-md">
                                    <FileText className="w-4 h-4" />
                                </span>
                                Sectional Analysis
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sectionalAnalysis.map((sec, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-xl p-6 border dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                                        <h4 className="font-bold text-base mb-4 text-gray-700 dark:text-white border-b dark:border-zinc-800 pb-3 flex justify-between items-center">
                                            {sec.name}
                                            <span className="text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500 font-medium">
                                                {sec.totalQ} Qs
                                            </span>
                                        </h4>

                                        {/* Score & Progress */}
                                        <div className="mb-4">
                                            <div className="flex justify-between items-end mb-2">
                                                <div>
                                                    <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                                                        {typeof sec.score === 'number' ? sec.score.toFixed(2) : '0.00'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 ml-1 font-medium">/ {sec.totalMarks}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-400 mb-0.5">Accuracy</div>
                                                    <div className="font-bold text-gray-800 dark:text-gray-200">
                                                        {sec.attempted > 0 ? ((sec.correct / sec.attempted) * 100).toFixed(0) : 0}%
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${Math.max(0, Math.min(100, (sec.score / sec.totalMarks) * 100))}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded p-2">
                                                <div className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1">Attempted</div>
                                                <div className="font-bold text-gray-800 dark:text-gray-200">{sec.attempted}</div>
                                            </div>
                                            <div className="bg-green-50 dark:bg-green-900/10 rounded p-2">
                                                <div className="text-[10px] uppercase tracking-wider text-green-600 font-bold mb-1">Correct</div>
                                                <div className="font-bold text-green-700 dark:text-green-400">{sec.correct}</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 rounded p-2">
                                                <div className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1">Wrong</div>
                                                <div className="font-bold text-red-700 dark:text-red-400">{sec.wrong}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* --- NEW: Time-Per-Question Analysis --- */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-1.5 rounded-md">
                                    <Clock className="w-4 h-4" />
                                </span>
                                Time Analysis vs Global Average
                            </h3>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border dark:border-zinc-800 shadow-sm overflow-x-auto">
                                <div className="min-w-[500px]">
                                    {questionAnalysis.map((qa, idx) => {
                                        if (!qa.isAttempted && (!qa.response || !qa.response.timeSpent)) return null;

                                        const myTime = qa.response?.timeSpent || 0;
                                        const avgTime = globalAvgTimes?.[qa.question.id] || 0;
                                        const maxTime = Math.max(120, myTime, avgTime);

                                        return (
                                            <div key={qa.question.id} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition-colors">
                                                <div className="w-8 shrink-0 text-sm font-bold text-gray-500 dark:text-zinc-400">Q{idx + 1}</div>
                                                <div className="flex-1 space-y-2 relative pt-2 pb-2">
                                                    {/* My Time Bar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 shrink-0 text-[10px] font-semibold text-gray-400 uppercase text-right tracking-wider">You</div>
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <div className={`h-4 rounded-r-md ${myTime > avgTime * 1.5 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${Math.max(2, (myTime / maxTime) * 100)}%` }}></div>
                                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{Math.floor(myTime / 60)}m {myTime % 60}s</span>
                                                        </div>
                                                    </div>
                                                    {/* Avg Time Bar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 shrink-0 text-[10px] font-semibold text-gray-400 uppercase text-right tracking-wider">Avg</div>
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <div className="h-2 rounded-r-sm bg-gray-300 dark:bg-zinc-600" style={{ width: `${Math.max(2, (avgTime / maxTime) * 100)}%` }}></div>
                                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{Math.floor(avgTime / 60)}m {avgTime % 60}s</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Prompt to View Solutions */}
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-100 dark:border-purple-800 rounded-lg p-8 text-center shadow-sm">
                            <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-2">Review Your Performance</h3>
                            <p className="text-purple-700 dark:text-purple-300 mb-6 max-w-2xl mx-auto">
                                Analyze every question, view correct answers, and read detailed explanations to improve your concepts.
                            </p>
                            <button
                                onClick={() => setIsReviewMode(true)}
                                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <FileText className="w-5 h-5" />
                                Enter Review Mode
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SOLUTIONS FULLSCREEN VIEW --- */}
            {isReviewMode && (
                <ReviewModeUI
                    questionAnalysis={questionAnalysis}
                    contest={contest}
                    onExit={() => setIsReviewMode(false)}
                />
            )}
        </div>
    );
}

// Sub-component for Solution Card
function SolutionCard({ question, index, isGivenCorrect, isAttempted, userVal }: any) {
    // Determine status color
    let statusColor = "border-gray-200 dark:border-zinc-800";
    let statusBadge = <span className="text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs font-semibold">Skipped</span>;

    if (isAttempted) {
        if (isGivenCorrect) {
            statusColor = "border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10";
            statusBadge = <span className="text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Correct</span>;
        } else {
            statusColor = "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10";
            statusBadge = <span className="text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Incorrect</span>;
        }
    }

    return (
        <div className={`bg-white dark:bg-zinc-900 rounded-lg border shadow-sm p-6 ${statusColor} transition-all hover:shadow-md`}>
            <div className="flex justify-between items-start mb-4 border-b dark:border-zinc-800/50 pb-4">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-gray-600 dark:text-gray-400 text-sm border dark:border-zinc-700">
                        {index}
                    </span>
                    {statusBadge}
                </div>
                <div className="text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded border dark:border-zinc-700">
                    Marks: <span className={isGivenCorrect ? 'text-green-600' : (isAttempted ? 'text-red-500' : 'text-gray-500')}>
                        {isGivenCorrect ? `+${question.marks}` : (isAttempted ? `-${question.negative_marks || 0}` : '0')}
                    </span>
                </div>
            </div>

            {/* Question */}
            <div className="mb-6">
                <div className="prose dark:prose-invert max-w-none text-sm sm:text-base text-gray-800 dark:text-gray-200">
                    {(() => {
                        const cleanHtml = extractAndCleanHtml(question.question_html);
                        if (!cleanHtml) console.warn(`DEBUG: Empty HTML for question ${question.id}`);
                        return <LatexRenderer content={cleanHtml} />;
                    })()}
                </div>

                {question.question_image_links && question.question_image_links.length > 0 && (
                    <div className="mt-4 flex flex-col items-center gap-4">
                        {question.question_image_links.map((link: string, i: number) => (
                            <ImageZoom
                                key={i}
                                src={link}
                                alt={`Figure ${i + 1}`}
                                className="max-h-[400px]"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Options / Answer */}
            <div className="space-y-3 mb-6">
                {question.question_type === 'nat' ? (
                    <div className="flex gap-4 items-center flex-wrap">
                        <div className={`p-3 rounded border font-mono ${!isAttempted ? 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700' : (isGivenCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800')}`}>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Your Answer</span>
                            <span className="font-bold text-lg">{isAttempted ? userVal : '-'}</span>
                        </div>
                        <div className="p-3 rounded border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 font-mono">
                            <span className="text-xs text-green-600 dark:text-green-400 block mb-1">Correct Range</span>
                            <span className="font-bold text-green-800 dark:text-green-300 text-lg">{question.nat_answer_min} - {question.nat_answer_max}</span>
                        </div>
                    </div>
                ) : (
                    question.options?.map((opt: any, i: number) => {
                        const isSelected = Array.isArray(userVal) ? userVal.includes(opt.label) : userVal === opt.label;
                        const isOptCorrect = opt.is_correct;

                        let optClass = "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 opacity-80";
                        if (isSelected && isOptCorrect) optClass = "border-green-500 bg-green-50 dark:bg-green-900/30 shadow-sm opacity-100 ring-1 ring-green-500";
                        else if (isSelected && !isOptCorrect) optClass = "border-red-500 bg-red-50 dark:bg-red-900/30 opacity-100 ring-1 ring-red-500";
                        else if (!isSelected && isOptCorrect) optClass = "border-green-500 border-dashed bg-green-50/30 dark:bg-green-900/10 opacity-100";

                        return (
                            <div key={i} className={`flex p-3 rounded-lg border ${optClass} transition-colors items-start`}>
                                <div className={`font-bold mr-3 w-6 shrink-0 mt-0.5 ${isOptCorrect ? 'text-green-600' : 'text-gray-500'}`}>{opt.label}.</div>
                                <div className="flex-1 text-sm"><LatexRenderer content={extractAndCleanHtml(opt.text_html)} inline /></div>
                                {isOptCorrect && <CheckCircle className="w-5 h-5 text-green-600 ml-2 shrink-0" />}
                                {isSelected && !isOptCorrect && <XCircle className="w-5 h-5 text-red-600 ml-2 shrink-0" />}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Explanation */}
            {/* Explanation */}
            {(question.explanation_html || question.explanation_redirect_url) && (
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-sm">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Explanation
                    </h4>
                    <div className="prose dark:prose-invert max-w-none text-blue-900 dark:text-blue-100/80">
                        {question.explanation_redirect_url ? (
                            <p>
                                This explanation is provided by GateOverflow.
                                <a
                                    href={question.explanation_redirect_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline font-semibold inline-flex items-center gap-1 ml-1"
                                >
                                    Click here to view the full discussion
                                </a>
                            </p>
                        ) : (
                            <LatexRenderer content={extractAndCleanHtml(question.explanation_html, 'mtq_explanation-text')} />
                        )}
                    </div>
                    {/* Explanation Images */}
                    {question.explanation_image_links && question.explanation_image_links.length > 0 && (
                        <div className="mt-4 flex flex-col items-center gap-4">
                            {question.explanation_image_links.map((link: string, i: number) => (
                                <ImageZoom
                                    key={i}
                                    src={link}
                                    alt={`Explanation Figure ${i + 1}`}
                                    className="max-h-[300px] border-blue-200 dark:border-blue-800"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
