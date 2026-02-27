"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Loader2, ArrowLeft, Eye, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { db } from '@/firebase';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Question } from '@/data/mockData';
import { AddQuestionSkeleton } from '@/components/Skeletons';
import MathRenderer from '@/components/MathRenderer';
import { extractAndCleanHtml } from '@/utils/htmlUtils';

interface QuestionFormProps {
    questionId?: string;
}

export default function QuestionForm({ questionId }: QuestionFormProps) {
    const { userInfo } = useAuth();
    const router = useRouter();
    const { questionCollectionPath, selectedBranch, availableBranches, loading: metadataLoading } = useMetadata();
    const isEditMode = !!questionId;

    const [formData, setFormData] = useState<Partial<Question>>({
        title: '',
        subject: '',
        topic: '',
        branch: selectedBranch,
        question_html: '',
        explanation_html: '',
        explanation_redirect_url: null,
        options: [
            { label: 'A', text_html: '', is_correct: true },
            { label: 'B', text_html: '', is_correct: false },
            { label: 'C', text_html: '', is_correct: false },
            { label: 'D', text_html: '', is_correct: false },
        ],
        year: new Date().getFullYear().toString(),
        tags: [],
        question_type: 'mcq',
        nat_answer_min: null,
        nat_answer_max: null,
        verified: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Update form's default branch if the context branch changes *before* data load and not in edit mode
    useEffect(() => {
        if (!isEditMode) {
            setFormData(prev => ({ ...prev, branch: selectedBranch, tags: [selectedBranch] }));
        }
    }, [selectedBranch, isEditMode]);


    useEffect(() => {
        if (questionId && questionCollectionPath) {
            const fetchQuestion = async () => {
                setLoading(true);
                try {
                    const docRef = doc(db, questionCollectionPath, questionId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const questionData = docSnap.data() as Question;
                        // Ensure options are initialized correctly
                        if (!questionData.options || questionData.options.length === 0) {
                            questionData.options = [
                                { label: 'A', text_html: '', is_correct: true },
                                { label: 'B', text_html: '', is_correct: false },
                                { label: 'C', text_html: '', is_correct: false },
                                { label: 'D', text_html: '', is_correct: false },
                            ];
                        }
                        // Ensure at least one option is correct for MCQ on load if none are
                        if (questionData.question_type === 'mcq' && !questionData.options.some((o: { is_correct: boolean }) => o.is_correct)) {
                            questionData.options[0].is_correct = true;
                        }
                        setFormData(questionData);
                    } else {
                        setError(`Question not found in collection '${questionCollectionPath}'. It might be in a different branch.`);
                    }
                } catch (err) {
                    console.error(err);
                    setError("Failed to fetch question.");
                }
                setLoading(false);
            };
            fetchQuestion();
        }
    }, [questionId, questionCollectionPath]);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...(formData.options || [])];
        newOptions[index].text_html = value;
        setFormData({ ...formData, options: newOptions });
    };

    const handleCorrectOptionChange = (index: number) => {
        const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
            ...opt,
            is_correct: i === index,
        }));
        setFormData({ ...formData, options: newOptions });
    };

    const handleCorrectOptionToggle = (index: number) => {
        const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
            ...opt,
            is_correct: i === index ? !opt.is_correct : opt.is_correct,
        }));
        setFormData({ ...formData, options: newOptions });
    };

    const handleTypeChange = (type: 'mcq' | 'nat' | 'msq') => {
        const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
            ...opt,
            // When switching to MCQ, default to A being correct if nothing else is
            is_correct: type === 'mcq' ? i === 0 : false
        }));
        setFormData({
            ...formData,
            question_type: type,
            options: type === 'nat' ? [] : newOptions, // Clear options for NAT
            nat_answer_min: type === 'nat' ? formData.nat_answer_min : null,
            nat_answer_max: type === 'nat' ? formData.nat_answer_max : null,
            correctAnswerLabel: type === 'mcq' ? newOptions.find((o: { is_correct: boolean }) => o.is_correct)?.label : null,
            correctAnswerLabels: type === 'msq' ? [] : []
        });
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInfo || (userInfo.role !== 'moderator' && userInfo.role !== 'admin') || !questionCollectionPath) {
            setError('You are not authorized or the data is not ready. Please try again.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const finalTags = Array.from(new Set([
                ...(formData.tags || []),
                formData.branch,
                formData.subject,
                formData.topic,
                `GATE ${formData.year}`
            ].filter(Boolean) as string[]));


            const questionData: Omit<Question, 'id'> = {
                ...formData,
                branch: formData.branch || selectedBranch, // Ensure branch is set
                tags: finalTags,
                addedBy: userInfo.uid,
                createdAt: new Date().toISOString(),
                verified: userInfo.role === 'admin' ? true : false, // Admins can auto-verify
                // Handle single vs multiple correct labels
                correctAnswerLabel: formData.question_type === 'mcq'
                    ? formData.options?.find((opt: { is_correct: boolean }) => opt.is_correct)?.label || 'A' // Default to A if none selected
                    : null, // Clear single label for MSQ/NAT
                correctAnswerLabels: formData.question_type === 'msq'
                    ? formData.options?.filter((opt: { is_correct: boolean }) => opt.is_correct).map((opt: { label: string }) => opt.label) || []
                    : [], // Clear array for MCQ/NAT

                // Ensure fields are correctly typed and present
                title: formData.title || 'Untitled Question',
                subject: formData.subject || 'General',
                topic: formData.topic || 'General',
                question_html: formData.question_html || '',
                explanation_html: formData.explanation_html || '',
                explanation_redirect_url: formData.explanation_redirect_url || null,
                options: formData.question_type === 'nat' ? [] : (formData.options || []),
                question_type: formData.question_type || 'mcq',
                year: formData.year || 'N/A',
                nat_answer_min: formData.nat_answer_min || null,
                nat_answer_max: formData.nat_answer_max || null,
                accuracy: 0,
                attempts: 0,
            };

            if (isEditMode && questionId) {
                await setDoc(doc(db, questionCollectionPath, questionId), questionData);
            } else {
                await addDoc(collection(db, questionCollectionPath), questionData);
            }

            router.push('/admin');
        } catch (err) {
            console.error(err);
            setError('Failed to save question. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if ((loading && isEditMode) || metadataLoading) {
        return <AddQuestionSkeleton />;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-12">
            <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white mb-6 font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Panel
                </Link>

                <h1 className="text-2xl md:text-3xl font-bold mb-8 text-zinc-900 dark:text-white">
                    {isEditMode ? 'Edit Question' : 'Add a New Question'}
                </h1>

                <div className="flex flex-col xl:flex-row gap-6 lg:gap-8 items-start">
                    {/* LEFT PANE: Form */}
                    <div className="w-full xl:w-1/2 bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Title</label>
                                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="Enter question title..." />
                            </div>

                            {/* Classification */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Branch</label>
                                    <select value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none">
                                        {Object.entries(availableBranches).map(([code, name]) => (
                                            <option key={code} value={code}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Subject</label>
                                    <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="e.g. Data Structures" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Topic</label>
                                    <input type="text" value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="e.g. Trees" />
                                </div>
                            </div>

                            {/* Question Settings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Year</label>
                                    <input type="text" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Question Type</label>
                                    <select value={formData.question_type} onChange={e => handleTypeChange(e.target.value as 'mcq' | 'nat' | 'msq')} className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium text-blue-600 dark:text-blue-400">
                                        <option value="mcq">MCQ (Single Correct)</option>
                                        <option value="msq">MSQ (Multiple Correct)</option>
                                        <option value="nat">NAT (Numerical)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Question HTML */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Question Content (HTML)</label>
                                <textarea value={formData.question_html} onChange={e => setFormData({ ...formData, question_html: e.target.value })} rows={6} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-sm" placeholder="<p>Enter your question...</p>" />
                            </div>

                            {/* Options for MCQ / MSQ */}
                            {(formData.question_type === 'mcq' || formData.question_type === 'msq') && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            Options <span className="text-zinc-400 font-normal">({formData.question_type === 'mcq' ? 'Select single correct answer' : 'Mark all correct answers'})</span>
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, index: number) => (
                                            <div key={index} className={`flex items-start gap-4 p-4 rounded-xl border ${opt.is_correct ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50'} transition-colors`}>
                                                <div className="pt-2">
                                                    {formData.question_type === 'mcq' ? (
                                                        <input type="radio" name="correct_option" checked={opt.is_correct} onChange={() => handleCorrectOptionChange(index)} className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-zinc-300" />
                                                    ) : (
                                                        <input type="checkbox" checked={opt.is_correct} onChange={() => handleCorrectOptionToggle(index)} className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 rounded border-zinc-300" />
                                                    )}
                                                </div>
                                                <span className={`pt-2 font-bold ${opt.is_correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{opt.label}</span>
                                                <textarea value={opt.text_html} onChange={e => handleOptionChange(index, e.target.value)} rows={2} className="flex-1 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-sm" placeholder={`Option ${opt.label} HTML...`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* NAT Inputs */}
                            {formData.question_type === 'nat' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">NAT Answer (Min Range)</label>
                                        <input type="text" value={formData.nat_answer_min || ''} onChange={e => setFormData({ ...formData, nat_answer_min: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono" placeholder="e.g. 9.8" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">NAT Answer (Max Range)</label>
                                        <input type="text" value={formData.nat_answer_max || ''} onChange={e => setFormData({ ...formData, nat_answer_max: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono" placeholder="e.g. 9.81" />
                                    </div>
                                </div>
                            )}

                            {/* Explanation */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Explanation (HTML)</label>
                                <textarea value={formData.explanation_html} onChange={e => setFormData({ ...formData, explanation_html: e.target.value })} rows={5} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-sm" placeholder="<p>Explanation goes here...</p>" />
                            </div>

                            {/* Redirect URL */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">GateOverflow Redirect URL (Optional)</label>
                                <input type="text" value={formData.explanation_redirect_url || ''} onChange={e => setFormData({ ...formData, explanation_redirect_url: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="https://gateoverflow.in/..." />
                            </div>

                            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">{error}</div>}

                            <button type="submit" disabled={loading || metadataLoading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
                                {loading || metadataLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isEditMode ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                                {isEditMode ? 'Save Changes' : 'Publish Question'}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT PANE: Live Preview */}
                    <div className="w-full xl:w-1/2 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden xl:sticky xl:top-24 max-h-none xl:max-h-[calc(100vh-8rem)]">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shrink-0">
                            <Eye className="w-5 h-5 text-zinc-500" />
                            <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">Live Preview Output</h2>
                        </div>

                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 pb-12">
                            <div className="flex items-start gap-4 mb-6">
                                <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
                                    {formData.title || 'Untitled Question'}
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-8">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${formData.question_type === 'mcq' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : formData.question_type === 'msq' ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' : 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'}`}>
                                    {formData.question_type || 'MCQ'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                    {formData.subject || 'Subject'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                    {formData.topic || 'Topic'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                    GATE {formData.year || '2025'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                    {formData.branch ? formData.branch.toUpperCase() : selectedBranch.toUpperCase()}
                                </span>
                            </div>

                            <div className="mb-8 select-text">
                                <MathRenderer
                                    content={formData.question_html ? extractAndCleanHtml(formData.question_html, 'question_text') : '<p class="text-zinc-400 italic">No question content provided...</p>'}
                                    className="prose prose-zinc dark:prose-invert max-w-none text-lg leading-relaxed text-zinc-800 dark:text-zinc-200"
                                />
                            </div>

                            <div className="mt-8">
                                {formData.question_type === 'nat' ? (
                                    <div className="max-w-sm">
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Correct Answer Range</label>
                                        <div className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl font-mono text-lg text-indigo-700 dark:text-indigo-300 font-semibold shadow-inner flex justify-center tracking-wider">
                                            {formData.nat_answer_min || 'MIN'} <span className="text-zinc-400 mx-3">—</span> {formData.nat_answer_max || 'MAX'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pointer-events-none">
                                        {(formData.options || []).map((opt, idx) => {
                                            const isChecked = opt.is_correct;
                                            return (
                                                <div key={idx} className={`relative w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition-all duration-200 ${isChecked ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 shadow-sm' : 'bg-white dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60'}`}>
                                                    <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors duration-200 ${formData.question_type === 'mcq' ? 'rounded-full' : 'rounded-lg'} ${isChecked ? 'bg-emerald-500 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                                                        {opt.label}
                                                    </div>
                                                    <MathRenderer
                                                        content={opt.text_html ? extractAndCleanHtml(opt.text_html, 'option_data') : `<span class="text-zinc-400 italic">Option ${opt.label} empty</span>`}
                                                        inline
                                                        className={`flex-1 pt-1 prose prose-sm dark:prose-invert font-medium ${isChecked ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {(formData.explanation_html || formData.explanation_redirect_url) && (
                                <div className="mt-10 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                    <div className="px-5 py-3 bg-zinc-100/50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white">Explanation Preview</h3>
                                    </div>
                                    <div className="p-5 md:p-6">
                                        <MathRenderer
                                            content={
                                                formData.explanation_redirect_url
                                                    ? `<p>This explanation is provided by GateOverflow. <a href="${formData.explanation_redirect_url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold inline-flex items-center gap-1">Click here to view the full discussion</a></p>`
                                                    : extractAndCleanHtml(formData.explanation_html || '', 'mtq_explanation-text')
                                            }
                                            className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
