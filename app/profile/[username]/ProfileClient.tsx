"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, Settings as SettingsIcon, CheckCircle, TrendingUp, Zap, BarChart, Loader2, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    documentId,
    doc,
    onSnapshot,
    limit,
    startAfter,
    DocumentSnapshot,
    DocumentData
} from 'firebase/firestore';
import { User, Submission, Question } from '@/data/mockData';
import UserNotFound from '@/components/UserNotFound';
import { ProfileSkeleton } from '@/components/Skeletons';
import { useMetadata } from '@/contexts/MetadataContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getRankTier } from '@/utils/rating';

const SUBMISSIONS_PAGE_SIZE = 5;

const StatCard = ({ icon: Icon, value, label, colorClass }: { icon: React.ElementType, value: string | number, label: string, colorClass: string }) => (
    <div className="bg-white dark:bg-zinc-900/70 p-4 rounded-xl flex items-center gap-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div>
            <p className={`text-xl font-bold text-zinc-800 dark:text-white`}>{value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        </div>
    </div>
);

const ActivityCalendar = ({ calendarData, availableYears }: { calendarData: Record<string, number>; availableYears: number[] }) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedDateStat, setSelectedDateStat] = useState<{ count: number, date: Date, x: number, y: number } | null>(null);

    const displayYears = useMemo(() => {
        const yearsSet = new Set(availableYears);
        yearsSet.add(currentYear);
        const lastFiveYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
        lastFiveYears.forEach(year => yearsSet.add(year));
        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [availableYears, currentYear]);

    useEffect(() => {
        if (displayYears.length > 0 && !displayYears.includes(selectedYear)) {
            setSelectedYear(displayYears[0] || currentYear);
        }
    }, [displayYears, selectedYear, currentYear]);

    useEffect(() => {
        const handleClickOutside = () => setSelectedDateStat(null);
        const handleScroll = () => setSelectedDateStat(null);

        document.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);


    const { yearlySubmissions, calendarData: calendarGrid, monthLabels } = useMemo(() => {
        let submissionCount = 0;
        const submissionCounts: Record<string, number> = {};

        for (const dateStr in calendarData) {
            if (dateStr.startsWith(selectedYear.toString())) {
                const count = calendarData[dateStr] || 0;
                const dateObj = new Date(dateStr + 'T00:00:00');
                submissionCounts[dateObj.toDateString()] = count;
                submissionCount += count;
            }
        }

        const calendarGrid: ({ date: Date; count: number } | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null));
        const firstDayOfYear = new Date(selectedYear, 0, 1);
        const firstDayWeekday = firstDayOfYear.getDay();

        let gridStartDate = new Date(firstDayOfYear);
        gridStartDate.setDate(gridStartDate.getDate() - firstDayWeekday);

        let currentDate = new Date(gridStartDate);
        let maxWeekIndex = 0;

        for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
            let weekHasDayInYear = false;
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                if (currentDate.getFullYear() === selectedYear) {
                    const dateStr = currentDate.toDateString();
                    calendarGrid[weekIndex][dayIndex] = {
                        date: new Date(currentDate),
                        count: submissionCounts[dateStr] || 0,
                    };
                    weekHasDayInYear = true;
                } else {
                    calendarGrid[weekIndex][dayIndex] = null;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            if (weekHasDayInYear) {
                maxWeekIndex = weekIndex;
            }
            if (currentDate.getFullYear() > selectedYear && currentDate.getDay() === 0) {
                break;
            }
        }

        const trimmedCalendarGrid = calendarGrid.slice(0, maxWeekIndex + 1);
        const monthLabels: { name: string; weekIndex: number }[] = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let lastMonth = -1;

        trimmedCalendarGrid.forEach((week, weekIndex) => {
            const firstDayOfYearInWeek = week.find(day => day?.date.getFullYear() === selectedYear);
            if (firstDayOfYearInWeek) {
                const month = firstDayOfYearInWeek.date.getMonth();
                if (month !== lastMonth) {
                    if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].weekIndex + 2) {
                        monthLabels.push({ name: monthNames[month], weekIndex });
                        lastMonth = month;
                    } else if (monthLabels.length > 0 && monthLabels[monthLabels.length - 1].name !== monthNames[month]) {
                        const lastLabelWeek = monthLabels[monthLabels.length - 1].weekIndex;
                        if (weekIndex > lastLabelWeek) {
                            monthLabels.push({ name: monthNames[month], weekIndex });
                            lastMonth = month;
                        }
                    }
                }
            }
        });

        return { yearlySubmissions: submissionCount, calendarData: trimmedCalendarGrid, monthLabels };
    }, [selectedYear, calendarData]);

    const getIntensity = (count: number) => {
        if (count === 0) return 'bg-zinc-200 dark:bg-zinc-800 opacity-50 dark:opacity-40';
        if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
        if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700';
        return 'bg-emerald-600 dark:bg-emerald-500';
    };

    const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekColumnWidth = 14;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                <h3 className="text-lg font-semibold text-zinc-800 dark:text-white order-1 sm:order-none">
                    {yearlySubmissions} {yearlySubmissions === 1 ? 'submission' : 'submissions'} in {selectedYear}
                </h3>
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 order-first sm:order-none">
                    {displayYears.map(year => (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${selectedYear === year
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/70 p-4 rounded-lg overflow-x-auto border border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-3">
                    <div className="flex flex-col justify-between pt-5 pr-1 text-xs text-zinc-400 dark:text-zinc-500 shrink-0" style={{ height: `${7 * 10 + 6 * 4}px` }}>
                        {weekDayLabels.map((day, index) => (
                            <div key={index} className="h-2.5 flex items-center">
                                {(index === 1 || index === 3 || index === 5) ? day.substring(0, 3) : ''}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col">
                        <div className="relative mb-1" style={{ height: '1em', width: `${calendarGrid.length * weekColumnWidth}px` }}>
                            {monthLabels.map(({ name, weekIndex }) => (
                                <span
                                    key={name}
                                    className="absolute top-0 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
                                    style={{ left: `${weekIndex * weekColumnWidth}px` }}
                                >
                                    {name}
                                </span>
                            ))}
                        </div>

                        <div className="grid grid-flow-col auto-cols-max gap-1">
                            {calendarGrid.map((week: ({ date: Date; count: number } | null)[], weekIndex: number) => (
                                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                                    {week.map((day: { date: Date; count: number } | null, dayIndex: number) => (
                                        <div
                                            key={day ? day.date.toISOString() : `empty-${weekIndex}-${dayIndex}`}
                                            className={`w-2.5 h-2.5 rounded-sm transition-transform hover:scale-110 ${day ? `${getIntensity(day.count)} cursor-pointer` : 'bg-zinc-100 dark:bg-zinc-800 opacity-40'}`}
                                            onMouseEnter={(e) => {
                                                if (day) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setSelectedDateStat({ count: day.count, date: day.date, x: rect.left + rect.width / 2, y: rect.top });
                                                }
                                            }}
                                            onMouseLeave={() => setSelectedDateStat(null)}
                                            onClick={(e) => {
                                                if (day) {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    if (selectedDateStat && selectedDateStat.date.getTime() === day.date.getTime()) {
                                                        setSelectedDateStat(null);
                                                    } else {
                                                        setSelectedDateStat({ count: day.count, date: day.date, x: rect.left + rect.width / 2, y: rect.top });
                                                    }
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-2 pr-2">
                    <span>Less</span>
                    <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(0)}`}></div>
                    <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(1)}`}></div>
                    <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(3)}`}></div>
                    <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(6)}`}></div>
                    <span>More</span>
                </div>
            </div>

            {selectedDateStat && (
                <div
                    className="fixed z-50 mb-2 px-3 py-2 text-xs text-white bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none font-medium transform -translate-x-1/2 -translate-y-full transition-opacity duration-200"
                    style={{ left: selectedDateStat.x, top: selectedDateStat.y - 4 }}
                >
                    {selectedDateStat.count} submission{selectedDateStat.count !== 1 ? 's' : ''} on {selectedDateStat.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-zinc-800 dark:border-t-zinc-100 border-b-0"></div>
                </div>
            )}
        </div>
    );
};

export default function ProfileClient({ username }: { username: string }) {
    const { user: authUser, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading, selectedBranch, questionCollectionPath, availableBranches } = useMetadata();

    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [userFound, setUserFound] = useState(true);

    const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    const [submissionsLastDoc, setSubmissionsLastDoc] = useState<DocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreSubmissions, setHasMoreSubmissions] = useState(false);

    const isOwnProfile = authUser && profileUser && authUser.uid === profileUser.uid;

    const fetchSubmissions = useCallback(async (profileUid: string, collectionPath: string, branch: string, isFirstPage: boolean = false) => {
        if (!isFirstPage && !hasMoreSubmissions) return;

        setLoadingSubmissions(true);

        try {
            let submissionsQuery = query(
                collection(db, `users/${profileUid}/submissions`),
                where('branch', '==', branch),
                orderBy('timestamp', 'desc'),
                limit(SUBMISSIONS_PAGE_SIZE)
            );

            if (!isFirstPage && submissionsLastDoc) {
                submissionsQuery = query(submissionsQuery, startAfter(submissionsLastDoc));
            }

            const submissionsSnapshot = await getDocs(submissionsQuery);
            const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);

            const lastDoc = submissionsSnapshot.docs[submissionsSnapshot.docs.length - 1];
            setSubmissionsLastDoc(lastDoc || null);
            setHasMoreSubmissions(submissionsData.length === SUBMISSIONS_PAGE_SIZE);

            setRecentSubmissions(prev => isFirstPage ? submissionsData : [...prev, ...submissionsData]);

        } catch (error) {
            console.error("[Profile] Error fetching submissions:", error);
        } finally {
            setLoadingSubmissions(false);
        }
    }, [hasMoreSubmissions, submissionsLastDoc]);

    useEffect(() => {
        if (!username || !questionCollectionPath || !selectedBranch) {
            setLoadingUser(true);
            setUserFound(false);
            return;
        };

        setLoadingUser(true);
        setUserFound(true);
        setProfileUser(null);
        setRecentSubmissions([]);
        setSubmissionsLastDoc(null);
        setHasMoreSubmissions(false);

        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where("username", "==", username), limit(1));

        let unsubscribe: () => void = () => { };

        getDocs(userQuery).then(userSnapshot => {
            if (userSnapshot.empty) {
                setUserFound(false);
                setLoadingUser(false);
                return;
            }

            const userDoc = userSnapshot.docs[0];
            const profileUid = userDoc.id;

            const userDocRef = doc(db, 'users', profileUid);

            unsubscribe = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    const userData = doc.data() as User;
                    if (!userData.branchStats) { userData.branchStats = {}; }
                    if (!userData.ratings) { userData.ratings = {}; }
                    if (!userData.branchActivityCalendar) { userData.branchActivityCalendar = {}; }
                    if (!userData.branchStreakData) { userData.branchStreakData = {}; }

                    setProfileUser(userData);
                    setUserFound(true);
                } else {
                    setUserFound(false);
                }
                setLoadingUser(false);
            }, (error) => {
                console.error("[Profile] Error listening to user document:", error);
                setUserFound(false);
                setLoadingUser(false);
            });

            fetchSubmissions(profileUid, questionCollectionPath, selectedBranch, true);

        }).catch(error => {
            console.error("[Profile] Error fetching user by username:", error);
            setUserFound(false);
            setLoadingUser(false);
        });

        return () => {
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, selectedBranch, questionCollectionPath]);


    const {
        branchRating,
        branchStats,
        branchStreak,
        branchCalendar,
        allAvailableYears,
        subjectStats,
        ratingHistory,
        highestRating
    } = useMemo(() => {
        if (!profileUser || !metadata) {
            return {
                branchRating: 0,
                branchStats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
                branchStreak: { currentStreak: 0, lastSubmissionDate: '' },
                branchCalendar: {},
                allAvailableYears: [],
                subjectStats: [],
                ratingHistory: [] as any[],
                highestRating: 1500
            };
        }

        const rating = profileUser.ratings?.[selectedBranch] || 0;
        const stats = profileUser.branchStats?.[selectedBranch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
        const streak = profileUser.branchStreakData?.[selectedBranch] || { currentStreak: 0, lastSubmissionDate: '' };
        const calendar = profileUser.branchActivityCalendar?.[selectedBranch] || {};

        const years = new Set<number>();
        if (profileUser.branchActivityCalendar) {
            Object.values(profileUser.branchActivityCalendar).forEach(branchCalendar => {
                Object.keys(branchCalendar).forEach(dateStr => {
                    years.add(parseInt(dateStr.substring(0, 4), 10));
                });
            });
        }

        const solvedCounts = stats.subjects || {};
        const subjectStats = Object.entries(metadata.subjectCounts || {}).map(([subjectName, total]) => ({
            name: subjectName,
            solved: solvedCounts[subjectName] || 0,
            total: total
        }));

        const ratingHistory = profileUser.ratingHistory || [];

        return {
            branchRating: rating,
            branchStats: stats,
            branchStreak: streak,
            branchCalendar: calendar,
            allAvailableYears: Array.from(years).sort((a, b) => b - a),
            subjectStats: subjectStats,
            ratingHistory,
            highestRating: profileUser.highestRating || 1500
        };
    }, [profileUser, metadata, selectedBranch]);


    if (authLoading || metadataLoading || (loadingUser && !profileUser)) {
        return <ProfileSkeleton />;
    }
    if (!userFound || !profileUser) {
        return <UserNotFound username={username} />;
    }

    const branchName = availableBranches[selectedBranch] || 'Stats';

    return (
        <div className="min-h-screen w-full p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* User Info Card */}
                        <div className="bg-white dark:bg-zinc-900/70 p-5 md:p-6 relative rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex flex-row md:flex-col items-center text-left md:text-center gap-5 md:gap-0">
                                <div className="relative shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={profileUser.avatar || '/user.png'} alt={profileUser.name || 'User Avatar'} className="w-20 h-20 md:w-28 md:h-28 rounded-full shadow-lg border-4 border-white dark:border-zinc-700 object-cover" onError={(e) => { e.currentTarget.src = '/user.png'; }} />
                                    <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 ${getRankTier(branchRating).bg} ${getRankTier(branchRating).color} rounded-full px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-bold shadow-md flex items-center gap-1 whitespace-nowrap border border-current`}>
                                        {getRankTier(branchRating).title}
                                    </span>
                                </div>
                                <div className="flex-1 md:mt-6">
                                    <h1 className={`text-xl md:text-2xl font-bold ${getRankTier(branchRating).color}`}>{profileUser.name || 'User'}</h1>
                                    <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400">@{profileUser.username || 'username'}</p>
                                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-1.5 md:mt-2 text-xs md:text-sm">
                                        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        <span>Joined {profileUser.joined ? new Date(profileUser.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            {isOwnProfile && (<Link href="/settings" className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors" title="Settings"><SettingsIcon className="w-4 h-4 md:w-5 md:h-5 text-zinc-500 dark:text-zinc-400" /></Link>)}
                        </div>

                        {/* Subject Mastery Card */}
                        <div className="bg-white dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <h2 className="text-lg font-semibold p-6 border-b border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white">Subject Mastery ({branchName})</h2>
                            <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
                                {subjectStats.length > 0 ? (
                                    subjectStats.sort((a, b) => b.total - a.total)
                                        .filter(data => data.total > 0)
                                        .map((data) => {
                                            const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0;
                                            return (
                                                <div key={data.name}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{data.name}</span>
                                                        <span className="text-zinc-500 dark:text-zinc-400">{data.solved} / {data.total}</span>
                                                    </div>
                                                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                                                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                ) : (
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading subject data...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Activity Calendar Card */}
                        <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <h2 className="text-lg font-semibold pb-2 text-zinc-800 dark:text-white">Activity ({branchName})</h2>
                            <ActivityCalendar
                                calendarData={branchCalendar}
                                availableYears={allAvailableYears}
                            />
                        </div>

                        {/* Stat Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                            <StatCard icon={BarChart} value={branchRating} label="Current Rating" colorClass="text-blue-500 dark:text-blue-400" />
                            <StatCard icon={Trophy} value={highestRating} label="Highest Rating" colorClass="text-yellow-500 dark:text-yellow-400" />
                            <StatCard icon={CheckCircle} value={branchStats.correct || 0} label="Solved" colorClass="text-emerald-500 dark:text-emerald-400" />
                            <StatCard icon={Zap} value={`${branchStreak.currentStreak || 0} Days`} label="Current Streak" colorClass="text-orange-500 dark:text-orange-400" />
                        </div>

                        {/* Rating History Graph */}
                        {ratingHistory && ratingHistory.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <h2 className="text-lg font-semibold pb-4 text-zinc-800 dark:text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-purple-500" /> Rating History
                                </h2>
                                <div className="h-64 mt-4 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={ratingHistory}>
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                domain={['dataMin - 50', 'dataMax + 50']}
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                formatter={(value: any, name: any, props: any) => [
                                                    <span key="data" className="font-bold">{value} <span className="text-xs text-gray-500 font-normal">({props.payload.contestTitle})</span></span>,
                                                    'Rating'
                                                ]}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="newRating"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Recent Submissions Card */}
                        <div className="bg-white dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <h2 className="text-lg font-semibold p-6 border-b border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white">Recent Submissions ({branchName})</h2>
                            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {recentSubmissions.length > 0 ? (
                                    recentSubmissions.map((activity) => (
                                        <div key={activity.timestamp + activity.qid} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors gap-2">
                                            <div>
                                                <Link href={`/question/${activity.qid}`} className="font-semibold text-blue-500 dark:text-blue-400 hover:underline">
                                                    {activity.questionTitle || `Question ${activity.qid.substring(0, 6)}...`}
                                                </Link>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                    {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                                                </p>
                                            </div>
                                            <span className={`text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${activity.correct ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'}`}>
                                                {activity.correct ? 'Accepted' : 'Wrong Answer'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    !loadingSubmissions && <p className="p-6 text-zinc-500 dark:text-zinc-400">No recent submissions found for this branch.</p>
                                )}

                                {loadingSubmissions && (
                                    <div className="p-4 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto" />
                                    </div>
                                )}

                                {hasMoreSubmissions && !loadingSubmissions && (
                                    <button
                                        onClick={() => fetchSubmissions(profileUser.uid, questionCollectionPath, selectedBranch, false)}
                                        className="w-full p-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                    >
                                        Load More
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
