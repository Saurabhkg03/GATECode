"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, CheckCircle, Circle, ArrowDownUp, ChevronLeft, ChevronRight, RotateCcw, List, Plus, Folder, Trash2, X, Loader2, Bookmark as BookmarkIcon, Check as CheckIcon, Edit } from 'lucide-react';
import { useMetadata } from '@/contexts/MetadataContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentSnapshot, endBefore, limitToLast, doc, getDoc, documentId, addDoc, serverTimestamp, deleteDoc, writeBatch, arrayRemove, onSnapshot, Query, DocumentData } from 'firebase/firestore';
import { Question, Submission, QuestionList } from '@/data/mockData';
import { PracticeSkeleton } from '@/components/Skeletons';
import { useQueryCache } from '@/contexts/QueryCacheContext';

const PAGE_SIZE = 10;
const CLIENT_PAGE_SIZE = 10;

const QuestionListsSidebar = ({
    selectedListId,
    onSelectList,
    userId
}: {
    selectedListId: string | null;
    onSelectList: (listId: string | null) => void;
    userId: string | null;
}) => {
    const [lists, setLists] = useState<QuestionList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewListInput, setShowNewListInput] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [creatingList, setCreatingList] = useState(false);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            setLists([]);
            return;
        }

        setLoading(true);
        const listsQuery = query(collection(db, `users/${userId}/questionLists`), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
            setLists(userLists);
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };

    }, [userId]);

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !newListName.trim() || creatingList) return;

        setCreatingList(true);
        try {
            const newList: Omit<QuestionList, 'id' | 'createdAt'> = {
                uid: userId,
                name: newListName.trim(),
                questionIds: [],
                isPrivate: false,
            };

            await addDoc(collection(db, `users/${userId}/questionLists`), {
                ...newList,
                createdAt: serverTimestamp()
            });

            setNewListName("");
            setShowNewListInput(false);
        } catch (error) {
            console.error(error);
        } finally {
            setCreatingList(false);
        }
    };

    const handleDeleteList = async (e: React.MouseEvent, listId: string, listName: string) => {
        e.stopPropagation();
        if (!userId) return;

        if (window.confirm(`Delete list "${listName}"?`)) {
            try {
                await deleteDoc(doc(db, `users/${userId}/questionLists`, listId));
                const batch = writeBatch(db);
                const q = query(collection(db, `users/${userId}/userQuestionData`), where('savedListIds', 'array-contains', listId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.update(doc.ref, {
                        savedListIds: arrayRemove(listId)
                    });
                });
                await batch.commit();

                if (selectedListId === listId) {
                    onSelectList(null);
                }
            } catch (error) {
                console.error(error);
            }
        }
    };

    if (!userId) {
        return (
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    <Link href="/login" className="text-blue-500 hover:underline">Log in</Link> to create lists.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">My Lists</h2>
                <button
                    onClick={() => setShowNewListInput(!showNewListInput)}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                    {showNewListInput ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
            </div>

            {showNewListInput && (
                <form onSubmit={handleCreateList} className="flex gap-2 mb-2">
                    <input
                        type="text"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        placeholder="New list name..."
                        className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                    />
                    <button type="submit" disabled={creatingList || !newListName.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-zinc-400">
                        {creatingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                    </button>
                </form>
            )}

            <nav className="flex flex-col gap-1">
                <SidebarItem
                    label="All Questions"
                    icon={<List className="w-5 h-5" />}
                    isActive={selectedListId === null}
                    onClick={() => onSelectList(null)}
                />
                <SidebarItem
                    label="Favorites"
                    icon={<BookmarkIcon className="w-5 h-5" />}
                    isActive={selectedListId === 'favorites'}
                    onClick={() => onSelectList('favorites')}
                />

                {loading && <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto" />}

                {!loading && lists.map(list => (
                    list.id !== 'favorites' && (
                        <SidebarItem
                            key={list.id}
                            label={list.name}
                            icon={<Folder className="w-5 h-5" />}
                            isActive={selectedListId === list.id}
                            onClick={() => onSelectList(list.id)}
                            onDelete={(e) => handleDeleteList(e, list.id, list.name)}
                        />
                    )
                ))}
            </nav>
        </div>
    );
};

const SidebarItem = ({ label, icon, isActive, onClick, onDelete }: {
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void,
    onDelete?: (e: React.MouseEvent) => void
}) => (
    <button
        onClick={onClick}
        className={`group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
    >
        <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
        </div>
        {onDelete && (
            <span
                onClick={onDelete}
                className="flex-shrink-0 p-1 rounded-md text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Trash2 className="w-4 h-4" />
            </span>
        )}
    </button>
);

function PracticeContent() {
    const { user, userInfo, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading, questionCollectionPath, availableBranches, selectedBranch } = useMetadata();
    const { getCachedData, setCachedData, getPersistentState, setPersistentState } = useQueryCache();

    const searchParams = useSearchParams();
    const router = useRouter();

    const CACHE_KEY = `practice_questions_${selectedBranch}`;

    const [searchQuery, setSearchQuery] = useState(() => getPersistentState(`${CACHE_KEY}_search`) || '');
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>(() => getPersistentState(`${CACHE_KEY}_type`) || 'all');
    const [topicFilter, setTopicFilter] = useState<string>(() => getPersistentState(`${CACHE_KEY}_topic`) || 'all');
    const [subjectFilter, setSubjectFilter] = useState<string>(() => getPersistentState(`${CACHE_KEY}_subject`) || searchParams.get('subject') || 'all');
    const [yearFilter, setYearFilter] = useState<string>(() => getPersistentState(`${CACHE_KEY}_year`) || 'all');
    const [tagFilter, setTagFilter] = useState<string>(() => getPersistentState(`${CACHE_KEY}_tag`) || 'all');
    const [sortOrder, setSortOrder] = useState<string>(() => getPersistentState(`${CACHE_KEY}_sort`) || 'qIndex-asc');

    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [listQuestionIds, setListQuestionIds] = useState<string[]>([]);

    const [questions, setQuestions] = useState<Question[]>(() => getCachedData<Question[]>(CACHE_KEY) || []);
    const [listQuestions, setListQuestions] = useState<Question[]>([]);

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingData, setLoadingData] = useState(() => !getCachedData(CACHE_KEY));
    const [loadingMore, setLoadingMore] = useState(false);
    const [queryError, setQueryError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
    const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const subjects = useMemo(() => metadata?.subjects || [], [metadata]);
    const topics = useMemo(() => metadata?.topics || [], [metadata]);
    const years = useMemo(() => metadata?.years || [], [metadata]);
    const tags = useMemo(() => metadata?.tags || [], [metadata]);
    const baseTotalQuestions = useMemo(() => metadata?.questionCount || 0, [metadata]);

    useEffect(() => {
        setPersistentState(`${CACHE_KEY}_search`, searchQuery);
        setPersistentState(`${CACHE_KEY}_type`, questionTypeFilter);
        setPersistentState(`${CACHE_KEY}_topic`, topicFilter);
        setPersistentState(`${CACHE_KEY}_subject`, subjectFilter);
        setPersistentState(`${CACHE_KEY}_year`, yearFilter);
        setPersistentState(`${CACHE_KEY}_tag`, tagFilter);
        setPersistentState(`${CACHE_KEY}_sort`, sortOrder);
    }, [searchQuery, questionTypeFilter, topicFilter, subjectFilter, yearFilter, tagFilter, sortOrder, CACHE_KEY, setPersistentState]);

    const isAuthenticated = !!user && !!userInfo;
    const filtersDisabled = selectedListId !== null;

    const filtersAreActive = useMemo(() => {
        return (
            questionTypeFilter !== 'all' ||
            subjectFilter !== 'all' ||
            topicFilter !== 'all' ||
            yearFilter !== 'all' ||
            tagFilter !== 'all'
        );
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter]);

    const listMode = selectedListId !== null;

    const fetchPaginatedQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
        if (!metadata) {
            setLoadingData(true);
            return;
        }

        if (direction === 'first') setLoadingData(true);
        else setLoadingMore(true);
        setQueryError('');
        setListQuestions([]);
        setListQuestionIds([]);

        try {
            let q: Query<DocumentData, DocumentData> = query(collection(db, questionCollectionPath));

            let baseFilters: any[] = [];
            if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                baseFilters.push(where("verified", "==", true));
            }

            if (tagFilter !== 'all') {
                baseFilters.push(where('tags', 'array-contains', tagFilter));
            } else {
                if (questionTypeFilter !== 'all') baseFilters.push(where('question_type', '==', questionTypeFilter));
                if (subjectFilter !== 'all') baseFilters.push(where('subject', '==', subjectFilter));
                if (topicFilter !== 'all') baseFilters.push(where('topic', '==', topicFilter));
                if (yearFilter !== 'all') baseFilters.push(where('year', '==', yearFilter));
            }

            if (baseFilters.length > 0) {
                q = query(q, ...baseFilters);
            }

            if (direction === 'first') {
                setTotalQuestions(baseTotalQuestions);
            }

            switch (sortOrder) {
                case 'year-desc': q = query(q, orderBy('year', 'desc')); break;
                case 'year-asc': q = query(q, orderBy('year', 'asc')); break;
                case 'qIndex-desc': q = query(q, orderBy('qIndex', 'desc')); break;
                case 'qIndex-asc':
                default:
                    q = query(q, orderBy('qIndex', 'asc'));
                    break;
            }

            if (direction === 'next' && lastVisible) q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
            else if (direction === 'prev' && firstVisible) q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
            else q = query(q, limit(PAGE_SIZE));

            const documentSnapshots = await getDocs(q);

            const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            const finalQuestions = direction === 'prev' ? questionsData.reverse() : questionsData;
            setQuestions(finalQuestions);
            setCachedData(CACHE_KEY, finalQuestions);

            if (documentSnapshots.docs.length > 0) {
                if (direction === 'prev') {
                    setFirstVisible(documentSnapshots.docs[0]);
                    setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
                } else {
                    setFirstVisible(documentSnapshots.docs[0]);
                    setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
                }
            } else if (direction !== 'prev') {
                setFirstVisible(null);
                setLastVisible(null);
            }
            setCurrentPage(page);
        } catch (error: any) {
            console.error(error);
            setQueryError('Failed to load questions.');
            setQuestions([]); setTotalQuestions(0); setFirstVisible(null); setLastVisible(null);
        } finally {
            setLoadingData(false);
            setLoadingMore(false);
        }
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, lastVisible, firstVisible, baseTotalQuestions, metadata, selectedBranch, questionCollectionPath, CACHE_KEY, getCachedData, setCachedData]);

    useEffect(() => {
        const fetchListIds = async () => {
            if (!isAuthenticated || !user) {
                setListQuestionIds([]);
                setListQuestions([]);
                return;
            }

            if (selectedListId === null) {
                setListQuestionIds([]);
                setListQuestions([]);
                return;
            }

            setLoadingData(true);
            setQueryError('');
            setQuestions([]);
            setListQuestions([]);

            try {
                let questionIds: string[] = [];
                if (selectedListId === 'favorites') {
                    const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, 'favorites'));
                    if (listDoc.exists()) {
                        questionIds = (listDoc.data() as QuestionList).questionIds || [];
                    }
                } else {
                    const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, selectedListId));
                    if (listDoc.exists()) {
                        questionIds = (listDoc.data() as QuestionList).questionIds || [];
                    }
                }

                setListQuestionIds(questionIds);
                setTotalQuestions(questionIds.length);
                setCurrentPage(1);

            } catch (error) {
                console.error(error);
                setQueryError("Failed to load list.");
            }
        };

        if (!metadataLoading) {
            fetchListIds();
        }
    }, [selectedListId, isAuthenticated, user, metadataLoading, selectedBranch]);

    useEffect(() => {
        const fetchQuestionsForCurrentPage = async () => {
            if (!listMode || listQuestionIds.length === 0) {
                setListQuestions([]);
                if (listMode) setLoadingData(false);
                return;
            }

            if (metadataLoading || !questionCollectionPath) {
                setLoadingData(true);
                return;
            }

            setLoadingData(true);
            setQueryError('');

            try {
                const startIndex = (currentPage - 1) * CLIENT_PAGE_SIZE;
                const endIndex = startIndex + CLIENT_PAGE_SIZE;
                const idsToFetch = listQuestionIds.slice(startIndex, endIndex);

                if (idsToFetch.length === 0) {
                    setListQuestions([]);
                    setLoadingData(false);
                    return;
                }

                const questionData: Question[] = [];
                const chunks: string[][] = [];
                for (let i = 0; i < idsToFetch.length; i += 30) {
                    chunks.push(idsToFetch.slice(i, i + 30));
                }

                for (const chunk of chunks) {
                    if (chunk.length === 0) continue;

                    let qQuery = query(collection(db, questionCollectionPath), where(documentId(), 'in', chunk));
                    if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                        qQuery = query(qQuery, where("verified", "==", true));
                    }
                    const qSnapshot = await getDocs(qQuery);

                    const fetchedMap = new Map<string, Question>();
                    qSnapshot.forEach(doc => {
                        fetchedMap.set(doc.id, { id: doc.id, ...doc.data() } as Question);
                    });

                    chunk.forEach(id => {
                        if (fetchedMap.has(id)) {
                            questionData.push(fetchedMap.get(id)!);
                        }
                    });
                }

                setListQuestions(questionData);

            } catch (error) {
                console.error(error);
                setQueryError("Error loading list page.");
            } finally {
                setLoadingData(false);
            }
        };

        fetchQuestionsForCurrentPage();
    }, [currentPage, listQuestionIds, listMode, userInfo?.role, metadataLoading, questionCollectionPath]);

    useEffect(() => {
        if (selectedListId === null && !metadataLoading) {
            setLastVisible(null);
            setFirstVisible(null);
            fetchPaginatedQuestions(1, 'first');
        }
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, selectedBranch, metadataLoading, selectedListId]);

    useEffect(() => {
        if (user) {
            const subsCollection = collection(db, `users/${user.uid}/submissions`);
            const unsubscribe = onSnapshot(subsCollection, (snapshot) => {
                const subsData = snapshot.docs.map(doc => doc.data() as Submission);
                setSubmissions(subsData);
            }, (error) => console.error(error));
            return () => unsubscribe();
        } else {
            setSubmissions([]);
        }
    }, [user]);

    useEffect(() => {
        const subject = searchParams.get('subject');
        if (subject && subject !== subjectFilter) {
            setSelectedListId(null);
            setSubjectFilter(subject);
        }
    }, [searchParams, subjectFilter]);

    const handleNextPage = () => {
        const hasMore = filtersAreActive
            ? lastVisible
            : (totalQuestions > 0 && (currentPage * PAGE_SIZE < totalQuestions));

        if (!loadingMore && hasMore && lastVisible) {
            fetchPaginatedQuestions(currentPage + 1, 'next');
        }
    };
    const handlePrevPage = () => {
        if (!loadingMore && firstVisible && currentPage > 1) {
            fetchPaginatedQuestions(currentPage - 1, 'prev');
        }
    };

    const handleClientNextPage = () => {
        const totalPages = Math.max(1, Math.ceil(totalQuestions / CLIENT_PAGE_SIZE));
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };
    const handleClientPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setQuestionTypeFilter('all');
        setTopicFilter('all');
        setSubjectFilter('all');
        setYearFilter('all');
        setTagFilter('all');
        setSortOrder('qIndex-asc');
        if (selectedListId !== null) {
            setSelectedListId(null);
        }
    };

    const solvedQuestionIds = useMemo(() =>
        new Set(submissions.filter(s => s.correct).map(s => s.qid)),
        [submissions]
    );

    const clientFilteredQuestions = useMemo(() => {
        let questionsToFilter = [...listQuestions];

        if (questionTypeFilter !== 'all') {
            questionsToFilter = questionsToFilter.filter(q => q.question_type === questionTypeFilter);
        }
        if (subjectFilter !== 'all') {
            questionsToFilter = questionsToFilter.filter(q => q.subject === subjectFilter);
        }
        if (topicFilter !== 'all') {
            questionsToFilter = questionsToFilter.filter(q => q.topic === topicFilter);
        }
        if (yearFilter !== 'all') {
            questionsToFilter = questionsToFilter.filter(q => q.year === yearFilter);
        }
        if (tagFilter !== 'all') {
            questionsToFilter = questionsToFilter.filter(q => q.tags?.includes(tagFilter));
        }

        questionsToFilter.sort((a, b) => {
            const aIndex = a.qIndex || 0;
            const bIndex = b.qIndex || 0;
            switch (sortOrder) {
                case 'year-desc': return (b.year || '').localeCompare(a.year || '');
                case 'year-asc': return (a.year || '').localeCompare(b.year || '');
                case 'qIndex-desc': return bIndex - aIndex;
                case 'qIndex-asc':
                default:
                    return aIndex - bIndex;
            }
        });

        if (!searchQuery) return questionsToFilter;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return questionsToFilter.filter(q =>
            q.id?.toLowerCase().includes(lowerCaseQuery) ||
            q.topic?.toLowerCase().includes(lowerCaseQuery) ||
            q.subject?.toLowerCase().includes(lowerCaseQuery) ||
            q.title?.toLowerCase().includes(lowerCaseQuery) ||
            q.qIndex?.toString().includes(lowerCaseQuery)
        );
    }, [listQuestions, sortOrder, searchQuery, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter]);

    const serverPagedAndFilteredQuestions = useMemo(() => {
        if (!searchQuery) return questions;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return questions.filter(q =>
            q.id?.toLowerCase().includes(lowerCaseQuery) ||
            q.topic?.toLowerCase().includes(lowerCaseQuery) ||
            q.subject?.toLowerCase().includes(lowerCaseQuery) ||
            q.title?.toLowerCase().includes(lowerCaseQuery) ||
            q.qIndex?.toString().includes(lowerCaseQuery)
        );
    }, [searchQuery, questions]);

    const questionsToDisplay = useMemo(() => {
        if (selectedListId !== null) {
            return clientFilteredQuestions;
        }
        return serverPagedAndFilteredQuestions;
    }, [selectedListId, clientFilteredQuestions, serverPagedAndFilteredQuestions]);


    const getQuestionTypeColor = (type: string | undefined) => {
        switch (type) {
            case 'mcq': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50';
            case 'msq': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50';
            case 'nat': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
        }
    };

    const totalPages = Math.max(
        1,
        Math.ceil(
            (listMode)
                ? totalQuestions / CLIENT_PAGE_SIZE
                : baseTotalQuestions / PAGE_SIZE
        )
    );

    if (authLoading || metadataLoading) {
        return <PracticeSkeleton />;
    }

    const branchName = availableBranches[selectedBranch] || 'Practice';

    return (
        <div className="min-h-screen">
            <div className="max-w-full mx-auto flex flex-col md:flex-row">

                <QuestionListsSidebar
                    selectedListId={selectedListId}
                    onSelectList={(listId) => {
                        setSelectedListId(listId);
                    }}
                    userId={user?.uid || null}
                />

                <div className="flex-1 min-w-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                                Practice Questions ({branchName})
                            </h1>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {loadingData ? 'Loading...' : (
                                    (totalQuestions > 0 || listMode) && !queryError
                                        ? listMode
                                            ? `Showing ${(currentPage - 1) * CLIENT_PAGE_SIZE + 1}-${Math.min(currentPage * CLIENT_PAGE_SIZE, totalQuestions)} of ${totalQuestions} questions in this list`
                                            : (filtersAreActive && totalQuestions === baseTotalQuestions && questionsToDisplay.length === 0)
                                                ? `Searching questions...`
                                                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${(currentPage - 1) * PAGE_SIZE + questionsToDisplay.length} of ${filtersAreActive ? '~' : ''}${baseTotalQuestions} questions`
                                        : queryError ? 'Error loading questions' : '0 questions found'
                                )}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 mb-6 shadow-sm">
                            <div className="flex flex-col gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search by number, title, subject..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <Filter className="w-5 h-5 text-zinc-400 flex-shrink-0 hidden sm:inline-block" />

                                    <select disabled={filtersDisabled} value={questionTypeFilter} onChange={(e) => setQuestionTypeFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <option value="all">Type</option>
                                        {(metadata?.questionTypeCounts ? Object.keys(metadata.questionTypeCounts) : ['mcq', 'msq', 'nat']).map((type: string) => (
                                            <option key={type} value={type}>{type.toUpperCase()}</option>
                                        ))}
                                    </select>

                                    <select disabled={filtersDisabled} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <option value="all">Subject</option>
                                        {subjects.map((subject: string) => <option key={subject} value={subject}>{subject}</option>)}
                                    </select>

                                    <select disabled={filtersDisabled} value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <option value="all">Topic</option>
                                        {topics.map((topic: string) => <option key={topic} value={topic}>{topic}</option>)}
                                    </select>

                                    <select disabled={filtersDisabled} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <option value="all">Year</option>
                                        {years.map((year: string) => <option key={year} value={year}>{year}</option>)}
                                    </select>

                                    <select disabled={filtersDisabled} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <option value="all">Tag</option>
                                        {tags.map((tag: string) => <option key={tag} value={tag}>{tag}</option>)}
                                    </select>

                                    <div className="flex items-center gap-1 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                                        <ArrowDownUp className="w-4 h-4 text-zinc-400" />
                                        <select disabled={filtersDisabled} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm appearance-none cursor-pointer">
                                            <option value="qIndex-asc">Number (Asc)</option>
                                            <option value="qIndex-desc">Number (Desc)</option>
                                            <option value="year-desc">Year (Newest)</option>
                                            <option value="year-asc">Year (Oldest)</option>
                                        </select>
                                    </div>

                                    {(filtersAreActive || sortOrder !== 'qIndex-asc' || searchQuery) && (
                                        <button
                                            onClick={handleResetFilters}
                                            className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md text-sm flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {queryError && (
                            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3">
                                <Circle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <p className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap">{queryError}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {questionsToDisplay.map((q) => (
                                <Link
                                    key={q.id}
                                    href={`/question/${q.id}`}
                                    className="block group"
                                >
                                    <div className={`bg-white dark:bg-zinc-900 rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${solvedQuestionIds.has(q.id)
                                        ? 'border-green-200 dark:border-green-900/30 bg-green-50/10 dark:bg-green-900/5'
                                        : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500'
                                        }`}>
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 pt-1">
                                                {solvedQuestionIds.has(q.id) ? (
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                ) : (
                                                    <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                        #{q.qIndex ?? '???'}
                                                    </span>
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getQuestionTypeColor(q.question_type)}`}>
                                                        {q.question_type}
                                                    </span>
                                                    {q.year && (
                                                        <span className="text-[10px] font-semibold text-zinc-500 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">
                                                            {q.year}
                                                        </span>
                                                    )}
                                                    {q.tags && q.tags.map((tag: string, idx: number) => (
                                                        <span key={idx} className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded hidden sm:inline-block">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <h3 className="font-medium text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                                    {q.title || "Untitled Question"}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                                                        {q.subject}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[150px]">
                                                        {q.topic}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 self-center">
                                                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-8 flex items-center justify-between">
                            {listMode ? (
                                <>
                                    <button
                                        onClick={handleClientPrevPage}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Previous
                                    </button>

                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Page {currentPage} of {totalPages}
                                    </span>

                                    <button
                                        onClick={handleClientNextPage}
                                        disabled={currentPage === totalPages || questionsToDisplay.length < CLIENT_PAGE_SIZE}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                                    >
                                        Next <ChevronRight className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1 || loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                                    >
                                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronLeft className="w-4 h-4" />} Previous
                                    </button>

                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Page {currentPage}
                                    </span>

                                    <button
                                        onClick={handleNextPage}
                                        disabled={loadingMore || (filtersAreActive ? !lastVisible : (currentPage * PAGE_SIZE >= totalQuestions))}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                                    >
                                        Next {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Practice() {
    return (
        <Suspense fallback={<PracticeSkeleton />}>
            <PracticeContent />
        </Suspense>
    );
}
