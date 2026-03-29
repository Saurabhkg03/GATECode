"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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

/** contest has started but not yet over */
const isLive = (c: Contest) => {
    if (!c.startTime) return false;
    const start = new Date(c.startTime).getTime();
    if (start > now()) return false; // hasn't started
    if (c.endTime) return new Date(c.endTime).getTime() > now();
    // fallback: started within durationMinutes ago
    return start + c.durationMinutes * 60_000 > now();
};

/** contest has ended */
const isPast = (c: Contest) => {
    if (!c.startTime) return true; // no schedule ⇒ treat as always available/past
    const start = new Date(c.startTime).getTime();
    if (start > now()) return false;
    if (c.endTime) return new Date(c.endTime).getTime() <= now();
    return start + c.durationMinutes * 60_000 <= now();
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
    const upcoming = isUpcoming(contest);
    const live = isLive(contest);
    const startDate = contest.startTime ? new Date(contest.startTime) : null;
    const endDate = contest.endTime ? new Date(contest.endTime) : null;

    return (
        <div className="group flex flex-col justify-between bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-md h-full relative overflow-hidden">
            {type === "admin" && <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.08),transparent_70%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.1),transparent_70%)] rounded-bl-full -z-10" />}
            {live && <div className="absolute top-0 right-0 w-36 h-36 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.1),transparent_70%)] rounded-bl-full -z-10" />}
            {upcoming && <div className="absolute top-0 right-0 w-36 h-36 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.1),transparent_70%)] rounded-bl-full -z-10" />}

            <div>
                {/* Badges row */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${type === "admin" ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"}`}>
                            {type === "admin" ? "Official" : "Practice"}
                        </span>
                        {type === "mine" && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${contest.isPublic ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20" : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>
                                {contest.isPublic ? "Public" : "Private"}
                            </span>
                        )}
                        {isRegistered && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Registered
                            </span>
                        )}
                        {contest.branch && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-gray-100 text-gray-600 border-gray-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                {contest.branch}
                            </span>
                        )}
                        {contest.difficulty && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${contest.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
                                contest.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                                    'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                }`}>
                                {contest.difficulty}
                            </span>
                        )}
                        {live && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                            </span>
                        )}
                        {upcoming && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20 flex items-center gap-1">
                                <Timer className="w-3 h-3" /> Soon
                            </span>
                        )}
                    </div>
                    {type === "mine" && onDelete && (
                        <button onClick={() => onDelete(contest.id)} className="text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors ml-1">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {contest.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3 line-clamp-2">
                    {contest.description || "Challenge yourself with this exam and improve your skills."}
                </p>

                {/* Countdown for upcoming */}
                {upcoming && startDate && (
                    <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Starts In</p>
                        <CountdownTimer targetDate={startDate} compact={true} onComplete={() => { }} />
                    </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs font-medium text-gray-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{contest.durationMinutes}m</span>
                    <span className="flex items-center gap-1"><BrainCircuit className="w-3.5 h-3.5" />{contest.totalMarks || 100}M</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{contest.sections?.length || 2} Sec</span>
                    {startDate && (
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                    )}
                    {endDate && (
                        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                            <Timer className="w-3.5 h-3.5" />
                            Ends {endDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    )}
                </div>
            </div>

            {upcoming ? (
                <div className="w-full py-2.5 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30 cursor-not-allowed select-none">
                    <Lock className="w-3.5 h-3.5" /> Locked Until Start
                </div>
            ) : attempt && !attempt.isSubmitted && attempt.timeLeftSeconds > 0 ? (
                <Link
                    href={`/exam/${contest.id}/live`}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-center transition-all duration-300 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-[pulse_2s_ease-in-out_infinite] border border-amber-600 dark:border-amber-500"
                >
                    <Timer className="w-3.5 h-3.5" /> Resume Attempt ({Math.ceil(attempt.timeLeftSeconds / 60)}m left)
                </Link>
            ) : attempt?.isSubmitted ? (
                <Link
                    href={`/exam/${contest.id}/intro`}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-center transition-all duration-300 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700"
                >
                    <Check className="w-3.5 h-3.5 text-green-500" /> View Results
                </Link>
            ) : (
                <Link
                    href={`/contests/${contest.id}`}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs text-center transition-all duration-300 flex items-center justify-center gap-2 ${type === "admin" ? "bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-100" : "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"}`}
                >
                    {live ? <><Radio className="w-3.5 h-3.5 text-green-400" /> Join Live</> : <>Start Contest <ChevronRight className="w-3.5 h-3.5" /></>}
                </Link>
            )}
        </div>
    );
};

// ─── Section heading ──────────────────────────────────────────────────────────

const SectionHeading = ({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) => (
    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-zinc-800 pb-3">
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
    const locked = info.startTime.getTime() > Date.now();

    return (
        <Link
            href={`/contests/${info.id}`}
            className={`flex-1 relative rounded-2xl overflow-hidden group shadow-2xl`}
            style={{ minHeight: 210, isolation: "isolate", display: "flex" }}
        >
            {/* BG gradient */}
            <div className={`absolute inset-0 ${isWeekly ? "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500" : "bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700"}`} />
            <div className={`absolute inset-0 ${isWeekly ? "bg-[radial-gradient(ellipse_at_28%_38%,rgba(255,255,255,0.20),transparent_62%)]" : "bg-[radial-gradient(ellipse_at_72%_28%,rgba(255,255,255,0.16),transparent_60%)]"}`} />
            {/* Deco */}
            <div className={`absolute ${isWeekly ? "-bottom-10 -right-10" : "-bottom-10 -left-10"} w-56 h-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)]`} />
            <div className={`absolute top-3 ${isWeekly ? "right-10" : "left-10"} w-16 h-16 rounded-full border border-white/15`} />
            {/* Art — 1 bolt for weekly, 2 bolts for biweekly */}
            {isWeekly ? (
                <div className="absolute bottom-8 right-4 select-none leading-none filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-105">
                    <span className="text-[88px]">⚡</span>
                </div>
            ) : (
                <div className="absolute bottom-6 right-4 select-none leading-none filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-105">
                    <span className="text-[60px] block">⚡</span>
                    <span className="text-[44px] block -mt-3 ml-7 opacity-75">⚡</span>
                </div>
            )}
            {/* Countdown pill */}
            <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 border border-white/10">
                <Timer className="w-3 h-3 text-white/75 shrink-0" />
                <span className="text-white text-[11px] font-bold tabular-nums leading-none">
                    <CountdownTimer targetDate={info.startTime} compact={true} onComplete={() => { }} />
                </span>
            </div>


            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col justify-between w-full" style={{ minHeight: 210 }}>
                <div>
                    <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-[0.18em] rounded-full px-3 py-1 mb-3 border border-white/10">
                        {isWeekly ? <><Trophy className="w-3 h-3" /> Weekly Contest</> : <><Sparkles className="w-3 h-3" /> Biweekly Contest</>}
                    </span>
                    <h2 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">
                        {isWeekly ? "Weekly" : "Biweekly"} Contest {info.number}
                    </h2>
                    <p className="text-white/70 text-[11px] font-medium mt-1">
                        {info.startTime.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-white/55 text-[10px] mt-0.5">
                        {info.durationMinutes} min · Ends {info.endTime.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                </div>

                <div className="flex items-center gap-2 mt-4">
                    <div className={`flex items-center gap-1.5 backdrop-blur-sm border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 transition-all ${isRegistered ? "bg-emerald-500/80 group-hover:bg-emerald-500/90" : "bg-white/20 group-hover:bg-white/30"}`}>
                        {isRegistered
                            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Registered<ChevronRight className="w-3.5 h-3.5 ml-0.5 opacity-60" /></>
                            : <>View Details <ChevronRight className="w-3.5 h-3.5" /></>
                        }
                    </div>
                    <div className="ml-auto w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                        <Calendar className="w-4 h-4 text-white" />
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

    // We can partition status (live/upcoming/past) locally on the current active tab's subset.
    const partitionByStatus = (list: Contest[]) => ({
        upcoming: list.filter(isUpcoming),
        live: list.filter(isLive),
        past: list.filter(isPast),
    });

    const partitionedContests = partitionByStatus(filteredContests);

    const cardType = (c: Contest, tab: TabType): "admin" | "mock" | "mine" =>
        tab === "mine" ? "mine" : c.type === "admin" ? "admin" : "mock";

    const renderGrid = (list: Contest[], tab: TabType) =>
        list.length === 0 ? null : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
                                    <SectionHeading icon={<Radio className="w-5 h-5 text-green-500" />} label="Live Now" count={partitionedContests.live.length} />
                                    {renderGrid(partitionedContests.live, "official")}
                                </div>
                            )}

                            {/* Past */}
                            <div className="space-y-4">
                                <SectionHeading icon={<History className="w-5 h-5 text-gray-400" />} label="Past &amp; Practice" count={partitionedContests.past.length} />
                                {loading ? (
                                    <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" /></div>
                                ) : partitionedContests.past.length === 0 ? renderEmpty("official") : (
                                    <>
                                        {renderGrid(partitionedContests.past, "official")}
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
