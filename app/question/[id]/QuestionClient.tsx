"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, BookOpen, Bookmark, Calendar, RotateCcw, Save, Timer as TimerIcon, Play, Pause, LogIn, Check as CheckIcon, X as XIcon, FolderPlus, ListPlus, ClipboardList } from 'lucide-react';
import Image from 'next/image';

import { doc, getDoc, setDoc, collection, getDocs, arrayUnion, arrayRemove, query, serverTimestamp, writeBatch, orderBy, addDoc, increment } from 'firebase/firestore';
import { db, type Option } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Question, Submission, UserQuestionData, QuestionList, UserStats, UserStreakData, User } from '@/data/mockData';
import { useMetadata } from '@/contexts/MetadataContext';
import { QuestionDetailSkeleton } from '@/components/Skeletons';
import MathRenderer from '@/components/MathRenderer';
import ErrorBoundary from '@/components/ErrorBoundary';

// --- Types ---


const RATING_SCALING_FACTOR = 100;
const calculateRating = (accuracy: number | undefined, correct: number | undefined): number => {
    const safeAccuracy = accuracy ?? 0;
    const safeCorrect = correct ?? 0;
    const rating = Math.max(0, (safeAccuracy / 100) * Math.log10(safeCorrect + 1) * RATING_SCALING_FACTOR);
    return parseFloat(rating.toFixed(2));
};

function formatDate(date: Date | string): string | null {
    if (!(date instanceof Date)) {
        try {
            date = new Date(date);
            if (isNaN(date.getTime())) throw new Error("Invalid date");
        } catch (e) {
            console.warn("Could not parse date:", date, (e as Error).message);
            return null;
        }
    }
    return date.toISOString().split('T')[0];
}

function getDayDiff(date1: Date, date2: Date): number {
    const d1 = new Date(date1.toDateString());
    const d2 = new Date(date2.toDateString());
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const extractAndCleanHtml = (html: string, contentClass?: string): string => {
    if (!html) return '';

    let clean = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

    // Remove legacy practicepaper images and internal wp-content uploads
    clean = clean.replace(/<img[^>]+src=["'][^"']*practicepaper[^"']*["'][^>]*>/gi, '');
    clean = clean.replace(/<img[^>]+src=["'][^"']*wp-content[^"']*["'][^>]*>/gi, '');
    clean = clean.replace(/<img[^>]+src=["']http:\/\/www\.practicepaper\.in[^"']*["'][^>]*>/gi, '');

    clean = clean.replace(
        /(<img[^>]*?data-src=(["']))(.*?)\2([^>]*?src=(["']))(.*?)\5/gi,
        (_match, part1, quote, dataSrcValue, part2, _part3, _oldSrcValue) => {
            return `${part1}${dataSrcValue}${quote}${part2}${dataSrcValue}${quote}`;
        }
    );

    clean = clean.replace(/class=(["'])(.*?)(lazyload)(.*?)(\1)/gi, (_match, quote, before, _lazyload, after) => {
        const newClasses = (before + after).trim().replace(/\s{2,}/g, ' ');
        if (newClasses) {
            return `class=${quote}${newClasses}${quote}`;
        }
        return '';
    });

    if (contentClass) {
        const regex = new RegExp(`<div[^>]*class=["'][^"']*${contentClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/div>`, 'i');
        const match = clean.match(regex);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return clean.trim();
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const LoginPrompt = () => {
    const pathname = usePathname();
    return (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium text-center sm:text-left">
                You need to be logged in to attempt questions, track progress, save notes, and use other features.
            </p>
            <Link
                href={`/login?returnUrl=${encodeURIComponent(pathname || '/')}`}
                className="flex-shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm shadow-md hover:shadow-lg"
            >
                <LogIn className="w-4 h-4" />
                Login / Sign Up
            </Link>
        </div>
    );
};

const ListsModal = ({
    isOpen,
    onClose,
    questionId,
    userId
}: {
    isOpen: boolean;
    onClose: () => void;
    questionId: string;
    userId: string;
}) => {
    const [lists, setLists] = useState<QuestionList[]>([]);
    const [questionListIds, setQuestionListIds] = useState<Set<string>>(new Set());
    const [loadingLists, setLoadingLists] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newListName, setNewListName] = useState("");
    const [creatingList, setCreatingList] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            const fetchLists = async () => {
                setLoadingLists(true);
                try {
                    const listsQuery = query(collection(db, `users/${userId}/questionLists`), orderBy('createdAt', 'desc'));
                    const listsSnapshot = await getDocs(listsQuery);
                    const userLists = listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
                    setLists(userLists);

                    const userQuestionDataRef = doc(db, `users/${userId}/userQuestionData`, questionId);
                    const userQuestionDataSnap = await getDoc(userQuestionDataRef);
                    if (userQuestionDataSnap.exists()) {
                        const data = userQuestionDataSnap.data() as UserQuestionData;
                        setQuestionListIds(new Set(data.savedListIds || []));
                    } else {
                        setQuestionListIds(new Set());
                    }
                } catch (error) {
                    console.error("Error fetching lists:", error);
                } finally {
                    setLoadingLists(false);
                }
            };
            fetchLists();
        }
    }, [isOpen, userId, questionId]);

    const handleToggleList = (listId: string) => {
        setQuestionListIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(listId)) {
                newSet.delete(listId);
            } else {
                newSet.add(listId);
            }
            return newSet;
        });
    };

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim() || creatingList) return;

        setCreatingList(true);
        try {
            const newListData: Omit<QuestionList, 'id' | 'createdAt'> = {
                uid: userId,
                name: newListName.trim(),
                questionIds: [questionId],
                isPrivate: false,
            };

            const listCollectionRef = collection(db, `users/${userId}/questionLists`);
            const docRef = await addDoc(listCollectionRef, {
                ...newListData,
                createdAt: serverTimestamp()
            });

            setLists(prev => [{ ...newListData, id: docRef.id, questionIds: [questionId], createdAt: new Date().toISOString() }, ...prev]);
            handleToggleList(docRef.id);
            setNewListName("");

        } catch (error) {
            console.error("Error creating new list:", error);
        } finally {
            setCreatingList(false);
        }
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        const batch = writeBatch(db);
        const newSavedListIds = Array.from(questionListIds);

        const userQuestionDataRef = doc(db, `users/${userId}/userQuestionData`, questionId);
        batch.set(userQuestionDataRef, { savedListIds: newSavedListIds }, { merge: true });

        lists.forEach(list => {
            const questionIsInList = list.questionIds && list.questionIds.includes(questionId);
            const questionShouldBeInList = questionListIds.has(list.id);

            const listRef = doc(db, `users/${userId}/questionLists`, list.id);

            if (questionShouldBeInList && !questionIsInList) {
                batch.update(listRef, { questionIds: arrayUnion(questionId) });
            } else if (!questionShouldBeInList && questionIsInList) {
                batch.update(listRef, { questionIds: arrayRemove(questionId) });
            }
        });

        try {
            await batch.commit();
            onClose();
        } catch (error) {
            console.error("Error saving list changes:", error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 max-w-md w-full relative transform transition-all" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Save to...</h3>

                {loadingLists ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleCreateList} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newListName}
                                onChange={e => setNewListName(e.target.value)}
                                placeholder="Create new list..."
                                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                            />
                            <button type="submit" disabled={creatingList || !newListName.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-zinc-400 dark:disabled:bg-zinc-600">
                                {creatingList ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderPlus className="w-5 h-5" />}
                            </button>
                        </form>

                        <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-1">
                            {lists.length === 0 && (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No lists created yet.</p>
                            )}
                            {lists.filter(list => list.id !== 'favorites').map(list => (
                                <label
                                    key={list.id}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={questionListIds.has(list.id)}
                                        onChange={() => handleToggleList(list.id)}
                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{list.name}</span>
                                </label>
                            ))}
                        </div>

                        <button
                            onClick={handleSaveChanges}
                            disabled={saving}
                            className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-zinc-400 dark:disabled:bg-zinc-600 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckIcon className="w-5 h-5" />}
                            Done
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default function QuestionClient({ id }: { id: string }) {
    const router = useRouter();
    const { user, userInfo, setUserInfo, loading: loadingAuth, isAuthenticated } = useAuth();
    const { metadata, loading: metadataLoading, questionCollectionPath, selectedBranch } = useMetadata();

    const [question, setQuestion] = useState<Question | null>(null);
    const [loadingData, setLoadingData] = useState(true);

    // DEBUG: Navigation Diagnosis
    useEffect(() => {
        if (!loadingData && !metadataLoading) {
            console.log("Navigation Debug:", {
                questionId: id,
                selectedBranch,
                metadataTotalQuestions: metadata?.allQuestionIds?.length,
                indexInMetadata: metadata?.allQuestionIds?.indexOf(id),
                nextId: metadata?.allQuestionIds ? metadata.allQuestionIds[metadata.allQuestionIds.indexOf(id) + 1] : 'N/A'
            });
        }
    }, [id, metadata, selectedBranch, loadingData, metadataLoading]);

    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [natAnswer, setNatAnswer] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [note, setNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isTimerOn, setIsTimerOn] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleResetTimer = () => {
        setTimeElapsed(0);
    };


    useEffect(() => {
        const fetchAllData = async () => {
            if (!id || !questionCollectionPath) {
                return;
            }
            if (timerRef.current) clearInterval(timerRef.current);
            setLoadingData(true);
            setSubmitted(false);
            setSelectedOptions([]);
            setNatAnswer('');
            setIsFavorite(false);
            setNote('');
            setTimeElapsed(0);
            setIsTimerOn(false);

            try {
                const docRef = doc(db, questionCollectionPath, id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const fetchedQuestion = { id: docSnap.id, ...docSnap.data() } as Question;
                    setQuestion(fetchedQuestion);

                    if (user && isAuthenticated && !loadingAuth) {
                        const submissionRef = doc(db, `users/${user.uid}/submissions`, id);
                        const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);

                        const [submissionSnap, userQuestionDataSnap] = await Promise.all([
                            getDoc(submissionRef),
                            getDoc(userQuestionDataRef)
                        ]);

                        if (submissionSnap.exists()) {
                            const sub = submissionSnap.data() as Submission;
                            if (sub.branch === selectedBranch) {
                                setSubmitted(true);
                                setIsCorrect(sub.correct);
                                setSelectedOptions(sub.selectedOptions || []);
                                setNatAnswer(sub.natAnswer || '');
                                setTimeElapsed(sub.timeTaken || 0);
                            }
                        }
                        if (userQuestionDataSnap.exists()) {
                            const data = userQuestionDataSnap.data() as UserQuestionData;
                            setIsFavorite(data.isFavorite || false);
                            setNote(data.note || '');
                        }
                    }
                } else {
                    setQuestion(null);
                }

            } catch (error) {
                console.error("Error fetching question data:", error);
            } finally {
                setLoadingData(false);
            }
        };
        fetchAllData();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [id, user, loadingAuth, isAuthenticated, setUserInfo, questionCollectionPath, selectedBranch]);


    useEffect(() => {
        if (isAuthenticated && isTimerOn && !submitted) {
            timerRef.current = window.setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isAuthenticated, isTimerOn, submitted]);

    const handleMcqSelect = (label: string) => {
        if (submitted || !isAuthenticated) return;
        setSelectedOptions([label]);
    };
    const handleMsqToggle = (label: string) => {
        if (submitted || !isAuthenticated) return;
        setSelectedOptions(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        );
    };


    const handleSubmit = async () => {
        if (!user || !question || !userInfo || submitted || !selectedBranch) return;

        setIsTimerOn(false);
        let userCorrect = false;
        const today = new Date();
        const todayStr = formatDate(today);
        if (!todayStr) {
            console.error("Could not format today's date.");
            return;
        }

        if (question.question_type === 'nat') {
            const userAnswer = parseFloat(natAnswer.trim());
            const min = parseFloat(question.nat_answer_min || '-Infinity');
            const max = parseFloat(question.nat_answer_max || 'Infinity');
            if (isNaN(userAnswer)) {
                userCorrect = false;
            } else {
                userCorrect = userAnswer >= min && userAnswer <= max;
            }
        } else if (question.question_type === 'msq') {
            const correctLabels = new Set(question.options.filter((o: Option) => o.is_correct && o.label !== null).map((o: Option) => o.label as string));
            const selectedLabels = new Set(selectedOptions);
            userCorrect = correctLabels.size === selectedLabels.size &&
                [...correctLabels].every(label => selectedLabels.has(label));
        } else {
            if (!selectedOptions[0]) return;
            const correctOption = question.options.find((opt: Option) => opt.is_correct);
            userCorrect = selectedOptions[0] === correctOption?.label;
        }

        setIsCorrect(userCorrect);
        setSubmitted(true);

        const submissionData: Submission = {
            qid: question.id,
            uid: user.uid,
            correct: userCorrect,
            timestamp: today.toISOString(),
            selectedOptions: selectedOptions,
            natAnswer: natAnswer || '',
            timeTaken: timeElapsed > 0 ? timeElapsed : 0,
            branch: selectedBranch,
            questionTitle: question.title || "Untitled Question"
        };

        try {
            const defaultStats: UserStats = { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
            const defaultStreak: UserStreakData = { currentStreak: 0, lastSubmissionDate: '' };

            const oldBranchStats = userInfo.branchStats?.[selectedBranch] || defaultStats;
            const oldBranchStreak = userInfo.branchStreakData?.[selectedBranch] || defaultStreak;
            const oldBranchCalendar = userInfo.branchActivityCalendar?.[selectedBranch] || {};

            const newBranchStats = { ...oldBranchStats, subjects: { ...(oldBranchStats.subjects || {}) } };
            newBranchStats.attempted = (newBranchStats.attempted || 0) + 1;
            if (userCorrect) {
                newBranchStats.correct = (newBranchStats.correct || 0) + 1;
                const subject = question.subject;
                if (subject && subject !== "General" && subject !== "N/A") {
                    newBranchStats.subjects[subject] = (newBranchStats.subjects[subject] || 0) + 1;
                }
            }
            newBranchStats.accuracy = newBranchStats.attempted > 0 ? parseFloat(((newBranchStats.correct / newBranchStats.attempted) * 100).toFixed(2)) : 0;

            const newBranchStreakData = { ...oldBranchStreak };
            if (todayStr !== oldBranchStreak.lastSubmissionDate) {
                const lastSubDate = oldBranchStreak.lastSubmissionDate ? new Date(oldBranchStreak.lastSubmissionDate + 'T00:00:00') : null;
                if (lastSubDate && getDayDiff(today, lastSubDate) === 1) {
                    newBranchStreakData.currentStreak = (oldBranchStreak.currentStreak || 0) + 1;
                } else {
                    newBranchStreakData.currentStreak = 1;
                }
                newBranchStreakData.lastSubmissionDate = todayStr;
            }

            const newBranchCalendar = { ...oldBranchCalendar };
            newBranchCalendar[todayStr] = (newBranchCalendar[todayStr] || 0) + 1;

            const newBranchRating = calculateRating(newBranchStats.accuracy, newBranchStats.correct);

            const userDocRef = doc(db, 'users', user.uid);
            const submissionDocRef = doc(db, `users/${user.uid}/submissions`, question.id);

            const batch = writeBatch(db);
            batch.set(submissionDocRef, submissionData);

            batch.set(userDocRef, {
                branchStats: { [selectedBranch]: newBranchStats },
                branchStreakData: { [selectedBranch]: newBranchStreakData },
                branchActivityCalendar: { [selectedBranch]: newBranchCalendar },
                ratings: { [selectedBranch]: newBranchRating }
            }, { merge: true });

            // --- Update question's global accuracy stats ---
            // Only update the question doc on first-time submission (not re-attempts)
            // We use increment() for atomic concurrent writes from multiple users
            const questionDocRef = doc(db, questionCollectionPath, question.id);
            const newAttempts = (question.attempts || 0) + 1;
            const newCorrectCount = (question.correctCount || 0) + (userCorrect ? 1 : 0);
            const newAccuracy = newAttempts > 0 ? parseFloat(((newCorrectCount / newAttempts) * 100).toFixed(1)) : 0;

            batch.update(questionDocRef, {
                attempts: increment(1),
                correctCount: increment(userCorrect ? 1 : 0),
                accuracy: newAccuracy,
            });

            await batch.commit();

            // Update local question state to reflect new accuracy stats immediately
            setQuestion(prev => prev ? {
                ...prev,
                attempts: newAttempts,
                correctCount: newCorrectCount,
                accuracy: newAccuracy,
            } : prev);

            setUserInfo((prev: User | null) => {
                if (!prev) return null;

                const newBranchStatsMap = { ...prev.branchStats, [selectedBranch]: newBranchStats };
                const newBranchStreakMap = { ...prev.branchStreakData, [selectedBranch]: newBranchStreakData };
                const newBranchCalendarMap = { ...prev.branchActivityCalendar, [selectedBranch]: newBranchCalendar };
                const newRatingsMap = { ...prev.ratings, [selectedBranch]: newBranchRating };

                return {
                    ...prev,
                    branchStats: newBranchStatsMap,
                    branchStreakData: newBranchStreakMap,
                    branchActivityCalendar: newBranchCalendarMap,
                    ratings: newRatingsMap
                };
            });

        } catch (error) {
            console.error("Error saving submission/updating stats:", error);
            setSubmitted(false);
            setIsCorrect(false);
        }
    };

    const handleTryAgain = async () => {
        if (!user || !question || resetting) return;
        setResetting(true);
        try {
            const submissionDocRef = doc(db, `users/${user.uid}/submissions`, question.id);
            const batch = writeBatch(db);
            batch.delete(submissionDocRef);
            await batch.commit();

            // Just reset the local state
            setSubmitted(false);
            setSelectedOptions([]);
            setNatAnswer('');
            setIsCorrect(false);
            setTimeElapsed(0);
            setIsTimerOn(false);
        } catch (error) {
            console.error("Error resetting submission:", error);
        } finally {
            setResetting(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!user || !id) return;
        const newFavoriteStatus = !isFavorite;
        setIsFavorite(newFavoriteStatus);

        const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
        const favoritesListRef = doc(db, `users/${user.uid}/questionLists`, 'favorites');

        try {
            const batch = writeBatch(db);
            batch.set(userQuestionDataRef, { isFavorite: newFavoriteStatus }, { merge: true });

            if (newFavoriteStatus) {
                batch.set(favoritesListRef, {
                    questionIds: arrayUnion(id),
                    name: "Favorites",
                    uid: user.uid,
                    createdAt: serverTimestamp()
                }, { merge: true });
                const bookmarkRef = doc(db, `users/${user.uid}/bookmarks`, id);
                batch.set(bookmarkRef, {
                    ...question,
                    bookmarkedAt: Date.now()
                });
            } else {
                batch.update(favoritesListRef, {
                    questionIds: arrayRemove(id)
                });
                const bookmarkRef = doc(db, `users/${user.uid}/bookmarks`, id);
                batch.delete(bookmarkRef);
            }

            await batch.commit();

        } catch (error) {
            console.error("Error toggling favorite status:", error);
            setIsFavorite(!newFavoriteStatus);
        }
    }

    const handleSaveNote = async () => {
        if (!user || !id) return;
        setSavingNote(true);
        const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
        try {
            await setDoc(userQuestionDataRef, { note: note }, { merge: true });
        } catch (error) {
            console.error("Error saving note: ", error);
        } finally {
            setSavingNote(false);
        }
    }

    const findNextQuestionId = () => {
        if (!id || !metadata?.allQuestionIds) return null;
        const currentIndex = metadata.allQuestionIds.indexOf(id);
        if (currentIndex > -1 && currentIndex < metadata.allQuestionIds.length - 1) {
            return metadata.allQuestionIds[currentIndex + 1];
        }
        return null;
    };

    const findPrevQuestionId = () => {
        if (!id || !metadata?.allQuestionIds) return null;
        const currentIndex = metadata.allQuestionIds.indexOf(id);
        if (currentIndex > 0) {
            return metadata.allQuestionIds[currentIndex - 1];
        }
        return null;
    };

    const handleNext = () => {
        const nextId = findNextQuestionId();
        if (nextId) {
            router.push(`/question/${nextId}`);
        } else {
            router.push('/practice');
        }
    };
    const handlePrev = () => {
        const prevId = findPrevQuestionId();
        if (prevId) {
            router.push(`/question/${prevId}`);
        }
    };

    if (loadingData || metadataLoading || loadingAuth) {
        return <QuestionDetailSkeleton />;
    }

    if (!question) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        Question not found.
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        This question may not exist or may not be part of the selected branch.
                    </p>
                    <button
                        onClick={() => router.push('/practice')}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Back to Practice
                    </button>
                </div>
            </div>
        );
    }

    const getQuestionTypeColor = (type: string | undefined) => {
        switch (type) {
            case 'mcq': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50';
            case 'msq': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/50';
            case 'nat': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50';
        }
    };

    const cleanedQuestionHtml = extractAndCleanHtml(question.question_html, 'question_text');
    let cleanedExplanationHtml: string;
    if (question.explanation_redirect_url) {
        cleanedExplanationHtml = `<p>This explanation is provided by GateOverflow. <a href="${question.explanation_redirect_url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold inline-flex items-center gap-1">Click here to view the full discussion</a></p>`;
    } else {
        cleanedExplanationHtml = extractAndCleanHtml(question.explanation_html, 'mtq_explanation-text');
    }
    const primaryInfo = new Set([
        question.subject?.toLowerCase(),
        question.topic?.toLowerCase(),
        `gate ${question.year}`.toLowerCase(),
        question.year?.toLowerCase(),
        (question as any).branch?.toLowerCase(),
    ]);
    const otherTags = (question.tags || []).filter(tag => tag && !primaryInfo.has(tag.toLowerCase()));


    return (
        <>
            {isAuthenticated && user && id && (
                <ListsModal
                    isOpen={showListModal}
                    onClose={() => setShowListModal(false)}
                    questionId={id}
                    userId={user.uid}
                />
            )}

            <div className="min-h-screen bg-zinc-50 dark:bg-black pb-20 md:pb-8 flex flex-col">
                <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 flex-1 flex flex-col min-h-0">

                    {/* Top Navigation Bar */}
                    <div className="flex justify-between items-center mb-4 shrink-0 px-4 sm:px-8">
                        <button
                            onClick={() => router.push('/practice')}
                            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors uppercase tracking-wide"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to List
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrev}
                                disabled={!findPrevQuestionId()}
                                className="flex items-center gap-2 px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="hidden sm:inline font-medium">Previous</span>
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={!findNextQuestionId()}
                                className="flex items-center gap-2 px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <span className="hidden sm:inline font-medium">Next</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {!loadingAuth && !isAuthenticated && <div className="shrink-0 mb-4"><LoginPrompt /></div>}

                    {/* Layout Split Container */}
                    <ErrorBoundary>
                        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start">

                            {/* LEFT PANE: Header & Question Description */}
                            <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex-shrink-0 lg:sticky lg:top-6 lg:self-start">

                                {/* Header Section */}
                                <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800/50 shrink-0">
                                    <div className="flex flex-col gap-4">

                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex items-start gap-2">
                                                {metadata?.allQuestionIds && metadata.allQuestionIds.indexOf(id) !== -1 && (
                                                    <span className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white leading-tight pt-0.5 md:pt-1">
                                                        {metadata.allQuestionIds.indexOf(id) + 1}.
                                                    </span>
                                                )}
                                                <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white leading-tight pt-0.5 md:pt-1">
                                                    {question.title}
                                                </h1>
                                            </div>

                                            {/* Toolbar */}
                                            <div className="flex items-center justify-between gap-2 w-full md:w-auto bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">

                                                {/* Timer */}
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">
                                                    <TimerIcon className={`w-4 h-4 ${isTimerOn ? 'text-blue-500 animate-pulse' : 'text-zinc-400'}`} />
                                                    <span className="text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300 min-w-[3rem] text-center">
                                                        {formatTime(timeElapsed)}
                                                    </span>
                                                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                                                    <button
                                                        onClick={() => setIsTimerOn(!isTimerOn)}
                                                        disabled={submitted || !isAuthenticated}
                                                        className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                                                    >
                                                        {isTimerOn ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                                    </button>
                                                    <button
                                                        onClick={handleResetTimer}
                                                        disabled={submitted || !isAuthenticated || timeElapsed === 0}
                                                        className="p-1 hover:text-red-500 transition-colors disabled:opacity-50"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">
                                                    <button
                                                        onClick={handleToggleFavorite}
                                                        disabled={!isAuthenticated}
                                                        className={`p-1.5 rounded-md transition-all ${isFavorite
                                                            ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                                                            } disabled:opacity-50`}
                                                        title="Favorite"
                                                    >
                                                        <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                                                    </button>

                                                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

                                                    <button
                                                        onClick={() => setShowListModal(true)}
                                                        disabled={!isAuthenticated}
                                                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-all disabled:opacity-50"
                                                        title="Save to List"
                                                    >
                                                        <ListPlus className="w-4 h-4" />
                                                    </button>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${getQuestionTypeColor(question.question_type)}`}>
                                                {question.question_type || 'MCQ'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                                <BookOpen className="w-3 h-3" /> {question.subject}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                                <FolderPlus className="w-3 h-3" /> {question.topic}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                                <Calendar className="w-3 h-3" /> GATE {question.year}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                                {question.branch ? question.branch.toUpperCase() : 'GENERAL'}
                                            </span>
                                            {otherTags.map(tag => (
                                                <span key={tag} className="px-2 py-1 rounded-md text-xs text-zinc-500 dark:text-zinc-500 border border-zinc-100 dark:border-zinc-800">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                    </div>
                                </div>

                                {/* Question Content */}
                                <div className="p-5 md:p-6 flex-1 text-base lg:text-lg">
                                    <MathRenderer
                                        content={cleanedQuestionHtml}
                                        className="prose prose-zinc dark:prose-invert prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none mb-8 text-zinc-800 dark:text-zinc-200"
                                    />

                                    {question.question_image_links && question.question_image_links.length > 0 && (
                                        <div className="grid gap-6 mb-8">
                                            {question.question_image_links.map((imgUrl, index) => {
                                                const isKnownDomain = ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com', 'supabase.co'].some(domain => imgUrl.includes(domain));
                                                return (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <div key={`q-img-${index}`} className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                                        <Image
                                                            src={imgUrl}
                                                            alt={`Question illustration ${index + 1}`}
                                                            width={800}
                                                            height={600}
                                                            className="w-full h-auto mx-auto"
                                                            unoptimized={!isKnownDomain}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div> {/* End Left Pane */}

                            {/* RIGHT PANE: Options, Action Buttons & Notes */}
                            <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-6 lg:self-start">
                                <div className="p-5 md:p-6 flex-1 flex flex-col">
                                    <div className="flex-1 mb-6">
                                        {/* Options Area */}
                                        <div className="space-y-4 lg:space-y-6">

                                            {question.question_type === 'nat' ? (
                                                <div className="max-w-sm">
                                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Your Answer</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={natAnswer}
                                                            onChange={(e) => setNatAnswer(e.target.value)}
                                                            disabled={submitted || !isAuthenticated}
                                                            className="w-full pl-4 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-lg disabled:opacity-50"
                                                            placeholder="0.00"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                                                            #
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3">
                                                    {question.options.map((option, index) => {
                                                        const isSelected = question.question_type === 'msq' ? selectedOptions.includes(option.label) : selectedOptions[0] === option.label;
                                                        const isCorrectOption = option.is_correct;
                                                        const cleanedOptionHtml = extractAndCleanHtml(option.text_html, 'option_data');

                                                        let containerClass = "relative w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-start gap-4 group ";
                                                        let iconClass = "flex-shrink-0 w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors duration-200 ";

                                                        if (question.question_type === 'mcq') {
                                                            iconClass += "rounded-full ";
                                                        } else {
                                                            iconClass += "rounded-lg ";
                                                        }

                                                        if (!submitted) {
                                                            if (isSelected) {
                                                                containerClass += "bg-blue-50 dark:bg-blue-900/10 border-blue-500 shadow-sm shadow-blue-100 dark:shadow-none";
                                                                iconClass += "bg-blue-500 text-white shadow-sm";
                                                            } else {
                                                                containerClass += "bg-white dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/5";
                                                                iconClass += "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400";
                                                            }
                                                            if (isAuthenticated) containerClass += " cursor-pointer";
                                                            else containerClass += " cursor-not-allowed opacity-70";
                                                        } else {
                                                            containerClass += " cursor-default ";
                                                            if (isCorrectOption) {
                                                                containerClass += "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 shadow-sm";
                                                                iconClass += "bg-emerald-500 text-white shadow-sm";
                                                            } else if (isSelected && !isCorrectOption) {
                                                                containerClass += "bg-red-50 dark:bg-red-900/10 border-red-500 shadow-sm";
                                                                iconClass += "bg-red-500 text-white shadow-sm";
                                                            } else {
                                                                containerClass += "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-50";
                                                                iconClass += "bg-zinc-100 dark:bg-zinc-800 text-zinc-400";
                                                            }
                                                        }

                                                        return (
                                                            <button
                                                                key={option.label}
                                                                onClick={() => question.question_type === 'msq' ? handleMsqToggle(option.label) : handleMcqSelect(option.label)}
                                                                disabled={submitted || !isAuthenticated}
                                                                className={containerClass}
                                                            >
                                                                <span className={iconClass}>
                                                                    {submitted && isCorrectOption ? <CheckIcon className="w-5 h-5" /> :
                                                                        submitted && !isCorrectOption && isSelected ? <XIcon className="w-5 h-5" /> :
                                                                            (!submitted && isSelected && question.question_type === 'msq') ? <CheckIcon className="w-5 h-5" /> : (!submitted && isSelected && question.question_type === 'mcq') ? <div className="w-3 h-3 bg-white rounded-full" /> : option.label}
                                                                </span>
                                                                <MathRenderer
                                                                    content={cleanedOptionHtml}
                                                                    inline={true}
                                                                    className="flex-1 pt-1 text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert font-medium text-left"
                                                                />

                                                                {submitted && (
                                                                    <div className="absolute top-4 right-4">
                                                                        {isCorrectOption ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
                                                                            isSelected ? <XCircle className="w-5 h-5 text-red-500" /> : null}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div> {/* End specific top half of right pane */}

                                    {/* Action Buttons */}
                                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                                        {!submitted ? (
                                            <button
                                                onClick={handleSubmit}
                                                disabled={(!selectedOptions.length && (question.question_type === 'mcq' || question.question_type === 'msq')) || (question.question_type === 'nat' && !natAnswer) || loadingAuth}
                                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                                            >
                                                Submit Answer
                                            </button>
                                        ) : (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                                {/* Result Banner */}
                                                <div className={`p-4 rounded-xl flex items-start gap-4 ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50' : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50'}`}>
                                                    <div className={`p-2 rounded-full ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'}`}>
                                                        {isCorrect ? <CheckIcon className="w-6 h-6" /> : <XIcon className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <h3 className={`text-lg font-bold mb-1 ${isCorrect ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                                                            {isCorrect ? 'Correct Answer!' : 'Incorrect'}
                                                        </h3>
                                                        <p className={`text-sm ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                                            {question.question_type === 'nat' && !isCorrect && `The correct range is ${question.nat_answer_min} - ${question.nat_answer_max}`}
                                                            {question.question_type === 'mcq' && !isCorrect && `The correct option is ${question.options.find((o: Option) => o.is_correct)?.label}`}
                                                            {question.question_type === 'msq' && !isCorrect && `Correct options: ${question.options.filter((o: Option) => o.is_correct).map((o: Option) => o.label).join(', ')}`}
                                                            {isCorrect && "Great job! You nailed it."}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Explanation */}
                                                {(cleanedExplanationHtml || (question.explanation_image_links && question.explanation_image_links.length > 0)) && (
                                                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                                                        <div className="px-6 py-3 bg-zinc-100/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                                                            <BookOpen className="w-4 h-4 text-zinc-500" />
                                                            <h3 className="font-semibold text-zinc-900 dark:text-white">Explanation</h3>
                                                        </div>
                                                        <div className="p-6 overflow-x-auto">
                                                            <MathRenderer
                                                                content={cleanedExplanationHtml}
                                                                className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300"
                                                            />

                                                            {!question.explanation_redirect_url && question.explanation_image_links && question.explanation_image_links.length > 0 && (
                                                                <div className="mt-6 space-y-4">
                                                                    {question.explanation_image_links.map((imgUrl: string, index: number) => {
                                                                        const isKnownDomain = ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com', 'supabase.co'].some(domain => imgUrl.includes(domain));
                                                                        return (
                                                                            <Image
                                                                                key={`e-img-${index}`}
                                                                                src={imgUrl}
                                                                                alt={`Explanation illustration ${index + 1}`}
                                                                                width={800}
                                                                                height={600}
                                                                                className="rounded-lg border dark:border-zinc-700 w-full h-auto mx-auto"
                                                                                unoptimized={!isKnownDomain}
                                                                            />
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Control Buttons (Try Again / Next) */}
                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={handleTryAgain}
                                                        disabled={resetting}
                                                        className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                                                        Try Again
                                                    </button>
                                                    <button
                                                        onClick={handleNext}
                                                        disabled={!findNextQuestionId()}
                                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400"
                                                    >
                                                        Next Question
                                                        <ArrowRight className="w-5 h-5" />
                                                    </button>
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Notes Section Footer */}
                                <div className="bg-zinc-50 dark:bg-black/20 p-5 shrink-0 border-t border-zinc-200 dark:border-zinc-800">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4" /> Personal Notes
                                    </h3>
                                    <div className="relative">
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            disabled={!isAuthenticated}
                                            placeholder={isAuthenticated ? "Write your private notes, thoughts or doubts about this question here..." : "Login to save private notes."}
                                            className="w-full p-4 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow min-h-[120px] resize-y disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500"
                                        />
                                        <div className="absolute bottom-3 right-3">
                                            <button
                                                onClick={handleSaveNote}
                                                disabled={!isAuthenticated || savingNote}
                                                className="px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div> {/* End Right Pane */}
                        </div> {/* End Layout Split Container */}
                    </ErrorBoundary>
                </div> {/* End Max Width Container */}
            </div>
        </>

    );
}
