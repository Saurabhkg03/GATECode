"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Share2,
  Bell,
  BellOff,
  Trophy,
  Check,
  Copy,
  Clock,
  Calendar,
  Timer,
  Repeat2,
  BookOpen,
  Star,
  CheckCircle2,
  Loader2,
  Info,
  Sparkles,
  Radio,
  Lock,
} from "lucide-react";
import { db } from "@/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Contest } from "@/types/exam";
import CountdownTimer from "@/components/contests/CountdownTimer";
import {
  getNextWeeklyContest,
  getNextBiweeklyContest,
  UpcomingContestInfo,
} from "@/utils/contestSchedule";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import ContestThumbnail from "@/components/contests/ContestThumbnail";

// ── local helpers ────────────────────────────────────────────────────────────

const isUpcoming = (startTime: Date) => startTime.getTime() > Date.now();
const isLive = (startTime: Date, endTime: Date) =>
  startTime.getTime() <= Date.now() && endTime.getTime() > Date.now();

// ── types ────────────────────────────────────────────────────────────────────

interface ScheduledMeta {
  type: "weekly" | "biweekly";
  info: UpcomingContestInfo;
}

// ── component ────────────────────────────────────────────────────────────────

export default function ContestDescriptionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const contestId = params.contestId as string;

  const [contest, setContest] = useState<Contest | null>(null);
  const [scheduledMeta, setScheduledMeta] = useState<ScheduledMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // registration state
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);

  // UI feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // ── scroll to top ─────────────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [contestId]);

  // ── fetch contest + registration status ──────────────────────────────────
  useEffect(() => {
    const fetchContest = async () => {
      if (!contestId) return;
      setLoading(true);

      try {
        // Try Firestore first
        const docRef = doc(db, "contests", contestId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setContest({ id: contestId, ...docSnap.data() } as Contest);
        } else {
          // Parse scheduled weekly/biweekly from ID
          const cleanId = contestId.replace(/-[a-z]{2,3}$/, "");
          if (cleanId.startsWith("weekly-")) {
            const info = getNextWeeklyContest();
            setScheduledMeta({ type: "weekly", info });
          } else if (cleanId.startsWith("biweekly-")) {
            const info = getNextBiweeklyContest();
            setScheduledMeta({ type: "biweekly", info });
          }
        }

        // Check registration status
        if (user) {
          const regRef = doc(db, "contestRegistrations", `${user.uid}_${contestId}`);
          const regSnap = await getDoc(regRef);
          setIsRegistered(regSnap.exists());
        }
      } catch (error) {
        console.error("Error fetching contest:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContest();
  }, [contestId, user]);

  // ── derived values ───────────────────────────────────────────────────────

  const title = contest?.title
    ?? (scheduledMeta
      ? `${scheduledMeta.type === "weekly" ? "Weekly" : "Biweekly"} Contest ${scheduledMeta.info.number}`
      : "Contest");

  const rawStartTime: Date | null = contest?.startTime
    ? new Date(contest.startTime)
    : scheduledMeta?.info.startTime ?? null;

  const rawEndTime: Date | null = contest?.endTime
    ? new Date(contest.endTime)
    : scheduledMeta?.info.endTime ?? null;

  const durationMinutes: number =
    contest?.durationMinutes ?? scheduledMeta?.info.durationMinutes ?? 90;

  const upcoming = rawStartTime ? isUpcoming(rawStartTime) : false;
  const live = rawStartTime && rawEndTime ? isLive(rawStartTime, rawEndTime) : false;
  const started = !upcoming;

  const formattedDate = rawStartTime
    ? rawStartTime.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    })
    : "Anytime";

  // ── registration handler ─────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setRegistering(true);
    try {
      const regRef = doc(db, "contestRegistrations", `${user.uid}_${contestId}`);
      if (isRegistered) {
        await deleteDoc(regRef);
        setIsRegistered(false);
        showToast("Registration removed.");
      } else {
        // Request browser notification permission
        let notifyEnabled = false;
        if ("Notification" in window && Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          notifyEnabled = permission === "granted";
        } else if (Notification.permission === "granted") {
          notifyEnabled = true;
        }

        await setDoc(regRef, {
          uid: user.uid,
          contestId,
          title,
          startTime: rawStartTime?.toISOString() ?? null,
          notifyEnabled,
          registeredAt: serverTimestamp(),
        });
        setIsRegistered(true);
        showToast(
          notifyEnabled
            ? "Registered! You'll get a browser notification when it starts."
            : "Registered! We'll remind you in-app when the contest starts."
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  // ── main action (start / register) ───────────────────────────────────────
  const handleAction = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (started && !live) {
      // past contest — start exam
      router.push(`/exam/${contestId}/intro`);
    } else if (live) {
      router.push(`/exam/${contestId}/intro`);
    } else {
      // upcoming — register
      handleRegister();
    }
  };

  // ── share ────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      showToast("Contest link copied!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ffa116] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── colour theme for scheduled contests ──────────────────────────────────
  const isWeekly = scheduledMeta?.type === "weekly";
  const isBiweekly = scheduledMeta?.type === "biweekly";
  const gradientClass = isWeekly
    ? "from-amber-400 via-orange-500 to-red-500"
    : isBiweekly
      ? "from-indigo-500 via-violet-600 to-purple-700"
      : "from-zinc-700 to-zinc-900";

  const accentColor = isWeekly ? "#ffa116" : isBiweekly ? "#8b5cf6" : "#ffa116";

  return (
    <div
      className="min-h-screen bg-[#1a1a1a] text-gray-300 font-sans selection:bg-[#ffa116]/40 selection:text-white"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-white/10 text-white text-sm px-5 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          {toastMsg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        {scheduledMeta ? (
          /* Scheduled weekly / biweekly hero */
          <div className={`relative rounded-2xl overflow-hidden mb-10 bg-gradient-to-br ${gradientClass} p-8`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(255,255,255,0.18),transparent_60%)]" />
            {/* Decorative emoji */}
            <div className="absolute bottom-4 right-4 opacity-70 select-none pointer-events-none leading-none filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              {isWeekly ? (
                <span className="text-[88px]">⚡</span>
              ) : (
                <div>
                  <span className="text-[60px] block">⚡</span>
                  <span className="text-[44px] block -mt-3 ml-7 opacity-75">⚡</span>
                </div>
              )}
            </div>
            <div className="relative z-10">
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 border border-white/10">
                  {isWeekly ? <><Trophy className="w-3 h-3" /> Weekly Contest</> : <><Sparkles className="w-3 h-3" /> Biweekly Contest</>}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-500/30 backdrop-blur-sm text-blue-100 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 border border-blue-500/30">
                   Rated
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 drop-shadow tracking-tight">{title}</h1>
              <p className="text-white/95 text-sm mb-6 font-medium drop-shadow-sm">{formattedDate}</p>

              {/* Status pill */}
              {live && (
                <span className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/30 text-green-300 text-xs font-bold rounded-full px-3 py-1 mb-4">
                  <Radio className="w-3 h-3" />
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live Now
                </span>
              )}
              {upcoming && rawStartTime && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-white/90 text-sm font-medium drop-shadow-sm">Starts in</span>
                  <CountdownTimer targetDate={rawStartTime} compact className="text-yellow-300 drop-shadow-md text-lg" onComplete={() => { }} />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {upcoming ? (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg ${isRegistered
                      ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                      : "bg-white text-gray-900 hover:bg-gray-100 hover:-translate-y-0.5"
                      }`}
                  >
                    {registering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isRegistered ? (
                      <><CheckCircle2 className="w-4 h-4" /> Registered</>
                    ) : !user ? (
                      <><Lock className="w-4 h-4" /> Login to Register</>
                    ) : (
                      <><Bell className="w-4 h-4" /> Register & Get Reminder</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleAction}
                    className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg hover:-translate-y-0.5"
                  >
                    {!user ? <><Lock className="w-4 h-4" /> Login to Start</> : <><Trophy className="w-4 h-4" /> Start Contest</>}
                  </button>
                )}
                {isRegistered && upcoming && (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                    title="Remove registration"
                  >
                    <BellOff className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="w-9 h-9 rounded-full bg-white text-zinc-900 hover:bg-zinc-100 flex items-center justify-center shadow-lg transition-all active:scale-95"
                  title="Share"
                >
                  {isCopied ? <Copy className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Firestore contest hero */
          <div className="relative mb-10 rounded-2xl overflow-hidden p-8 border border-white/10 shadow-xl">
            {/* Background Thumbnail */}
            <div className="absolute inset-0 z-0">
              <ContestThumbnail contestId={contestId} title={title} />
            </div>
            
            <div className="relative z-10">
              {/* Status badges */}
              <div className="flex gap-2 flex-wrap mb-4">
                {contest?.isRated ? (
                  <span className="inline-flex items-center gap-1.5 bg-blue-500/30 border border-blue-500/50 text-blue-100 text-xs font-bold rounded-full px-3 py-1 backdrop-blur-md">
                    Rated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-gray-500/30 border border-gray-500/50 text-gray-200 text-xs font-bold rounded-full px-3 py-1 backdrop-blur-md">
                    Unrated
                  </span>
                )}
                {live && (
                  <span className="inline-flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 text-green-100 text-xs font-bold rounded-full px-3 py-1 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live Now
                  </span>
                )}
                {upcoming && (
                  <span className="inline-flex items-center gap-1.5 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-full px-3 py-1 backdrop-blur-md">
                    <Timer className="w-3 h-3" /> Upcoming
                  </span>
                )}
                {isRegistered && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-500/50 text-emerald-100 text-xs font-bold rounded-full px-3 py-1 backdrop-blur-md">
                    <CheckCircle2 className="w-3 h-3" /> Registered
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 tracking-tight drop-shadow-md">{title}</h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/90 mb-8 font-medium drop-shadow-sm">
                <span>{formattedDate}</span>
                {upcoming && rawStartTime && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/50" />
                    <div className="flex items-center gap-2">
                      <span>Starts in</span>
                      <CountdownTimer targetDate={rawStartTime} className="text-white drop-shadow-md text-lg" />
                    </div>
                  </>
                )}
              </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Primary action */}
              {upcoming ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg flex items-center gap-2 ${isRegistered
                    ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-[#ffa116] hover:bg-[#ffb03a] text-black hover:-translate-y-0.5"
                    }`}
                >
                  {registering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isRegistered ? (
                    <><CheckCircle2 className="w-4 h-4" /> Registered</>
                  ) : !user ? (
                    <><Lock className="w-4 h-4" /> Login to Register</>
                  ) : (
                    <><Bell className="w-4 h-4" /> Register</>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleAction}
                  className="px-6 py-2.5 rounded-full font-bold text-sm bg-[#ffa116] hover:bg-[#ffb03a] text-black hover:-translate-y-0.5 transition-all shadow-lg flex items-center gap-2"
                >
                  {!user ? <><Lock className="w-4 h-4" /> Login to Start</> : <><Trophy className="w-4 h-4" /> {live ? "Join Live" : "Start Contest"}</>}
                </button>
              )}

              {/* Bell toggle for upcoming */}
              {upcoming && isRegistered && (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  title="Remove registration"
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <BellOff className="w-4 h-4" />
                </button>
              )}
              {upcoming && !isRegistered && (
                <button
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-zinc-900 hover:bg-zinc-100 transition-all active:scale-95 shadow-lg"
                  title="Share"
                >
                  {isCopied ? <Copy className="w-4.5 h-4.5 text-emerald-600" /> : <Share2 className="w-4.5 h-4.5" />}
                </button>
              )}
              {!upcoming && (
                <button
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-zinc-900 hover:bg-zinc-100 transition-all active:scale-95 shadow-lg"
                  title="Share"
                >
                  {isCopied ? <Copy className="w-4.5 h-4.5 text-emerald-600" /> : <Share2 className="w-4.5 h-4.5" />}
                </button>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ── Info cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: <Clock className="w-4 h-4" />,
              label: "Duration",
              value: `${durationMinutes} min`,
            },
            {
              icon: <Calendar className="w-4 h-4" />,
              label: "Start",
              value: rawStartTime
                ? rawStartTime.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                : "Anytime",
            },
            {
              icon: <Timer className="w-4 h-4" />,
              label: "End",
              value: rawEndTime
                ? rawEndTime.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                : "—",
            },
            {
              icon: <Repeat2 className="w-4 h-4" />,
              label: "Frequency",
              value: scheduledMeta
                ? scheduledMeta.type === "weekly" ? "Every Sunday" : "Every other Saturday"
                : "One-time",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-[#282828] border border-white/5 rounded-xl p-4 flex flex-col gap-1"
            >
              <span className="text-gray-500 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                {item.icon} {item.label}
              </span>
              <span className="text-white font-bold text-sm">{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Countdown banner for upcoming */}
          {upcoming && rawStartTime && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-amber-400 font-bold text-sm flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4" /> Contest starts in
                </p>
                <CountdownTimer targetDate={rawStartTime} onComplete={() => { }} />
              </div>
              {!isRegistered ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-all shrink-0"
                >
                  {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Register &amp; Remind Me
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm px-5 py-2.5 rounded-xl shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> You&apos;re registered
                </div>
              )}
            </div>
          )}

          {/* About */}
          <div className="bg-[#282828] p-6 rounded-2xl border border-white/5 space-y-5">
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-[#ffa116]" /> About this Contest
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {contest?.description
                  ?? (scheduledMeta?.type === "weekly"
                    ? "The Weekly Contest is held every Sunday covering the full GATE syllabus — General Aptitude and Technical questions. Test your speed and accuracy against the community!"
                    : scheduledMeta?.type === "biweekly"
                      ? "The Biweekly Contest runs every alternate Saturday with a slightly longer duration for more in-depth problem sets. Perfect for tracking your long-term progress."
                      : "Welcome to this GATECode contest. Challenge yourself against other engineers and test your knowledge and speed.")}
              </p>
              {scheduledMeta && (
                <p className="text-gray-400 italic text-sm">
                  This contest is sponsored by <strong className="text-gray-300">GATECode Community</strong>.
                </p>
              )}

              {(contest ? contest.isRated : !!scheduledMeta) ? (
                <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4" /> Rated Contest
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This is a Rated contest. Your performance will affect your Global Contest Elo Rating. Performing well relative to other participants will increase your rating, while poor performance may decrease it. The rating calculation is based on your final ranking and the rating of other competitors.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
                  <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4" /> Unrated Contest
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This is an Unrated contest. It is designed for practice and learning. Your performance here will <strong>not</strong> affect your Global Contest Elo Rating.
                  </p>
                </div>
              )}
            </div>

            {/* What to Expect */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#ffa116]" /> What to Expect
              </h3>
              <ul className="space-y-2.5 text-gray-300 text-sm">
                {contest?.examMode === 'custom' ? (
                  <>
                    <li className="flex gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1b85ff] mt-2 shrink-0" />
                      <span><strong>Custom Subjects:</strong> {contest.targetSubjects?.join(", ") || "Specific selected subjects."}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1b85ff] mt-2 shrink-0" />
                      <span><strong>Format:</strong> {contest.sections.reduce((sum, sec) => sum + sec.questions.length, 0)} questions ({
                        contest.sections.reduce((sum, sec) => sum + sec.questions.filter(q => Number(q.marks) === 1).length, 0)
                      } × 1-Mark, {
                        contest.sections.reduce((sum, sec) => sum + sec.questions.filter(q => Number(q.marks) === 2).length, 0)
                      } × 2-Mark). Total: {contest.totalMarks || 0} Marks.</span>
                    </li>
                  </>
                ) : (
                  <li className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1b85ff] mt-2 shrink-0" />
                    <span><strong>Format:</strong> 65 questions (30 × 1-Mark, 35 × 2-Mark). Total: 100 Marks. Mix of General Aptitude and Core Technical.</span>
                  </li>
                )}
                {[
                  "Questions are a mix of MCQ, MSQ, and NAT (Numerical Answer Type).",
                  "Marking scheme for 1-Mark questions: +1 for correct, -0.33 for incorrect MCQs, 0 for incorrect MSQ/NAT.",
                  "Marking scheme for 2-Mark questions: +2 for correct, -0.66 for incorrect MCQs, 0 for incorrect MSQ/NAT.",
                  "No negative marking for unattempted questions.",
                  "Results, ranks, and detailed solutions are published immediately after submission.",
                  "Leaderboard is updated in real time.",
                ].map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1b85ff] mt-2 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Locked notice */}
            {upcoming && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 text-sm text-gray-400">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>The contest will unlock automatically at the scheduled start time.</span>
              </div>
            )}
          </div>

          {/* Bonus Prizes */}
          {contest?.prizes && contest.prizes.length > 0 && (
            <div className="bg-[#282828] p-6 rounded-2xl border border-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-5">
                <Star className="w-5 h-5 text-[#ffa116]" fill="#ffa116" /> Bonus Prizes
              </h3>
              <ul className="space-y-3 mb-7 text-gray-300 text-sm">
                {contest.prizes.map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1b85ff] mt-2 shrink-0" />
                    <span>
                      Rank <strong>{item.rank}</strong> → {item.prize}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 italic mb-6">
                Only verified accounts are eligible. An admin will reach out by email after ranking is finalised.
              </p>

              {/* Prize cards - Only show if matching keywords are found in custom prizes */}
              {contest.prizes.some(p => p.prize.toLowerCase().includes('backpack') || p.prize.toLowerCase().includes('bottle') || p.prize.toLowerCase().includes('notebook')) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { emoji: "🎒", label: "Premium Backpack", gradient: "from-yellow-700 to-yellow-400", key: 'backpack' },
                    { emoji: "🫙", label: "Steel Water Bottle", gradient: "from-gray-500 to-gray-300", key: 'bottle' },
                    { emoji: "📓", label: "GATECode Notebook", gradient: "from-amber-800 to-amber-600", key: 'notebook' },
                  ].filter(item => contest.prizes!.some(p => p.prize.toLowerCase().includes(item.key))).map((item) => (
                    <div
                      key={item.label}
                      className="bg-[#1a1a1a] p-5 rounded-xl flex flex-col items-center justify-center border border-white/5 hover:border-[#ffa116]/40 transition-colors group"
                    >
                      <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${item.gradient} p-1 mb-3 group-hover:scale-105 transition-transform duration-300`}>
                        <div className="w-full h-full bg-[#1a1a1a] rounded-full flex items-center justify-center text-3xl">
                          {item.emoji}
                        </div>
                      </div>
                      <span className="font-bold text-white text-sm text-center">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#282828] border border-white/5 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">
              {upcoming
                ? "Register now to receive a reminder when the contest goes live."
                : "Ready to compete? Jump in and see your ranking!"}
            </p>
            <div className="flex gap-3">
              {upcoming ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${isRegistered
                    ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-[#ffa116] hover:bg-[#ffb03a] text-black"
                    }`}
                >
                  {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : isRegistered ? <><CheckCircle2 className="w-4 h-4" /> Registered!</> : !user ? <><Lock className="w-4 h-4" /> Login to Register</> : <><Bell className="w-4 h-4" /> Register</>}
                </button>
              ) : (
                <button
                  onClick={handleAction}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#ffa116] hover:bg-[#ffb03a] text-black transition-all"
                >
                  {!user ? <><Lock className="w-4 h-4" /> Login to Start</> : <><Trophy className="w-4 h-4" />{live ? "Join Live" : "Start Contest"}</>}
                </button>
              )}
              <Link href="/contests" className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-all">
                All Contests
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
