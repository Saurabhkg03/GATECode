"use client";

import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc, query, limit, writeBatch } from 'firebase/firestore';
import { Contest, Question } from '../../types/exam';

const ContestSeeder = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const seedContest = async () => {
        setLoading(true);
        setStatus('Starting seed...');

        try {
            // 1. Fetch some real questions to link
            // Trying 'gate_questions_2024' as mentioned in prompts
            const qCol = collection(db, 'gate_questions_2024');
            const qSnapshot = await getDocs(query(qCol, limit(20)));

            let questions: Question[] = [];
            qSnapshot.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() } as Question);
            });

            if (questions.length === 0) {
                setStatus('No questions found in "gate_questions_2024". Seeding realistic GATE questions...');

                // Import sample questions dynamically or use the ones we just defined/imported
                const { sampleQuestions } = await import('@/data/sampleQuestions');

                const batch = writeBatch(db);

                for (const q of sampleQuestions) {
                    // Ensure all fields are present
                    const finalQ = {
                        ...q,
                        // Defaults if missing
                        question_image_links: [],
                        explanation_image_links: [],
                        explanation_html: q.question_html + "<br/><p><strong>Explanation:</strong> Analysis of the concept...</p>",
                        verified: true,
                        tags: [q.subject, 'mock'],
                        attempts: 0,
                        accuracy: 0
                    };

                    const ref = doc(db, 'gate_questions_2024', q.id as string);
                    batch.set(ref, finalQ);
                    questions.push(finalQ as Question);
                }

                await batch.commit();

                setStatus(`Successfully seeded ${sampleQuestions.length} realistic questions into "gate_questions_2024".`);
            } else {
                setStatus(`Found ${questions.length} questions.`);
            }

            // 2. Construct the Mock Contest
            const mockContest: Contest = {
                id: 'mock-test-1',
                title: 'GATE 2025 Contest 1 (General & Technical)',
                durationMinutes: 180,
                totalMarks: 100,
                sections: [
                    {
                        name: 'General Aptitude',
                        questions: questions.slice(0, 5), // First 5
                    },
                    {
                        name: 'Technical Section',
                        questions: questions.slice(5), // Rest
                    }
                ]
            };

            // 3. Write to Firestore
            await setDoc(doc(db, 'contests', 'mock-test-1'), mockContest);

            setStatus('Success! Created "contests/mock-test-1".');
        } catch (e: any) {
            console.error(e);
            setStatus('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded shadow bg-white max-w-md my-4">
            <h2 className="text-xl font-bold mb-2">Admin: Contest Seeder</h2>
            <p className="text-sm text-gray-600 mb-4">
                Click below to create/overwrite <code>contests/mock-test-1</code> with questions from <code>gate_questions_2024</code>.
            </p>

            <div className="mb-4">
                <span className="font-semibold">Status: </span>
                <span>{status || 'Ready'}</span>
            </div>

            <button
                onClick={seedContest}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Seeding...' : 'Seed Practice Contest'}
            </button>
        </div>
    );
};

export default ContestSeeder;
