"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Filter, CheckCircle, Circle, ArrowDownUp, ChevronRight, RotateCcw, List, Plus, Folder, Trash2, X, Loader2, Bookmark as BookmarkIcon, Check as CheckIcon, BookOpen, Search, Sparkles } from 'lucide-react';
import { useMetadata } from '@/contexts/MetadataContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, serverTimestamp, deleteDoc, writeBatch, arrayRemove, onSnapshot, limit, startAfter, getCountFromServer, QueryConstraint, DocumentSnapshot, documentId } from 'firebase/firestore';
import { Question, Submission, QuestionList } from '@/data/mockData';
import { PracticeSkeleton } from '@/components/Skeletons';
import QuestionCard from '@/components/QuestionCard';
import TopicFilterBar from '@/components/TopicFilterBar';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 10;
const CLIENT_PAGE_SIZE = 10;

// Re-using SidebarItem as a pure component
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

// Global cache to survive unmounts (tab switching)
interface PracticeCacheData {
    pageCache: Record<number, Question[]>;
    pageCursors: Record<number, DocumentSnapshot>;
    maxReachedPage: number;
    totalQuestions: number;
    totalPages: number;
}
const globalPracticeCache: Record<string, PracticeCacheData> = {};

function PracticeContent() {
    const { user, userInfo, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading, questionCollectionPath, availableBranches, selectedBranch } = useMetadata();
    const searchParams = useSearchParams();

    // -- List Management Logic (Lifted) --
    const [lists, setLists] = useState<QuestionList[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);
    const [newListName, setNewListName] = useState("");
    const [creatingList, setCreatingList] = useState(false);
    const [showNewListInput, setShowNewListInput] = useState(false); // For Desktop Sidebar
    const [showNewListInputMobile, setShowNewListInputMobile] = useState(false); // For Mobile

    useEffect(() => {
        if (!user?.uid) {
            setLoadingLists(false);
            setLists([]);
            return;
        }
        setLoadingLists(true);
        const listsQuery = query(collection(db, `users/${user.uid}/questionLists`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
            setLists(userLists);
            setLoadingLists(false);
        }, (error) => {
            console.error(error);
            setLoadingLists(false);
        });
        return () => unsubscribe();
    }, [user?.uid]);

    const handleCreateList = async (e: React.FormEvent, isMobile: boolean = false) => {
        e.preventDefault();
        if (!user?.uid || !newListName.trim() || creatingList) return;

        setCreatingList(true);
        try {
            const newList: Omit<QuestionList, 'id' | 'createdAt'> = {
                uid: user.uid,
                name: newListName.trim(),
                questionIds: [],
                isPrivate: false,
            };
            await addDoc(collection(db, `users/${user.uid}/questionLists`), {
                ...newList,
                createdAt: serverTimestamp()
            });
            setNewListName("");
            if (isMobile) setShowNewListInputMobile(false);
            else setShowNewListInput(false);
        } catch (error) {
            console.error(error);
        } finally {
            setCreatingList(false);
        }
    };

    const handleDeleteList = async (e: React.MouseEvent, listId: string, listName: string) => {
        e.stopPropagation();
        if (!user?.uid) return;
        if (window.confirm(`Delete list "${listName}"?`)) {
            try {
                await deleteDoc(doc(db, `users/${user.uid}/questionLists`, listId));
                const batch = writeBatch(db);
                const q = query(collection(db, `users/${user.uid}/userQuestionData`), where('savedListIds', 'array-contains', listId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { savedListIds: arrayRemove(listId) });
                });
                await batch.commit();
                if (selectedListId === listId) {
                    setSelectedListId(null);
                }
            } catch (error) {
                console.error(error);
            }
        }
    };
    // ------------------------------------

    // Filter states
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
    const [topicFilter, setTopicFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>(searchParams.get('subject') || 'all');
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<string>('qIndex-asc');
    const [selectedListId, setSelectedListId] = useState<string | null>(null);

    // Mobile UI States
    const [isMobileListsOpen, setIsMobileListsOpen] = useState(false);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    // List fetching logic
    const { data: listQuestionIds } = useQuery({
        queryKey: ['listIds', selectedListId, user?.uid],
        queryFn: async () => {
            if (!selectedListId || !user) return [];
            const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, selectedListId));
            if (!listDoc.exists()) return [];
            return (listDoc.data() as QuestionList).questionIds || [];
        },
        enabled: !!selectedListId && !!user,
        staleTime: 0, // Always refetch when coming back — list may have been changed from the question page
        refetchOnWindowFocus: true,
    });

    const cacheKey = useMemo(() => {
        return JSON.stringify({
            questionCollectionPath,
            userRole: userInfo?.role,
            questionTypeFilter,
            subjectFilter,
            topicFilter,
            yearFilter,
            sortOrder,
            selectedListId,
            listQuestionIdsStr: listQuestionIds?.join(',') || ''
        });
    }, [questionCollectionPath, userInfo?.role, questionTypeFilter, subjectFilter, topicFilter, yearFilter, sortOrder, selectedListId, listQuestionIds]);

    const initialCache = globalPracticeCache[cacheKey];

    const [questions, setQuestions] = useState<Question[]>(initialCache?.pageCache[1] || []);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(initialCache?.totalPages || 1);
    const [totalQuestions, setTotalQuestions] = useState(initialCache?.totalQuestions || 0);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(!initialCache);
    
    // Ultra-Low Read Memory Caching for Pagination (Now globally backed)
    const [pageCache, setPageCache] = useState<Record<number, Question[]>>(initialCache?.pageCache || {});
    const [pageCursors, setPageCursors] = useState<Record<number, DocumentSnapshot>>(initialCache?.pageCursors || {});
    const [maxReachedPage, setMaxReachedPage] = useState(initialCache?.maxReachedPage || 1);
    const [queryError, setQueryError] = useState<string>('');

    // Sync to global cache
    useEffect(() => {
        globalPracticeCache[cacheKey] = {
            pageCache,
            pageCursors,
            maxReachedPage,
            totalQuestions,
            totalPages
        };
    }, [pageCache, pageCursors, maxReachedPage, totalQuestions, totalPages, cacheKey]);

    const fetchQuestions = async (pageToFetch = 1) => {
        if (!questionCollectionPath) return;
        if (selectedListId !== null && !listQuestionIds) return;

        try {
            setIsLoadingQuestions(true);
            setQueryError('');

            if (selectedListId !== null) {
                const ids = listQuestionIds || [];
                const total = ids.length;
                setTotalQuestions(total);
                setTotalPages(Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE)));
                
                const startIndex = (pageToFetch - 1) * CLIENT_PAGE_SIZE;
                const nextIds = ids.slice(startIndex, startIndex + CLIENT_PAGE_SIZE);

                if (nextIds.length === 0) {
                    setQuestions([]);
                } else {
                    const listConstraints: QueryConstraint[] = [where(documentId(), 'in', nextIds)];
                    const listQuery = query(collection(db, questionCollectionPath), ...listConstraints);
                    const snapshot = await getDocs(listQuery);
                    
                    // Maintain original selected order
                    const qDataUnsorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question));
                    const qData = nextIds.map(id => qDataUnsorted.find(q => q.id === id)).filter(Boolean) as Question[];

                    setQuestions(qData);
                }
            } else {
                const constraints: QueryConstraint[] = [];
                // Admin/Moderator sees all, others (including guests) see verified
                if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'moderator')) {
                    constraints.push(where('verified', '==', true));
                }

                if (questionTypeFilter !== 'all') constraints.push(where('question_type', '==', questionTypeFilter));
                if (subjectFilter !== 'all') constraints.push(where('subject', '==', subjectFilter));
                if (topicFilter !== 'all') constraints.push(where('topic', '==', topicFilter));
                if (yearFilter !== 'all') constraints.push(where('year', '==', yearFilter));

                // Cache check removed to ensure fresh data after verification

                // 1. Get exact total count for pagination first!
                const countQuery = query(collection(db, questionCollectionPath), ...constraints);
                const countSnapshot = await getCountFromServer(countQuery);
                const exactTotal = countSnapshot.data().count;
                
                setTotalQuestions(exactTotal);
                setTotalPages(Math.max(1, Math.ceil(exactTotal / CLIENT_PAGE_SIZE)));

                // 2. Query Configuration
                if (sortOrder === 'year-desc') constraints.push(orderBy('year', 'desc'));
                else if (sortOrder === 'year-asc') constraints.push(orderBy('year', 'asc'));
                else if (sortOrder === 'qIndex-desc') constraints.push(orderBy('qIndex', 'desc'));
                else constraints.push(orderBy('qIndex', 'asc'));

                // Guest limitation: if they are guest, we only let them fetch the first page
                if (!user && pageToFetch > 1) {
                    setIsLoadingQuestions(false);
                    return;
                }

                // --- Ultra-Low-Read Cursor Navigation ---
                if (pageToFetch > 1) {
                    const previousCursor = pageCursors[pageToFetch - 1];
                    if (previousCursor) {
                        constraints.push(startAfter(previousCursor));
                    } else {
                        // Failsafe: If a user somehow attempts to jump to a totally uncached page 
                        // deeper than sequential allowed (e.g. hack/edge-case).
                        console.warn("Attempted to fetch uncached page. Read minimized.");
                        setIsLoadingQuestions(false);
                        return;
                    }
                }

                constraints.push(limit(CLIENT_PAGE_SIZE));

                const finalQuery = query(collection(db, questionCollectionPath), ...constraints);
                const snapshot = await getDocs(finalQuery);

                const qData = snapshot.docs.map(document => ({ id: document.id, ...document.data() } as Question));
                
                // Store fetched data in Cache to ensure subsequent requests are 0 reads
                setQuestions(qData);
                setPageCache(prev => ({ ...prev, [pageToFetch]: qData }));
                
                if (snapshot.docs.length > 0) {
                    setPageCursors(prev => ({ ...prev, [pageToFetch]: snapshot.docs[snapshot.docs.length - 1] }));
                }
                setMaxReachedPage(prev => Math.max(prev, pageToFetch));
            }
        } catch (error: any) {
            console.error("Error fetching questions:", error);
            setQueryError(error.message || 'An error occurred fetching questions.');
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    // Auto-fetch when filters/dependencies change
    useEffect(() => {
        setQuestions([]);
        setCurrentPage(1);
        setPageCache({});
        setPageCursors({});
        setMaxReachedPage(1);
        fetchQuestions(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey]);

    const [submissions, setSubmissions] = useState<Submission[]>([]);

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

    // Derived Data
    const subjects = useMemo(() => metadata?.subjects || [], [metadata]);
    const topics = useMemo(() => metadata?.topics || [], [metadata]);
    const years = useMemo(() => metadata?.years || [], [metadata]);
    const tags = useMemo(() => metadata?.tags || [], [metadata]);
    const solvedQuestionIds = useMemo(() =>
        new Set(submissions.filter(s => s.correct).map(s => s.qid)),
        [submissions]
    );
    const incorrectQuestionIds = useMemo(() =>
        new Set(submissions.filter(s => !s.correct).map(s => s.qid)),
        [submissions]
    );



    const filteredTopics = useMemo(() => {
        if (subjectFilter === 'all') return topics;
        return metadata?.subjectTopicMap?.[subjectFilter] || [];
    }, [subjectFilter, topics, metadata]);



    // Client-side mapping is now simplified since sorting and pagination is done on the server

    const handleResetFilters = () => {
        setQuestionTypeFilter('all');
        setTopicFilter('all');
        setSubjectFilter('all');
        setYearFilter('all');
        setSortOrder('qIndex-asc');
        if (selectedListId !== null) setSelectedListId(null);
    };

    const filtersDisabled = selectedListId !== null;
    const filtersAreActive = (questionTypeFilter !== 'all' || subjectFilter !== 'all' || topicFilter !== 'all' || yearFilter !== 'all');

    if (authLoading || metadataLoading) return <PracticeSkeleton />;
    const branchName = availableBranches[selectedBranch] || 'Practice';

    // Helper: Shared render for List Items
    const renderListItems = () => (
        <>
            <SidebarItem
                label="All Questions"
                icon={<List className="w-5 h-5" />}
                isActive={selectedListId === null}
                onClick={() => setSelectedListId(null)}
            />
            <SidebarItem
                label="Favorites"
                icon={<BookmarkIcon className="w-5 h-5" />}
                isActive={selectedListId === 'favorites'}
                onClick={() => setSelectedListId('favorites')}
            />
            {loadingLists && <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto" />}
            {!loadingLists && lists.map(list => (
                list.id !== 'favorites' && (
                    <SidebarItem
                        key={list.id}
                        label={list.name}
                        icon={<Folder className="w-5 h-5" />}
                        isActive={selectedListId === list.id}
                        onClick={() => setSelectedListId(list.id)}
                        onDelete={(e) => handleDeleteList(e, list.id, list.name)}
                    />
                )
            ))}
        </>
    );

    // Helper: Shared filter UI
    const renderFilters = () => (
        <div className="flex flex-col gap-4">
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
                <div className="flex items-center gap-1 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <ArrowDownUp className="w-4 h-4 text-zinc-400" />
                    <select disabled={filtersDisabled} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-transparent dark:bg-zinc-800 dark:text-white border-none focus:ring-0 text-sm appearance-none cursor-pointer">
                        <option value="qIndex-asc">Number (Asc)</option>
                        <option value="qIndex-desc">Number (Desc)</option>
                        <option value="year-desc">Year (Newest)</option>
                        <option value="year-asc">Year (Oldest)</option>
                    </select>
                </div>
                {(filtersAreActive || sortOrder !== 'qIndex-asc') && (
                    <button onClick={handleResetFilters} className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300 rounded-md text-sm flex items-center gap-1">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors">
            {/* Page header */}
            <div className="relative pt-10 pb-5 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_70%)] rounded-full" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-1.5 relative z-10">
                    Practice Questions <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">({branchName})</span>
                </h1>
                <div className="text-gray-500 dark:text-zinc-400 text-sm relative z-10 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
                    <span>
                        {isLoadingQuestions && questions.length === 0 ? 'Loading your question bank...' : (
                            (questions.length > 0) ? (
                                <>
                                    {totalQuestions} expertly curated questions
                                    {!user && questions.length === 10 && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                                            Preview
                                        </span>
                                    )}
                                </>
                            ) : '0 questions found'
                        )}
                    </span>
                </div>
            </div>

            <div className="max-w-full mx-auto flex flex-col md:flex-row">
                {/* Desktop Sidebar */}
                <div className="hidden md:block w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-zinc-200 dark:border-zinc-800">
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
                    <nav className="flex flex-col gap-1">{renderListItems()}</nav>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">

                        {/* Mobile Collapsibles */}
                        <div className="md:hidden space-y-3 mb-6">
                            {/* My Lists Collapsible */}
                            {user?.uid && (
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                    <button
                                        onClick={() => setIsMobileListsOpen(!isMobileListsOpen)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50"
                                    >
                                        <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-white text-sm">
                                            <Folder className="w-4 h-4 text-blue-500" />
                                            <span>My Lists</span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isMobileListsOpen ? 'rotate-90' : ''}`} />
                                    </button>
                                    {isMobileListsOpen && (
                                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-xs font-medium uppercase text-zinc-500">Select List</span>
                                                <button
                                                    onClick={() => setShowNewListInputMobile(!showNewListInputMobile)}
                                                    className="p-1 rounded-md text-zinc-500 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                >
                                                    {showNewListInputMobile ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {showNewListInputMobile && (
                                                <form onSubmit={(e) => handleCreateList(e, true)} className="flex gap-2 mb-4">
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
                                                {renderListItems()}
                                            </nav>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Filters Collapsible */}
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                <button
                                    onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50"
                                >
                                    <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-white text-sm">
                                        <Filter className="w-4 h-4 text-blue-500" />
                                        <span>Filters & Search</span>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isMobileFiltersOpen ? 'rotate-90' : ''}`} />
                                </button>
                                {isMobileFiltersOpen && (
                                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                                        {renderFilters()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modern Topic Filter Bar (LeetCode Style) */}
                        <div className="mb-2">
                            <TopicFilterBar 
                                subjects={subjects}
                                topics={filteredTopics}
                                subjectCounts={metadata?.subjectCounts || {}}
                                selectedSubject={subjectFilter}
                                selectedTopic={topicFilter}
                                onSubjectChange={(s) => {
                                    setSubjectFilter(s);
                                    setTopicFilter('all'); // Reset topic when subject changes
                                }}
                                onTopicChange={setTopicFilter}
                            />
                        </div>

                        {/* Desktop Filters (Always Visible) */}
                        <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-2 shadow-sm">
                            <div className="flex items-center">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    <div className="flex items-center gap-2 mr-2">
                                        <Filter className="w-5 h-5 text-zinc-400" />
                                        <span className="font-semibold uppercase tracking-wider text-[10px]">Additional Filters</span>
                                    </div>
                                    <select disabled={filtersDisabled} value={questionTypeFilter} onChange={(e) => setQuestionTypeFilter(e.target.value)} className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-shadow">
                                        <option value="all">Any Type</option>
                                        {(metadata?.questionTypeCounts ? Object.keys(metadata.questionTypeCounts) : ['mcq', 'msq', 'nat']).map((type: string) => (
                                            <option key={type} value={type}>{type.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <select disabled={filtersDisabled} value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-shadow">
                                        <option value="all">Any Topic</option>
                                        {filteredTopics.map((topic: string) => <option key={topic} value={topic}>{topic}</option>)}
                                    </select>
                                    <select disabled={filtersDisabled} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-shadow">
                                        <option value="all">Any Year</option>
                                        {years.map((year: string) => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                    <div className="flex items-center gap-2 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-shadow focus-within:ring-2 focus-within:ring-blue-500">
                                        <ArrowDownUp className="w-4 h-4 text-zinc-400" />
                                        <select disabled={filtersDisabled} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-transparent dark:bg-zinc-800 dark:text-white border-none focus:ring-0 text-sm appearance-none cursor-pointer p-0">
                                            <option value="qIndex-asc">Number (Asc)</option>
                                            <option value="qIndex-desc">Number (Desc)</option>
                                            <option value="year-desc">Year (Newest)</option>
                                            <option value="year-asc">Year (Oldest)</option>
                                        </select>
                                    </div>

                                    {(filtersAreActive || sortOrder !== 'qIndex-asc') && (
                                        <button onClick={handleResetFilters} className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Questions List (End-to-Edge Style) */}
                        <div className="w-full">
                            {/* Desktop Column Headers (hidden on mobile) */}
                            <div className="hidden sm:flex items-center gap-4 px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold uppercase text-zinc-400 dark:text-zinc-500 text-xs">
                                <div className="w-8 flex justify-center flex-shrink-0">Status</div>
                                <div className="flex-1">Title</div>
                                <div className="w-24 text-right flex-shrink-0">Accuracy</div>
                                <div className="hidden md:block w-20 text-center flex-shrink-0">Type</div>
                                <div className="hidden lg:block w-16 text-center flex-shrink-0">Year</div>
                                <div className="hidden xl:block w-64 text-right flex-shrink-0">Topics</div>
                            </div>

                            <div className="flex flex-col">
                                {isLoadingQuestions && questions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                                        <p className="text-sm font-medium animate-pulse">Fetching questions...</p>
                                    </div>
                                ) : queryError ? (
                                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-200 dark:border-red-800/50">
                                            <span className="text-red-500 dark:text-red-400 font-bold text-2xl">!</span>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                                            Error Loading Questions
                                        </h3>
                                        <p className="text-red-500/80 dark:text-red-400/80 max-w-md mb-6 text-sm">
                                            {queryError}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500">You may need to build Firestore indexes.</p>
                                    </div>
                                ) : questions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800/80 rounded-full flex items-center justify-center mb-6 shadow-inner border border-zinc-200/50 dark:border-zinc-700/50">
                                            <Search className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                                            No Questions Found
                                        </h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mb-6 text-sm">
                                            We couldn't find any questions matching your current filters. Try adjusting your subject or topic.
                                        </p>
                                        <button 
                                            onClick={handleResetFilters} 
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 text-sm flex items-center gap-2"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Clear Filters
                                        </button>
                                    </div>
                                ) : (
                                    questions.map((q) => {
                                        let status: 'correct' | 'incorrect' | 'unattempted' = 'unattempted';
                                        if (solvedQuestionIds.has(q.id)) status = 'correct';
                                        else if (incorrectQuestionIds.has(q.id)) status = 'incorrect';
                                        
                                        return (
                                            <QuestionCard
                                                key={q.id}
                                                question={q}
                                                submissionStatus={status}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Numbered Pagination UI */}
                        {totalPages > 1 && (
                            <div className="mt-6 sm:mt-8 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const newPage = Math.max(1, currentPage - 1);
                                            setCurrentPage(newPage);
                                            fetchQuestions(newPage);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        disabled={currentPage === 1 || isLoadingQuestions}
                                        className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-300"
                                    >
                                        Prev
                                    </button>
                                    
                                    <div className="flex items-center gap-1 overflow-x-auto px-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                            // Show first, last, current, and +/- 1 neighbors
                                            if (
                                                page === 1 || 
                                                page === totalPages || 
                                                (page >= currentPage - 1 && page <= currentPage + 1)
                                            ) {
                                                // Page is reachable if it's cached or it's the immediate next page after the furthest we've gone
                                                // For list/favorites mode, all pages are always reachable (selectedListId !== null)
                                                const isReachable = selectedListId !== null || page <= maxReachedPage + 1;
                                                
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => {
                                                            if (!isReachable) return;
                                                            setCurrentPage(page);
                                                            fetchQuestions(page);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        disabled={isLoadingQuestions || !isReachable}
                                                        title={!isReachable ? "Please visit the previous page first to minimize database reads." : ""}
                                                        className={`w-8 h-8 rounded border flex items-center justify-center text-sm font-medium transition-colors ${!isReachable
                                                            ? 'opacity-40 cursor-not-allowed border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                                                            : currentPage === page 
                                                                ? 'bg-blue-600 border-blue-600 text-white' 
                                                                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            }
                                            // Show ellipsis for gaps
                                            if (page === currentPage - 2 || page === currentPage + 2) {
                                                return <span key={page} className="text-zinc-400 px-1">...</span>;
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        onClick={() => {
                                            const newPage = Math.min(totalPages, currentPage + 1);
                                            setCurrentPage(newPage);
                                            fetchQuestions(newPage);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        disabled={currentPage === totalPages || isLoadingQuestions}
                                        className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-300"
                                    >
                                        Next
                                    </button>
                                </div>
                                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Showing page {currentPage} of {totalPages} ({totalQuestions} total questions)
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Wrapper for Suspense (required for useSearchParams)
export default function Practice() {
    return (
        <Suspense fallback={<PracticeSkeleton />}>
            <PracticeContent />
        </Suspense>
    );
}
