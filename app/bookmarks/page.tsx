"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, doc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { Loader2, Star, Trash2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';
import ImageZoom from '@/components/ui/ImageZoom';
import Link from 'next/link';

export default function BookmarksPage() {
    const { user, loading } = useAuth();
    const [bookmarks, setBookmarks] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!user) return;

        const fetchBookmarks = async () => {
            try {
                const q = query(collection(db, 'users', user.uid, 'bookmarks'), orderBy('bookmarkedAt', 'desc'));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
                setBookmarks(data);
            } catch (err) {
                console.error("Error fetching bookmarks:", err);
            } finally {
                setFetching(false);
            }
        };
        fetchBookmarks();
    }, [user]);

    const toggleExpand = (id: string) => {
        setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const removeBookmark = async (id: string) => {
        if (!user) return;
        if (!window.confirm("Remove this question from your bookmarks?")) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', id));
            setBookmarks(prev => prev.filter(b => b.docId !== id));
        } catch (e) {
            console.error("Error removing bookmark:", e);
        }
    };

    if (loading || fetching) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 dark:bg-zinc-950">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
                    <p className="text-gray-500 font-medium">Loading your saved questions...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
                <h1 className="text-2xl font-bold mb-4">You need to log in!</h1>
                <p className="text-gray-600 mb-6">Please log in to view and save bookmarked questions.</p>
                <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Go to Login
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-4 sm:p-8 font-sans pb-20">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                        <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Questions</h1>
                        <p className="text-sm text-gray-500 mt-1">Review questions you've bookmarked across all contests.</p>
                    </div>
                </div>

                {bookmarks.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 border border-dashed dark:border-zinc-800 rounded-2xl p-12 text-center text-gray-500">
                        <p className="font-medium text-lg text-gray-700 dark:text-gray-300 mb-2">No Bookmarks Yet</p>
                        <p className="text-sm">When you review your exams, click 'Save for Later' on any tricky questions so you can find them here before the actual exam.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {bookmarks.map((b) => (
                            <div key={b.docId} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                                {/* Header */}
                                <div className="bg-gray-50/50 dark:bg-zinc-900/50 p-4 flex justify-between items-start border-b dark:border-zinc-800">
                                    <div className="pr-4">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500">
                                            <span className="text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded mr-2 uppercase tracking-wide">
                                                {b.question_type}
                                            </span>
                                            {b.contestTitle && (
                                                <>
                                                    <span className="truncate max-w-[200px] text-gray-700 dark:text-gray-300">{b.contestTitle}</span>
                                                    <span className="w-1 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-1"></span>
                                                </>
                                            )}
                                            <span className="text-green-600">+{b.marks || 0}</span>
                                            <span className="text-red-500">-{b.negative_marks || 0}</span>
                                        </div>
                                        {/* Question Snippet mapping properly to actual data structure. */}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => removeBookmark(b.docId)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Remove Bookmark">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => toggleExpand(b.docId)} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 font-medium text-xs">
                                            {expandedMap[b.docId] ? <><ChevronUp className="w-4 h-4" /> Hide</> : <><ChevronDown className="w-4 h-4" /> Show Details</>}
                                        </button>
                                    </div>
                                </div>

                                {/* Question Content Header */}
                                <div className="p-4 sm:p-6 pb-2">
                                    <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-sm  sm:text-base leading-relaxed">
                                        <LatexRenderer content={extractAndCleanHtml(b.question_html)} />
                                    </div>
                                    {b.question_image_links && b.question_image_links.length > 0 && (
                                        <div className="mt-4 flex flex-col gap-4">
                                            {b.question_image_links.map((link: string, idx: number) => (
                                                <ImageZoom key={idx} src={link} alt="Figure" className="max-h-64 object-contain rounded border border-gray-100 dark:border-zinc-800 bg-white" />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Answers and Explanations (collapsible) */}
                                {expandedMap[b.docId] && (
                                    <div className="p-4 sm:p-6 pt-0 border-t dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30 animate-in slide-in-from-top-4 duration-300">

                                        <div className="mt-4">
                                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">Solution</h4>

                                            {/* For NAT */}
                                            {b.question_type === 'nat' && (
                                                <div className="inline-block p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 font-mono mb-6">
                                                    <span className="text-xs text-green-700 dark:text-green-400 block mb-1 font-semibold">Accepted Range</span>
                                                    <span className="text-green-900 dark:text-green-300 text-lg font-bold">
                                                        {b.nat_answer_min} {b.nat_answer_min !== b.nat_answer_max ? ` to ${b.nat_answer_max}` : ''}
                                                    </span>
                                                </div>
                                            )}

                                            {/* For MCQs / MSQs */}
                                            {(b.question_type === 'mcq' || b.question_type === 'msq') && b.options && (
                                                <div className="space-y-2 mb-6 max-w-2xl">
                                                    {b.options.map((opt: any, oIdx: number) => (
                                                        opt.is_correct && (
                                                            <div key={opt.label || oIdx} className="flex items-start p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 shadow-sm">
                                                                <div className="flex-shrink-0 mt-0.5 w-6">
                                                                    <span className="font-bold text-green-700 dark:text-green-400">{opt.label || String.fromCharCode(65 + oIdx)}.</span>
                                                                </div>
                                                                <div className="ml-2 flex-1 prose-sm dark:prose-invert max-w-none text-green-900 dark:text-green-100 font-medium">
                                                                    <LatexRenderer content={opt.text_html || ""} />
                                                                </div>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            )}

                                            {/* Explanation Text */}
                                            {b.explanation_html && (
                                                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/40 p-5 mt-4">
                                                    <h5 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3 text-sm">
                                                        <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                                        Detailed Explanation
                                                    </h5>
                                                    <div className="prose-sm dark:prose-invert max-w-none text-blue-900 dark:text-blue-100">
                                                        <LatexRenderer content={extractAndCleanHtml(b.explanation_html)} />
                                                    </div>
                                                    {b.explanation_image_links && b.explanation_image_links.length > 0 && (
                                                        <div className="mt-4 space-y-4">
                                                            {b.explanation_image_links.map((link: string, idx: number) => (
                                                                <ImageZoom key={idx} src={link} alt="Explanation Image" className="max-h-64 rounded border border-blue-200 dark:border-blue-800" />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
