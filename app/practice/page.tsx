"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, CheckCircle, Circle, ArrowDownUp, ChevronRight, RotateCcw, List, Plus, Folder, Trash2, X, Loader2, Bookmark as BookmarkIcon, Check as CheckIcon } from 'lucide-react';
import { useMetadata } from '@/contexts/MetadataContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, serverTimestamp, deleteDoc, writeBatch, arrayRemove, onSnapshot, limit, startAfter } from 'firebase/firestore';
import { Question, Submission, QuestionList } from '@/data/mockData';
import { PracticeSkeleton } from '@/components/Skeletons';
import QuestionCard from '@/components/QuestionCard';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
    const [topicFilter, setTopicFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>(searchParams.get('subject') || 'all');
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<string>('qIndex-asc');
    const [selectedListId, setSelectedListId] = useState<string | null>(null);

    // Mobile UI States
    const [isMobileListsOpen, setIsMobileListsOpen] = useState(false);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    // Fetch questions using React Query
    const { data: allQuestions = [], isLoading: isLoadingQuestions } = useQuery({
        queryKey: ['allQuestions', questionCollectionPath, user?.uid],
        queryFn: async () => {
            if (!questionCollectionPath) return [];
            let q;
            if (user) {
                q = query(collection(db, questionCollectionPath));
            } else {
                q = query(collection(db, questionCollectionPath), limit(10));
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        },
        enabled: !!questionCollectionPath,
        staleTime: 1000 * 60 * 5,
    });

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

    // List fetching logic
    const { data: listQuestionIds } = useQuery({
        queryKey: ['listIds', selectedListId, user?.uid],
        queryFn: async () => {
            if (!selectedListId || !user) return [];
            if (selectedListId === 'favorites') {
                const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, 'favorites'));
                return listDoc.exists() ? (listDoc.data() as QuestionList).questionIds || [] : [];
            } else {
                const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, selectedListId));
                return listDoc.exists() ? (listDoc.data() as QuestionList).questionIds || [] : [];
            }
        },
        enabled: !!selectedListId && !!user,
    });

    // Filtering Logic
    const filteredQuestions = useMemo(() => {
        let qs = [...allQuestions];
        if (userInfo && userInfo.role !== 'admin' && userInfo.role !== 'moderator') {
            qs = qs.filter(q => q.verified);
        }
        if (selectedListId !== null) {
            if (!listQuestionIds) return [];
            const idsSet = new Set(listQuestionIds);
            qs = qs.filter(q => idsSet.has(q.id));
        }
        if (questionTypeFilter !== 'all') qs = qs.filter(q => q.question_type === questionTypeFilter);
        if (subjectFilter !== 'all') qs = qs.filter(q => q.subject === subjectFilter);
        if (topicFilter !== 'all') qs = qs.filter(q => q.topic === topicFilter);
        if (yearFilter !== 'all') qs = qs.filter(q => q.year === yearFilter);
        if (tagFilter !== 'all') qs = qs.filter(q => q.tags?.includes(tagFilter));
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            qs = qs.filter(q =>
                q.id?.toLowerCase().includes(lower) ||
                q.topic?.toLowerCase().includes(lower) ||
                q.subject?.toLowerCase().includes(lower) ||
                q.title?.toLowerCase().includes(lower) ||
                q.qIndex?.toString().includes(lower)
            );
        }
        qs.sort((a, b) => {
            const aIndex = a.qIndex || 0;
            const bIndex = b.qIndex || 0;
            switch (sortOrder) {
                case 'year-desc': return (b.year || '').localeCompare(a.year || '');
                case 'year-asc': return (a.year || '').localeCompare(b.year || '');
                case 'qIndex-desc': return bIndex - aIndex;
                case 'qIndex-asc': default: return aIndex - bIndex;
            }
        });
        return qs;
    }, [allQuestions, userInfo, selectedListId, listQuestionIds, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, searchQuery, sortOrder]);

    // Client-side Pagination
    const [currentPage, setCurrentPage] = useState(1);
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, questionTypeFilter, topicFilter, subjectFilter, yearFilter, tagFilter, selectedListId]);

    const totalQuestions = filteredQuestions.length;
    const paginatedQuestions = useMemo(() => {
        const start = (currentPage - 1) * CLIENT_PAGE_SIZE;
        return filteredQuestions.slice(start, start + CLIENT_PAGE_SIZE);
    }, [filteredQuestions, currentPage]);

    const totalPages = Math.ceil(totalQuestions / CLIENT_PAGE_SIZE);

    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

    const handleResetFilters = () => {
        setSearchQuery('');
        setQuestionTypeFilter('all');
        setTopicFilter('all');
        setSubjectFilter('all');
        setYearFilter('all');
        setTagFilter('all');
        setSortOrder('qIndex-asc');
        if (selectedListId !== null) setSelectedListId(null);
    };

    const filtersDisabled = selectedListId !== null;
    const filtersAreActive = (questionTypeFilter !== 'all' || subjectFilter !== 'all' || topicFilter !== 'all' || yearFilter !== 'all' || tagFilter !== 'all' || searchQuery !== '');

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
                    <button onClick={handleResetFilters} className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md text-sm flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen">
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
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                                Practice Questions ({branchName})
                            </h1>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {isLoadingQuestions ? 'Loading...' : (
                                    (totalQuestions > 0)
                                        ? (
                                            <>
                                                Showing {(currentPage - 1) * CLIENT_PAGE_SIZE + 1}-{Math.min(currentPage * CLIENT_PAGE_SIZE, totalQuestions)} of {totalQuestions} questions
                                                {!user && totalQuestions === 10 && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                        Preview Mode
                                                    </span>
                                                )}
                                            </>
                                        )
                                        : '0 questions found'
                                )}
                            </p>
                        </div>

                        {/* Mobile Collapsibles */}
                        <div className="md:hidden space-y-3 mb-6">
                            {/* My Lists Collapsible */}
                            {user?.uid && (
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                                    <button
                                        onClick={() => setIsMobileListsOpen(!isMobileListsOpen)}
                                        className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50"
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
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                                <button
                                    onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                                    className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50"
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

                        {/* Desktop Filters (Always Visible) */}
                        <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6 shadow-sm">
                            {renderFilters()}
                        </div>

                        {/* Questions Grid */}
                        <div className="grid grid-cols-1 gap-4">
                            {isLoadingQuestions ? (
                                <div className="text-center py-20 text-zinc-500">Loading questions...</div>
                            ) : paginatedQuestions.length === 0 ? (
                                <div className="text-center py-20 text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                                    No questions match your filters.
                                </div>
                            ) : (
                                paginatedQuestions.map((q) => (
                                    <QuestionCard
                                        key={q.id}
                                        question={q}
                                        isSolved={solvedQuestionIds.has(q.id)}
                                    />
                                ))
                            )}
                        </div>

                        <div className="mt-8 flex items-center justify-between">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || isLoadingQuestions}
                                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                Page {currentPage} of {totalPages || 1}
                            </span>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || totalPages === 0 || isLoadingQuestions}
                                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
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
