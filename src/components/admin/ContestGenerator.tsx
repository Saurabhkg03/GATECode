"use client";

import React, { useState } from 'react';
import { Loader2, Wand2, AlertTriangle, CheckCircle, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BRANCH_SUBJECTS: Record<string, string[]> = {
    cse: [
        'Digital Logic', 'General Aptitude', 'Software Engg', 'Compiler Design', 
        'Data Structure', 'Theory of Computation', 'Engineering Mathematics', 
        'Computer Network', 'Discrete Mathematics', 'Operating System', 
        'Algorithm', 'Computer Organization', 'Database Management System', 
        'C Programming', 'Web Technology', 'General'
    ],
    ece: [
        'Communication Systems', 'Digital Circuits', 'Analog Circuits', 
        'Signals and Systems', 'General Aptitude', 'Electromagnetics', 
        'Network Theory', 'Engineering Mathematics', 'Control Systems', 
        'Electronic Devices', 'Microprocessors', 'General'
    ],
    me: [
        'Manufacturing Engineering', 'Industrial Engineering', 'Engineering Mathematics', 
        'Theory of Machine', 'Heat Transfer', 'Strength of Materials', 
        'General Aptitude', 'Fluid Mechanics', 'Machine Design', 
        'Thermodynamics', 'General', 'Engineering Mechanics', 
        'Refrigeration and Air-conditioning'
    ],
    ee: [
        'Power Electronics', 'Engineering Mathematics', 'Electrical Machines', 
        'Electric Circuits', 'Analog Electronics', 'Signals and Systems', 
        'Control Systems', 'Digital Electronics', 'Power Systems', 
        'Electrical and Electronic Measurements', 'Electromagnetic Theory', 
        'General Aptitude', 'Electromagnetic Fields', 'General'
    ],
    in: [
        'Engineering Mathematics', 'Control Systems', 'Electrical Circuits and Machines', 
        'Measurements', 'Analog Electronics', 'Digital Electronics', 
        'Signals and Systems', 'Sensors and Industrial Instrumentation', 
        'Communication and Optical Instrumentation', 'General Aptitude', 'General'
    ]
};

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
    const [isRated, setIsRated] = useState(isAdminContest);

    const [examMode, setExamMode] = useState<'full' | 'custom'>('full');
    const [targetSubjects, setTargetSubjects] = useState<string[]>([]);
    const [target1MarkCount, setTarget1MarkCount] = useState<number>(10);
    const [target2MarkCount, setTarget2MarkCount] = useState<number>(5);

    const [description, setDescription] = useState('Welcome to this GATECode contest. Challenge yourself against other engineers and test your knowledge and speed.');
    const [prizes, setPrizes] = useState<Array<{ rank: string; prize: string }>>([]);

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
                    durationMinutes: Number(durationMinutes),
                    description,
                    prizes: prizes.filter(p => p.rank.trim() !== '' && p.prize.trim() !== ''),
                    isRated,
                    examMode,
                    targetSubjects,
                    target1MarkCount: Number(target1MarkCount),
                    target2MarkCount: Number(target2MarkCount),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to generate contest.');
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
        <div className="p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-8">
            <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-zinc-800 pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                    <Wand2 className="w-5 h-5 text-blue-500" />
                    Real Exam Generator
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure and generate realistic GATE examinations from your database.</p>
            </div>

            {/* SECTION 1: Basic Information */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">1</span>
                    Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50/50 dark:bg-zinc-900/20 p-4 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Target Branch
                        </label>
                        <select
                            value={branch}
                            onChange={(e) => {
                                setBranch(e.target.value);
                                setTargetSubjects([]);
                            }}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
                        >
                            <option value="ece">Electronics (ECE)</option>
                            <option value="cse">Computer Science (CSE)</option>
                            <option value="me">Mechanical (ME)</option>
                            <option value="ee">Electrical (EE)</option>
                            <option value="in">Instrumentation (IN)</option>
                        </select>
                        <p className="text-[11px] text-gray-400 mt-1.5 font-medium">Source: <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">questions_{branch}</code></p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Contest Title
                        </label>
                        <input
                            type="text"
                            value={contestTitle}
                            onChange={(e) => setContestTitle(e.target.value)}
                            placeholder="e.g. Major Test 1"
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Difficulty Level
                        </label>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
                        >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Duration (minutes)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={examMode === 'custom' ? durationMinutes : (isWeeklyOrBiweekly ? 180 : durationMinutes)}
                            onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                            disabled={examMode !== 'custom' && isWeeklyOrBiweekly}
                            className={`w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm ${(examMode !== 'custom' && isWeeklyOrBiweekly) ? 'opacity-60 bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-zinc-900 dark:text-white'}`}
                        />
                        {examMode !== 'custom' && isWeeklyOrBiweekly && (
                            <p className="text-[11px] text-amber-500 mt-1.5 font-medium">Locked to 180 mins for Official Tests.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION 2: Exam Format */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">2</span>
                    Exam Format & Structure
                </h3>
                <div className="bg-gray-50/50 dark:bg-zinc-900/20 p-4 rounded-xl border border-gray-100 dark:border-zinc-800/50 space-y-4">
                    <div className="flex bg-gray-200/50 dark:bg-zinc-800/50 p-1.5 rounded-xl w-full">
                        <button 
                            onClick={() => setExamMode('full')} 
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${examMode === 'full' ? 'bg-white dark:bg-zinc-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Full GATE Mock (65 Qs)
                        </button>
                        <button 
                            onClick={() => {
                                setExamMode('custom');
                                if (isAdminContest) setIsRated(false);
                            }} 
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${examMode === 'custom' ? 'bg-white dark:bg-zinc-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Custom Subject Test
                        </button>
                    </div>

                    {examMode === 'custom' && (
                        <div className="space-y-5 p-5 bg-purple-50/30 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl mt-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Target Subjects <span className="text-xs font-normal text-gray-500">(Pick one or more)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {(BRANCH_SUBJECTS[branch] || []).map(sub => {
                                        const isSelected = targetSubjects.includes(sub);
                                        return (
                                            <button
                                                key={sub}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setTargetSubjects(prev => prev.filter(s => s !== sub));
                                                    } else {
                                                        setTargetSubjects(prev => [...prev, sub]);
                                                    }
                                                }}
                                                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${isSelected ? 'bg-purple-500 text-white border-purple-600 shadow-sm transform scale-105' : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
                                            >
                                                {sub}
                                            </button>
                                        );
                                    })}
                                </div>
                                {targetSubjects.length === 0 && (
                                    <p className="text-xs text-amber-500 mt-2 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Please select at least one subject.</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-purple-100 dark:border-purple-900/30">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                        1-Mark Questions
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={target1MarkCount}
                                        onChange={(e) => setTarget1MarkCount(parseInt(e.target.value) || 0)}
                                        className="w-full p-2.5 border border-purple-200 dark:border-purple-800/50 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                        2-Mark Questions
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={target2MarkCount}
                                        onChange={(e) => setTarget2MarkCount(parseInt(e.target.value) || 0)}
                                        className="w-full p-2.5 border border-purple-200 dark:border-purple-800/50 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Calculated Total Marks</span>
                                <span className="text-lg font-black text-purple-600 dark:text-purple-400">{(target1MarkCount * 1) + (target2MarkCount * 2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 3: Scheduling & Visibility */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">3</span>
                    Scheduling & Access
                </h3>
                
                <div className="space-y-3">
                    {/* Schedule Block */}
                    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setEnableSchedule(!enableSchedule)}
                            className={`w-full flex items-center justify-between px-5 py-4 text-sm font-bold transition-colors ${enableSchedule
                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-900/30'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <Calendar className="w-4 h-4" />
                                Schedule Start Date & Time
                                {!enableSchedule && (
                                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-2">
                                        (Leave off for immediate access)
                                    </span>
                                )}
                            </span>
                            <span className={`w-10 h-5 rounded-full transition-colors flex items-center ${enableSchedule ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                                <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${enableSchedule ? 'translate-x-5' : 'translate-x-0'}`} />
                            </span>
                        </button>

                        {enableSchedule && (
                            <div className="px-5 py-5 bg-emerald-50/20 dark:bg-emerald-900/5 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                            <Clock className="w-3.5 h-3.5 inline mr-1 text-emerald-600 dark:text-emerald-400" />
                                            Start Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={scheduledDateTime}
                                            onChange={(e) => setScheduledDateTime(e.target.value)}
                                            min={getLocalDatetimeMin()}
                                            className="w-full p-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition cursor-pointer shadow-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                            <Clock className="w-3.5 h-3.5 inline mr-1 text-rose-500 dark:text-rose-400" />
                                            End Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={endDateTime}
                                            onChange={(e) => setEndDateTime(e.target.value)}
                                            min={scheduledDateTime || getLocalDatetimeMin()}
                                            className="w-full p-2.5 border border-rose-200 dark:border-rose-800/50 rounded-xl bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-rose-400 outline-none transition cursor-pointer shadow-sm"
                                        />
                                    </div>
                                </div>
                                {scheduledDateTime && (
                                    <div className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/30 rounded-lg px-4 py-2.5">
                                        <CheckCircle className="w-4 h-4 shrink-0" />
                                        <span>
                                            Contest will be locked until <strong>{new Date(scheduledDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rated Toggle */}
                    {isAdminContest && (
                        <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Rated Contest</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Performance will affect participants' Global Elo Ratings.</p>
                                {examMode === 'custom' && isRated && (
                                    <p className="text-xs text-amber-500 mt-1 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Custom exams are usually left unrated.</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRated(!isRated)}
                                className={`w-11 h-6 rounded-full transition-colors flex items-center shrink-0 ${isRated ? 'bg-amber-500' : 'bg-gray-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${isRated ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    )}

                    {/* Public Toggle (non-admin) */}
                    {!isAdminContest && (
                        <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Publish to Community</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Make this contest visible to everyone on the platform.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPublic(!isPublic)}
                                className={`w-11 h-6 rounded-full transition-colors flex items-center shrink-0 ${isPublic ? 'bg-blue-500' : 'bg-gray-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 4: Details & Prizes */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">4</span>
                    Additional Details
                </h3>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800/50 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none transition resize-y"
                            placeholder="Welcome to this GATECode contest..."
                        />
                    </div>

                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                Bonus Prizes <span className="text-xs font-normal text-gray-500 ml-1">(Optional)</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setPrizes([...prizes, { rank: '', prize: '' }])}
                                className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 dark:text-orange-400 px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                                + Add Prize Row
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {prizes.length === 0 && (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">No prizes configured. Add a row to incentivize users.</p>
                            )}
                            {prizes.map((p, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={p.rank}
                                        onChange={(e) => {
                                            const newPrizes = [...prizes];
                                            newPrizes[idx] = { ...newPrizes[idx], rank: e.target.value };
                                            setPrizes(newPrizes);
                                        }}
                                        placeholder="Rank (e.g. 1st – 3rd)"
                                        className="w-1/3 p-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={p.prize}
                                        onChange={(e) => {
                                            const newPrizes = [...prizes];
                                            newPrizes[idx] = { ...newPrizes[idx], prize: e.target.value };
                                            setPrizes(newPrizes);
                                        }}
                                        placeholder="Prize (e.g. GATECode Premium)"
                                        className="flex-1 p-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPrizes(prizes.filter((_, i) => i !== idx))}
                                        className="text-xs text-red-500 hover:text-red-600 px-3 py-2.5 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-semibold"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Log & Submit */}
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-4">
                <div className="bg-zinc-900 dark:bg-black p-4 rounded-xl text-xs font-mono text-zinc-300 dark:text-zinc-400 min-h-[6rem] max-h-[12rem] overflow-y-auto whitespace-pre-wrap shadow-inner">
                    {status || "> System ready. Ensure Firestore has a 'questions_{branch}' collection."}
                </div>

                <button
                    onClick={generateContest}
                    disabled={loading || (enableSchedule && !scheduledDateTime)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-base shadow-blue-500/20"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                    {loading ? 'GENERATING EXAM...' : 'GENERATE EXAM NOW'}
                </button>

                {enableSchedule && !scheduledDateTime && (
                    <p className="text-sm text-center text-red-500 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        Please set a valid start date &amp; time.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ContestGenerator;
