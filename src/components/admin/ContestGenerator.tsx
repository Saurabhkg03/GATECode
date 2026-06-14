"use client";

import React, { useState } from 'react';
import { Loader2, Wand2, AlertTriangle, CheckCircle, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ContestGeneratorProps {
    onContestCreated?: () => void;
    isAdminContest?: boolean;
}

const ContestGenerator: React.FC<ContestGeneratorProps> = ({ onContestCreated, isAdminContest = false }) => {
    const { userInfo } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [branch, setBranch] = useState('ece');
    const [contestTitle, setContestTitle] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [durationMinutes, setDurationMinutes] = useState(180);
    const [isPublic, setIsPublic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');

    // Get local datetime string for min attribute (now)
    const getLocalDatetimeMin = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    const generateContest = async () => {
        setLoading(true);
        setStatus('Initializing contest generation on the server...');

        try {
            const response = await fetch('/api/contests/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    branch,
                    contestTitle,
                    isPublic,
                    enableSchedule,
                    scheduledDateTime,
                    endDateTime,
                    isAdminContest,
                    uid: userInfo?.uid || 'anonymous',
                    difficulty,
                    durationMinutes: Number(durationMinutes)
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate contest.');
            }

            setStatus('Server processing complete.\n' + data.messages.join('\n'));
            setStatus(prev => prev + `\n\n✅ Success! Created "${data.title}".`);
            setStatus(prev => prev + `\n   - Total Questions: ${data.totalQs} / 65`);
            if (data.startTimeISO) {
                setStatus(prev => prev + `\n   - Starts: ${new Date(data.startTimeISO).toLocaleString()}`);
            }
            if (data.endTimeISO) {
                setStatus(prev => prev + `\n   - Ends:   ${new Date(data.endTimeISO).toLocaleString()}`);
            }

            if (onContestCreated) {
                onContestCreated();
            }

        } catch (error: any) {
            console.error(error);
            setStatus('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const isWeeklyOrBiweekly = contestTitle.toLowerCase().includes('weekly') || contestTitle.toLowerCase().includes('biweekly');

    return (
        <div className="p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-5">
            <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <Wand2 className="w-5 h-5 text-blue-500" />
                Real Exam Generator
            </h2>

            {/* Row 1: Branch + Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target Branch
                    </label>
                    <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full p-2.5 border rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                        <option value="ece">Electronics (ECE)</option>
                        <option value="cse">Computer Science (CSE)</option>
                        <option value="me">Mechanical (ME)</option>
                        <option value="ee">Electrical (EE)</option>
                        <option value="in">Instrumentation (IN)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        Fetches from <code>questions_{branch}</code>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contest Title
                    </label>
                    <input
                        type="text"
                        value={contestTitle}
                        onChange={(e) => setContestTitle(e.target.value)}
                        placeholder="e.g. Major Test 1"
                        className="w-full p-2.5 border rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                </div>
            </div>

            {/* Row 2: Difficulty + Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Difficulty Level
                    </label>
                    <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full p-2.5 border rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Duration (minutes)
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={isWeeklyOrBiweekly ? 180 : durationMinutes}
                        onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                        disabled={isWeeklyOrBiweekly}
                        className={`w-full p-2.5 border rounded-xl dark:bg-zinc-900 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isWeeklyOrBiweekly ? 'opacity-60 bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-white dark:text-white'}`}
                    />
                    {isWeeklyOrBiweekly && (
                        <p className="text-xs text-amber-500 mt-1.5 font-medium">Weekly/Biweekly exams are fixed at 180 mins.</p>
                    )}
                </div>
            </div>

            {/* Schedule Toggle */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setEnableSchedule(!enableSchedule)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${enableSchedule
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-700/40'
                        : 'bg-gray-50 dark:bg-zinc-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Start Date & Time
                        {!enableSchedule && (
                            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                                (optional — leave off to allow immediate access)
                            </span>
                        )}
                    </span>
                    <span className={`w-8 h-4 rounded-full transition-colors flex items-center ${enableSchedule ? 'bg-amber-500' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                        <span className={`w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${enableSchedule ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                </button>

                {enableSchedule && (
                    <div className="px-4 py-4 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-600 dark:text-amber-400" />
                                    Contest Start Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledDateTime}
                                    onChange={(e) => setScheduledDateTime(e.target.value)}
                                    min={getLocalDatetimeMin()}
                                    className="w-full p-2.5 border border-amber-200 dark:border-amber-700/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none transition cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    <Clock className="w-3.5 h-3.5 inline mr-1 text-red-500 dark:text-red-400" />
                                    Contest End Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={endDateTime}
                                    onChange={(e) => setEndDateTime(e.target.value)}
                                    min={scheduledDateTime || getLocalDatetimeMin()}
                                    className="w-full p-2.5 border border-red-200 dark:border-red-700/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-red-400 outline-none transition cursor-pointer"
                                />
                            </div>
                        </div>
                        {scheduledDateTime && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/30 rounded-lg px-3 py-2">
                                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                    Contest will be locked until{' '}
                                    <strong>{new Date(scheduledDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
                                    A live countdown will be shown on the contest card.
                                </span>
                            </div>
                        )}
                        {!scheduledDateTime && (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                Please pick a date and time above to schedule the contest.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Public Toggle (non-admin only) */}
            {!isAdminContest && (
                <div className="flex items-center gap-2.5">
                    <input
                        type="checkbox"
                        id="isPublic"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 text-blue-500 rounded border-zinc-300 focus:ring-blue-500 dark:focus:ring-blue-500 dark:ring-offset-zinc-900 focus:ring-2 dark:bg-zinc-800 dark:border-zinc-700"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Publish to Community (Visible to everyone)
                    </label>
                </div>
            )}

            {/* Status Log */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl text-sm font-mono text-gray-600 dark:text-gray-400 min-h-[6rem] max-h-[12rem] overflow-y-auto whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800">
                {status || "Ready to generate. Ensure Firestore has a 'questions_{branch}' collection."}
            </div>

            {/* Generate Button */}
            <button
                onClick={generateContest}
                disabled={loading || (enableSchedule && !scheduledDateTime)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-sm shadow-blue-500/10"
            >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                {loading ? 'Generating…' : 'Generate Exam'}
            </button>

            {enableSchedule && !scheduledDateTime && (
                <p className="text-xs text-center text-red-500 dark:text-red-400 -mt-2">
                    Please set a start date &amp; time before generating.
                </p>
            )}
        </div>
    );
};

export default ContestGenerator;
