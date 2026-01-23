"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { db } from '@/firebase';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Question } from '@/data/mockData';
import { AddQuestionSkeleton } from '@/components/Skeletons';

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-5 h-5" />
                    Back to Panel
                </Link>
                <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{isEditMode ? 'Edit Question' : 'Add a New Question'}</h1>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-900 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
                    {/* Form fields for question properties */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                        <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Branch</label>
                            <select
                                value={formData.branch}
                                onChange={e => setFormData({ ...formData, branch: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                {Object.entries(availableBranches).map(([code, name]) => (
                                    <option key={code} value={code}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                            <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Topic</label>
                            <input type="text" value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question (HTML)</label>
                        <textarea value={formData.question_html} onChange={e => setFormData({ ...formData, question_html: e.target.value })} rows={5} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                    </div>

                    {/* Options for MCQ */}
                    {formData.question_type === 'mcq' && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Select one correct answer)</label>
                            {(formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, index: number) => (
                                <div key={index} className="flex items-center gap-4">
                                    <input type="radio" name="correct_option" checked={opt.is_correct} onChange={() => handleCorrectOptionChange(index)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{opt.label}</span>
                                    <input type="text" placeholder={`Option ${opt.label} HTML`} value={opt.text_html} onChange={e => handleOptionChange(index, e.target.value)} className="flex-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Options for MSQ */}
                    {formData.question_type === 'msq' && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Mark all that are correct)</label>
                            {(formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, index: number) => (
                                <div key={index} className="flex items-center gap-4">
                                    <input type="checkbox" name={`correct_option_${index}`} checked={opt.is_correct} onChange={() => handleCorrectOptionToggle(index)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{opt.label}</span>
                                    <input type="text" placeholder={`Option ${opt.label} HTML`} value={opt.text_html} onChange={e => handleOptionChange(index, e.target.value)} className="flex-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Explanation (HTML)</label>
                        <textarea value={formData.explanation_html} onChange={e => setFormData({ ...formData, explanation_html: e.target.value })} rows={5} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GateOverflow Redirect URL (Optional - for CSE)</label>
                        <input type="text" value={formData.explanation_redirect_url || ''} onChange={e => setFormData({ ...formData, explanation_redirect_url: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" placeholder="https://gateoverflow.in/..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                            <input type="text" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question Type</label>
                            <select
                                value={formData.question_type}
                                onChange={e => handleTypeChange(e.target.value as 'mcq' | 'nat' | 'msq')}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="mcq">MCQ</option>
                                <option value="nat">NAT</option>
                                <option value="msq">MSQ</option>
                            </select>
                        </div>
                    </div>
                    {formData.question_type === 'nat' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NAT Answer (Min Range)</label>
                                <input type="text" value={formData.nat_answer_min || ''} onChange={e => setFormData({ ...formData, nat_answer_min: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" placeholder="e.g. 9.8" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NAT Answer (Max Range)</label>
                                <input type="text" value={formData.nat_answer_max || ''} onChange={e => setFormData({ ...formData, nat_answer_max: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500" placeholder="e.g. 9.81" />
                            </div>
                        </div>
                    )}


                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button type="submit" disabled={loading || metadataLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
                        {loading || metadataLoading ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                        {isEditMode ? 'Update Question' : 'Add Question'}
                    </button>
                </form>
            </div>
        </div>
    );
}
