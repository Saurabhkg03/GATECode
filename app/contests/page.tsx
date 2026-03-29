"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/firebase";
import {
    collection,
    getDocs,
    query,
    limit,
    orderBy,
    deleteDoc,
    doc,
    where,
    startAfter,
    DocumentData,
    QueryDocumentSnapshot
} from "firebase/firestore";
import { Contest } from "@/types/exam";
import { useAuth } from "@/contexts/AuthContext";
import {
    getNextWeeklyContest,
    getNextBiweeklyContest,
} from "@/utils/contestSchedule";
import CountdownTimer from "@/components/contests/CountdownTimer";
import ContestGenerator from "@/components/admin/ContestGenerator";
import {
    BrainCircuit,
    Clock,
    Calendar,
    ChevronRight,
    Trophy,
    Target,
    X,
    Trash2,
    LayoutGrid,
    User,
    Sparkles,
    Lock,
    Timer,
    Radio,
    History,
    Zap,
    CheckCircle2,
    Bell,
    Check,
    Search,
    Filter,
    SlidersHorizontal,
    GraduationCap,
    Gauge,
    ChevronDown
} from "lucide-react";

type TabType = "official" | "community" | "mine";
const ITEMS_PER_PAGE = 12;

const GATE_BRANCHES = [
    "AE", "AG", "AR", "BM", "BT", "CE", "CH", "CS", "CY", "DA", "EC", "EE",
    "ES", "EY", "GG", "IN", "MA", "ME", "MN", "MT", "NM", "PE", "PH", "PI",
    "ST", "TF", "XE", "XH", "XL"
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const now = () => Date.now();

/** contest hasn't started yet */
const isUpcoming = (c: Contest) =>
    !!c.startTime && new Date(c.startTime).getTime() > now();

/** contest has started but not yet ended */
const isLive = (c: Contest) => {
    // No startTime = admin on-demand contest — always live/available
    if (!c.startTime) return true;
    const start = new Date(c.startTime).getTime();
    if (start > now()) return false; // hasn't started yet → upcoming
    if (c.endTime) return new Date(c.endTime).getTime() > now();
    // fallback: use durationMinutes if no endTime
    return start + c.durationMinutes * 60_000 > now();
};

/** contest has ended */
const isPast = (c: Contest) => {
    // No startTime = admin on-demand contest — never ends
    if (!c.startTime) return false;
    const start = new Date(c.startTime).getTime();
    // hasn't started yet → not past
    if (start > now()) return false;
    if (c.endTime) return new Date(c.endTime).getTime() <= now();
    // fallback: use durationMinutes
    return start + c.durationMinutes * 60_000 <= now();
};

/**
 * Mutually-exclusive status classification.
 * Priority order: upcoming > live > past.
 * A contest can only ever be in ONE of these three categories.
 */
const getContestStatus = (c: Contest): "upcoming" | "live" | "past" => {
    if (isUpcoming(c)) return "upcoming";
    if (isLive(c)) return "live";
    return "past";
};

// (ScheduledDetailModal removed — weekly/biweekly cards now navigate to /contests/[id])
// ─── Small contest card (for grid) ───────────────────────────────────────────

const ContestCard = ({
    contest,
    type,
    onDelete,
    isRegistered,
    attempt
}: {
    contest: Contest;
    type: "admin" | "mock" | "mine";
    onDelete?: (id: string) => void;
    isRegistered?: boolean;
    attempt?: { isSubmitted: boolean; timeLeftSeconds: number };
}) => {
    const router = useRouter();
    const upcoming = isUpcoming(contest);
    const live = isLive(contest);
    const past = isPast(contest);
    const startDate = contest.startTime ? new Date(contest.startTime) : null;
    const endDate = contest.endTime ? new Date(contest.endTime) : null;

    const handleClick = () => {
        router.push(`/contests/${contest.id}`);
    };

    return (
        <div
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            role="link"
            tabIndex={0}
            className={`group flex flex-col justify-between rounded-[24px] p-6 border transition-all duration-300 h-full relative overflow-hidden cursor-pointer ${
                type === "admin" 
                    ? "bg-slate-50 dark:bg-zinc-900 border-amber-200/50 dark:border-amber-500/10 hover:shadow-xl hover:shadow-amber-500/5" 
                    : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/50 hover:shadow-xl hover:shadow-blue-500/5"
            } ${isPast(contest) ? "opacity-85 grayscale-[0.3]" : "shadow-sm"} ${live ? "ring-1 ring-emerald-500/30" : ""}`}
        >
            <div className="relative z-10">
                {/* Badges row */}
                <div className="flex justify-between items-start mb-5">
                    <div className="flex gap-2 flex-wrap">
                        {type === "admin" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/20">
                                <Sparkles className="w-3 h-3" /> Official
                            </span>
                        )}
                        {contest.branch && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400">
                                {contest.branch}
                            </span>
                        )}
                        {live && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span> Live
                            </span>
                        )}
                    </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                    {contest.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400/90 mb-5 line-clamp-2">
                    {contest.description || "Take this challenge to benchmark your preparation."}
                </p>

                {upcoming && startDate && (
                    <div className="mb-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400/80 mb-2 flex items-center gap-2">
                            <Timer className="w-3.5 h-3.5" /> Starts In
                        </p>
                        <CountdownTimer targetDate={startDate} compact={true} onComplete={() => { }} />
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-6">
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-500">
                        <Clock className="w-3.5 h-3.5" /> {contest.durationMinutes} min
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-500">
                        <Trophy className="w-3.5 h-3.5" /> {contest.totalMarks || 100} Marks
                    </div>
                </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-slate-50 dark:border-zinc-800">
                {upcoming ? (
                    <div className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 cursor-not-allowed select-none">
                        <Lock className="w-4 h-4" /> Locked
                    </div>
                ) : attempt && !attempt.isSubmitted && attempt.timeLeftSeconds > 0 ? (
                    <Link
                        href={`/exam/${contest.id}/live`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-center transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg active:scale-[0.98]"
                    >
                        <Timer className="w-4 h-4" /> Resume Now
                    </Link>
                ) : attempt?.isSubmitted ? (
                    <Link
                        href={`/exam/${contest.id}/intro`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-center transition-all duration-300 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 active:scale-[0.98]"
                    >
                        <Check className="w-4 h-4 text-emerald-500" /> Results
                    </Link>
                ) : (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="contents"
                    >
                        <Link
                            href={`/contests/${contest.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-center transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] ${
                                live
                                    ? "bg-emerald-500 text-white shadow-lg"
                                    : "bg-zinc-900 text-white dark:bg-white dark:text-black"
                            }`}
                        >
                            {live ? <><Radio className="w-4 h-4 animate-pulse" /> Join Live</> : isPast(contest) ? <>Practice <ChevronRight className="w-4 h-4" /></> : <>Start <ChevronRight className="w-4 h-4" /></>}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Section heading ──────────────────────────────────────────────────────────

const SectionHeading = ({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) => (
    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-zinc-800 pb-4">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            {icon} {label}
        </h2>
        {count !== undefined && (
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{count}</span>
        )}
    </div>
);

// ─── Scheduled thumbnail card (Weekly / Biweekly) ────────────────────────────

const ScheduledContestCard = ({
    type,
    isRegistered,
}: {
    type: "weekly" | "biweekly";
    isRegistered?: boolean;
}) => {
    const isWeekly = type === "weekly";
    const info = isWeekly ? getNextWeeklyContest() : getNextBiweeklyContest();
    const live = isLive({ startTime: info.startTime.toISOString(), durationMinutes: info.durationMinutes } as Contest);

    return (
        <Link
            href={`/contests/${info.id}`}
            className={`flex-1 relative rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-[1.015] active:scale-[0.99] hover:brightness-105 ${
                isWeekly
                    ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
                    : "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700"
            }`}
            style={{ minHeight: 180, display: "flex" }}
        >
            {/* Decorative Zap illustration(s) */}
            <div className="absolute right-4 inset-y-0 flex items-center gap-0 pointer-events-none select-none">
                {!isWeekly && (
                    <Zap
                        className="w-24 h-24 opacity-15 group-hover:opacity-25 transition-all duration-500 text-white -mr-4 group-hover:scale-105"
                        strokeWidth={1.5}
                    />
                )}
                <Zap
                    className="w-32 h-32 opacity-20 group-hover:opacity-30 transition-all duration-500 text-white group-hover:scale-110"
                    strokeWidth={1.5}
                />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 flex flex-col justify-between w-full">
                {/* Top row: badge + live/countdown */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 bg-black/25 text-white text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1.5">
                            {isWeekly
                                ? <><Trophy className="w-3 h-3" /> Weekly Contest</>
                                : <><Sparkles className="w-3 h-3" /> Biweekly Contest</>
                            }
                        </span>
                        {live && (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                                </span>
                                Live
                            </span>
                        )}
                    </div>
                    {!live && (
                        <div className="inline-flex items-center gap-1.5 bg-white text-gray-900 text-[11px] font-bold rounded-full px-3 py-1.5 tabular-nums shadow">
                            <Clock className="w-3 h-3 shrink-0 text-gray-600" />
                            <CountdownTimer targetDate={info.startTime} compact={true} onComplete={() => { }} />
                        </div>
                    )}
                </div>

                {/* Title + date */}
                <div className="mt-5">
                    <h2 className="text-[22px] font-black text-white leading-tight drop-shadow">
                        {isWeekly ? "Weekly" : "Biweekly"} Mock {info.number}
                    </h2>
                    <div className="mt-2 flex items-center gap-4 flex-wrap">
                        <p className="inline-flex items-center gap-1.5 bg-black/20 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {info.startTime.toLocaleString("en-IN", { day: "numeric", month: "short", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="inline-flex items-center gap-1.5 bg-black/20 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1">
                            <Timer className="w-3 h-3 shrink-0" />
                            {info.durationMinutes} min
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const ContestsPage = () => {
    const { userInfo, user, isAuthenticated } = useAuth();
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGenerator, setShowGenerator] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("official");
    const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
    const [attemptMap, setAttemptMap] = useState<Record<string, { isSubmitted: boolean; timeLeftSeconds: number }>>({});

    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("All");
    const [selectedDifficulty, setSelectedDifficulty] = useState("All");
    const [selectedDuration, setSelectedDuration] = useState("All");
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    // Re-render tick every 60s so contest states (live/upcoming/past) update automatically
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    const fetchContests = async (isLoadMore = false) => {
        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else {
                setLoading(true);
                setLastDoc(null);
            }

            let conditions = [];

            // Tab filtering
            if (activeTab === "official") {
                conditions.push(where("type", "==", "admin"));
            } else if (activeTab === "mine") {
                if (userInfo?.uid) {
                    conditions.push(where("createdBy", "==", userInfo.uid));
                }
            } else if (activeTab === "community") {
                conditions.push(where("isPublic", "==", true));
                conditions.push(where("type", "==", "mock"));
            }

            // Dropdown Filters
            if (selectedBranch !== "All") {
                conditions.push(where("branch", "==", selectedBranch));
            }
            if (selectedDifficulty !== "All") {
                conditions.push(where("difficulty", "==", selectedDifficulty));
            }

            let q;
            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, "contests"),
                    ...conditions,
                    orderBy("id", "desc"),
                    startAfter(lastDoc),
                    limit(ITEMS_PER_PAGE)
                );
            } else {
                q = query(
                    collection(db, "contests"),
                    ...conditions,
                    orderBy("id", "desc"),
                    limit(ITEMS_PER_PAGE)
                );
            }

            const snap = await getDocs(q);
            const list: Contest[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Contest));

            if (!snap.empty) {
                setLastDoc(snap.docs[snap.docs.length - 1]);
            }
            setHasMore(snap.docs.length === ITEMS_PER_PAGE);

            if (isLoadMore) {
                setContests((prev) => [...prev, ...list]);
            } else {
                setContests(list);
            }
        } catch (e) {
            console.error("Error fetching contests:", e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Re-fetch contests when tab or filters change
    useEffect(() => {
        // Skip fetching 'mine' tab if userInfo is not loaded
        if (activeTab === 'mine' && !userInfo?.uid) return;
        fetchContests();
    }, [activeTab, selectedBranch, selectedDifficulty, userInfo?.uid]);

    // ── Load user's registered contest IDs & attempts ────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const loadUserData = async () => {
            try {
                // Load Registrations
                const regQ = query(
                    collection(db, "contestRegistrations"),
                    where("uid", "==", user.uid)
                );
                const regSnap = await getDocs(regQ);
                setRegisteredIds(new Set(regSnap.docs.map((d) => d.data().contestId as string)));

                // Load Attempts
                const attemptQ = query(
                    collection(db, "contest_attempts"),
                    where("uid", "==", user.uid)
                );
                const attemptSnap = await getDocs(attemptQ);
                const map: Record<string, { isSubmitted: boolean; timeLeftSeconds: number }> = {};
                attemptSnap.forEach(d => {
                    const data = d.data();
                    const cid = data.contestId as string;
                    if (!map[cid] || !data.isSubmitted) {
                        map[cid] = {
                            isSubmitted: !!data.isSubmitted,
                            timeLeftSeconds: data.timeLeftSeconds || 0
                        };
                    }
                });
                setAttemptMap(map);
            } catch (e) {
                console.error("Error loading user data:", e);
            }
        };
        loadUserData();
    }, [user]);

    const handleRefresh = () => { fetchContests(); setShowGenerator(false); };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this mock contest?")) return;
        try {
            await deleteDoc(doc(db, "contests", id));
            setContests((prev) => prev.filter((c) => c.id !== id));
        } catch {
            alert("Failed to delete.");
        }
    };

    // Derived state for filters
    const availableBranches = GATE_BRANCHES;

    // Local filter logic for what's not efficiently possible in Firestore
    const filteredContests = contests.filter((c) => {
        // Search
        if (searchQuery) {
            const queryLowercase = searchQuery.toLowerCase();
            const matchesTitle = c.title.toLowerCase().includes(queryLowercase);
            const matchesDesc = c.description?.toLowerCase().includes(queryLowercase);
            if (!matchesTitle && !matchesDesc) return false;
        }
        // Duration
        if (selectedDuration !== "All") {
            if (selectedDuration === "Short (< 30m)" && c.durationMinutes >= 30) return false;
            if (selectedDuration === "Medium (30-90m)" && (c.durationMinutes < 30 || c.durationMinutes > 90)) return false;
            if (selectedDuration === "Long (> 90m)" && c.durationMinutes <= 90) return false;
        }
        return true;
    });

    // We no longer partition massive data locally since we are query-based. 
    // filteredContests now exactly applies to the active tab's logic mostly.

    // Mutually-exclusive partition using priority: upcoming > live > past
    const partitionByStatus = (list: Contest[]) => {
        const upcoming: Contest[] = [];
        const live: Contest[] = [];
        const past: Contest[] = [];
        for (const c of list) {
            const status = getContestStatus(c);
            if (status === "upcoming") upcoming.push(c);
            else if (status === "live") live.push(c);
            else past.push(c);
        }
        return { upcoming, live, past };
    };

    const partitionedContests = partitionByStatus(filteredContests);

    // Identify past weekly/biweekly for special section
    const pastOfficialWeeklyBiweekly = activeTab === "official" ? partitionedContests.past.filter(c => 
        c.type === "admin" && (c.id.startsWith("weekly-") || c.id.startsWith("biweekly-") || c.title.toLowerCase().includes("weekly") || c.title.toLowerCase().includes("biweekly"))
    ) : [];
    
    // Other past official contests
    const pastOfficialOthers = activeTab === "official" ? partitionedContests.past.filter(c => 
        !(c.type === "admin" && (c.id.startsWith("weekly-") || c.id.startsWith("biweekly-") || c.title.toLowerCase().includes("weekly") || c.title.toLowerCase().includes("biweekly")))
    ) : [];

    const cardType = (c: Contest, tab: TabType): "admin" | "mock" | "mine" =>
        tab === "mine" ? "mine" : c.type === "admin" ? "admin" : "mock";

    const renderGrid = (list: Contest[], tab: TabType, columnsClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4") =>
        list.length === 0 ? null : (
            <div className={`grid ${columnsClass} gap-5`}>
                {list.map((c) => (
                    <ContestCard
                        key={c.id}
                        contest={c}
                        type={cardType(c, tab)}
                        onDelete={tab === "mine" ? handleDelete : undefined}
                        isRegistered={registeredIds.has(c.id)}
                        attempt={attemptMap[c.id]}
                    />
                ))}
            </div>
        );

    const renderEmpty = (tab: TabType) => (
        <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-3xl border border-dashed border-gray-300 dark:border-zinc-800">
            {tab === "official" && <Trophy className="w-14 h-14 mx-auto text-gray-300 dark:text-zinc-700 mb-5" />}
            {tab === "community" && <Target className="w-14 h-14 mx-auto text-gray-300 dark:text-zinc-700 mb-5" />}
            {tab === "mine" && <User className="w-14 h-14 mx-auto text-gray-300 dark:text-zinc-700 mb-5" />}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {tab === "official" && "No Official Contests Yet"}
                {tab === "community" && "No Community Mocks Yet"}
                {tab === "mine" && "No Mocks Created Yet"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-xs mx-auto">
                {tab === "official" && "No live or past official contests right now."}
                {tab === "community" && "Be the first to create a public practice exam!"}
                {tab === "mine" && 'Click "Create Custom Mock" to generate a personalized exam.'}
            </p>
        </div>
    );

    // weekly/biweekly scheduled contest IDs for registration badge
    const weeklyInfo = getNextWeeklyContest();
    const biweeklyInfo = getNextBiweeklyContest();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors">

            {/* Page header */}
            <div className="relative pt-10 pb-5 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_70%)] rounded-full" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-1.5 relative z-10">Contest</h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm relative z-10">Contest every week. Compete and see your ranking!</p>
            </div>

            {/* Tab bar + actions */}
            <div className="px-4 sm:px-6 lg:px-8 pb-12">
                <div className="max-w-7xl mx-auto space-y-7">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="inline-flex bg-gray-200/50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                            {(["official", "community", "mine"] as TabType[]).map((tab) => {
                                if (tab === "mine" && !userInfo) return null;
                                const icons = { official: <Trophy className="w-4 h-4" />, community: <LayoutGrid className="w-4 h-4" />, mine: <User className="w-4 h-4" /> };
                                const labels = { official: "Official", community: "Community", mine: "My Mocks" };
                                const activeColor = { official: "text-red-500", community: "text-blue-500", mine: "text-indigo-500" };
                                return (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-zinc-700" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}
                                    >
                                        <span className={activeTab === tab ? activeColor[tab] : ""}>{icons[tab]}</span>
                                        {labels[tab]}
                                    </button>
                                );
                            })}
                        </div>
                        {isAuthenticated && (
                            <button
                                onClick={() => setShowGenerator(!showGenerator)}
                                className={`hidden sm:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${showGenerator ? "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300" : "bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-gray-100 border-transparent text-white dark:text-black hover:scale-[1.02]"}`}
                            >
                                {showGenerator ? <><X className="w-4 h-4" /> Close</> : <><Sparkles className="w-4 h-4" /> Create Custom Mock</>}
                            </button>
                        )}
                    </div>

                    {isAuthenticated && showGenerator && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <ContestGenerator onContestCreated={handleRefresh} isAdminContest={false} />
                        </div>
                    )}

                    {/* ── FILTER BAR ── */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search mock tests..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:text-gray-200"
                                    />
                                </div>

                                {/* Filter Toggle (Mobile Only) */}
                                <button
                                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                                    className={`lg:hidden flex items-center justify-center p-2.5 rounded-xl border transition-all ${showMobileFilters ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400" : "bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-500"}`}
                                    title="Toggle Filters"
                                >
                                    <SlidersHorizontal className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Mobile Create Custom Mock Button */}
                            {isAuthenticated && activeTab === "mine" && (
                                <button
                                    onClick={() => setShowGenerator(!showGenerator)}
                                    className={`sm:hidden w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${showGenerator ? "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300" : "bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-gray-100 border-transparent text-white dark:text-black"}`}
                                >
                                    {showGenerator ? <><X className="w-4 h-4" /> Close</> : <><Sparkles className="w-4 h-4" /> Create Custom Mock</>}
                                </button>
                            )}

                            {/* Dropdowns - Collapsible on Mobile, always visible on LG+ */}
                            <div className={`${showMobileFilters ? "flex" : "hidden lg:flex"} flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}>
                                {/* Branch */}
                                <div className="relative isolate flex-1 sm:flex-none">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <GraduationCap className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="w-full sm:w-40 pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value="All">All Branches</option>
                                        {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Difficulty */}
                                <div className="relative isolate flex-1 sm:flex-none">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Gauge className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <select
                                        value={selectedDifficulty}
                                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                                        className="w-full sm:w-36 pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value="All">All Difficulties</option>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Duration */}
                                <div className="relative isolate flex-1 sm:flex-none">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <select
                                        value={selectedDuration}
                                        onChange={(e) => setSelectedDuration(e.target.value)}
                                        className="w-full sm:w-48 pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value="All">Any Duration</option>
                                        <option value="Short (< 30m)">Short (&lt; 30m)</option>
                                        <option value="Medium (30-90m)">Medium (30-90m)</option>
                                        <option value="Long (> 90m)">Long (&gt; 90m)</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── OFFICIAL TAB ── */}
                    {activeTab === "official" && (
                        <div className="space-y-8">
                            {/* Scheduled / Upcoming contests (weekly + biweekly) */}
                            <div className="space-y-4">
                                <SectionHeading icon={<Timer className="w-5 h-5 text-amber-500" />} label="Upcoming Contests" />
                                <div className="flex flex-col sm:flex-row gap-5">
                                    <ScheduledContestCard type="weekly" isRegistered={registeredIds.has(weeklyInfo.id)} />
                                    <ScheduledContestCard type="biweekly" isRegistered={registeredIds.has(biweeklyInfo.id)} />
                                </div>
                                {/* Scheduled admin contests */}
                                {partitionedContests.upcoming.length > 0 && renderGrid(partitionedContests.upcoming, "official")}
                            </div>

                            {/* Live */}
                            {partitionedContests.live.length > 0 && (
                                <div className="space-y-4">
                                    <SectionHeading icon={<Radio className="w-5 h-5 text-green-500 animate-pulse" />} label="Live Now" count={partitionedContests.live.length} />
                                    {renderGrid(partitionedContests.live, "official")}
                                </div>
                            )}

                            {/* Past Weekly / Biweekly Section */}
                            {pastOfficialWeeklyBiweekly.length > 0 && (
                                <div className="space-y-4 pt-4">
                                    <SectionHeading icon={<History className="w-5 h-5 text-amber-500" />} label="Previous Weekly &amp; Biweekly Contests" count={pastOfficialWeeklyBiweekly.length} />
                                    <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 gap-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                        {pastOfficialWeeklyBiweekly.map((c) => (
                                            <div key={c.id} className="min-w-[300px] w-[300px] sm:min-w-[340px] sm:w-[340px] snap-center shrink-0">
                                                <ContestCard
                                                    contest={c}
                                                    type={cardType(c, "official")}
                                                    isRegistered={registeredIds.has(c.id)}
                                                    attempt={attemptMap[c.id]}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Past General */}
                            <div className="space-y-4 pt-4">
                                <SectionHeading icon={<History className="w-5 h-5 text-gray-400" />} label="Past Official Exams (Practice Mode)" count={pastOfficialOthers.length} />
                                {loading ? (
                                    <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" /></div>
                                ) : pastOfficialOthers.length === 0 ? renderEmpty("official") : (
                                    <>
                                        {renderGrid(pastOfficialOthers, "official")}
                                        {hasMore && (
                                            <div className="mt-8 flex justify-center">
                                                <button
                                                    onClick={() => fetchContests(true)}
                                                    disabled={loadingMore}
                                                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 shadow-sm"
                                                >
                                                    {loadingMore ? "Loading..." : "Load More Mocks"}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── COMMUNITY TAB ── */}
                    {activeTab === "community" && (
                        <div className="space-y-8">
                            {partitionedContests.live.length > 0 && (
                                <div className="space-y-4">
                                    <SectionHeading icon={<Zap className="w-5 h-5 text-green-500" />} label="Live Now" count={partitionedContests.live.length} />
                                    {renderGrid(partitionedContests.live, "community")}
                                </div>
                            )}
                            {partitionedContests.upcoming.length > 0 && (
                                <div className="space-y-4">
                                    <SectionHeading icon={<Timer className="w-5 h-5 text-amber-500" />} label="Upcoming" count={partitionedContests.upcoming.length} />
                                    {renderGrid(partitionedContests.upcoming, "community")}
                                </div>
                            )}
                            <div className="space-y-4">
                                <SectionHeading icon={<History className="w-5 h-5 text-gray-400" />} label="All Community Mocks" count={partitionedContests.past.length} />
                                {loading ? (
                                    <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" /></div>
                                ) : partitionedContests.past.length === 0 ? renderEmpty("community") : (
                                    <>
                                        {renderGrid(partitionedContests.past, "community")}
                                        {hasMore && (
                                            <div className="mt-8 flex justify-center">
                                                <button
                                                    onClick={() => fetchContests(true)}
                                                    disabled={loadingMore}
                                                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                                >
                                                    {loadingMore ? "Loading..." : "Load More Mocks"}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── MY MOCKS TAB ── */}
                    {activeTab === "mine" && (
                        <div className="space-y-8">
                            {partitionedContests.live.length > 0 && (
                                <div className="space-y-4">
                                    <SectionHeading icon={<Zap className="w-5 h-5 text-green-500" />} label="Live Now" count={partitionedContests.live.length} />
                                    {renderGrid(partitionedContests.live, "mine")}
                                </div>
                            )}
                            {partitionedContests.upcoming.length > 0 && (
                                <div className="space-y-4">
                                    <SectionHeading icon={<Timer className="w-5 h-5 text-amber-500" />} label="Upcoming" count={partitionedContests.upcoming.length} />
                                    {renderGrid(partitionedContests.upcoming, "mine")}
                                </div>
                            )}
                            <div className="space-y-4">
                                <SectionHeading icon={<History className="w-5 h-5 text-gray-400" />} label="All My Mocks" count={filteredContests.length} />
                                {loading ? (
                                    <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" /></div>
                                ) : filteredContests.length === 0 ? renderEmpty("mine") : (
                                    <>
                                        {renderGrid(filteredContests, "mine")}
                                        {hasMore && (
                                            <div className="mt-8 flex justify-center">
                                                <button
                                                    onClick={() => fetchContests(true)}
                                                    disabled={loadingMore}
                                                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                                >
                                                    {loadingMore ? "Loading..." : "Load More Mocks"}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContestsPage;