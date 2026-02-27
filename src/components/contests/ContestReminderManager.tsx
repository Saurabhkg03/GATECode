"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, X, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ReminderToast {
    id: string;
    title: string;
    contestId: string;
}

const LS_KEY = "gatecode_reminded_contests";

function getFiredSet(): Set<string> {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function markFired(contestId: string) {
    try {
        const set = getFiredSet();
        set.add(contestId);
        localStorage.setItem(LS_KEY, JSON.stringify([...set]));
    } catch { /* noop */ }
}

export default function ContestReminderManager() {
    const { user } = useAuth();
    const [toasts, setToasts] = useState<ReminderToast[]>([]);
    const registrationsRef = useRef<
        { contestId: string; startTime: string; title: string; notifyEnabled: boolean }[]
    >([]);

    // ── listen to user registrations ────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "contestRegistrations"),
            where("uid", "==", user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            registrationsRef.current = snap.docs.map((d) => d.data() as {
                contestId: string;
                startTime: string;
                title: string;
                notifyEnabled: boolean;
            });
        });

        return unsub;
    }, [user]);

    // ── poll every 30 s to fire reminders ───────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const check = () => {
            const fired = getFiredSet();
            const now = Date.now();

            registrationsRef.current.forEach((reg) => {
                if (fired.has(reg.contestId)) return;
                if (!reg.startTime) return;

                const start = new Date(reg.startTime).getTime();
                // Fire when start time is within the past 0–5 minutes (or now)
                const diff = now - start;
                if (diff >= 0 && diff <= 5 * 60 * 1000) {
                    markFired(reg.contestId);

                    // In-app toast
                    const toast: ReminderToast = {
                        id: reg.contestId,
                        title: reg.title || "Contest",
                        contestId: reg.contestId,
                    };
                    setToasts((prev) => [...prev, toast]);

                    // Auto-dismiss toast after 12 s
                    setTimeout(() => {
                        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }, 12000);

                    // Browser notification
                    if (reg.notifyEnabled && Notification.permission === "granted") {
                        new Notification("🏆 Contest starting now!", {
                            body: `${reg.title} is live! Open GATECode to join.`,
                            icon: "/favicon.ico",
                            tag: reg.contestId,
                        });
                    }
                }
            });
        };

        check(); // run immediately
        const interval = setInterval(check, 30_000);
        return () => clearInterval(interval);
    }, [user]);

    const dismissToast = (id: string) =>
        setToasts((prev) => prev.filter((t) => t.id !== id));

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto flex items-start gap-3 bg-zinc-900 border border-white/10 text-white rounded-2xl shadow-2xl p-4 w-80 animate-in slide-in-from-right-4 fade-in duration-300"
                >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-0.5">
                            Contest Starting Now!
                        </p>
                        <p className="text-sm font-semibold truncate">{toast.title}</p>
                        <Link
                            href={`/contests/${toast.contestId}`}
                            onClick={() => dismissToast(toast.id)}
                            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-bold mt-1.5 transition-colors"
                        >
                            Join Contest <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <button
                        onClick={() => dismissToast(toast.id)}
                        className="text-zinc-500 hover:text-white transition-colors mt-0.5 shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
