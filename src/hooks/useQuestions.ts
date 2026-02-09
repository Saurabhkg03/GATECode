"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, DocumentData, QueryConstraint } from 'firebase/firestore';
import { Question } from '@/firebase'; // Assuming Question type is exported from here
import { useMetadata } from '@/contexts/MetadataContext';

// --- Types ---
interface UseQuestionsOptions {
    limit?: number;
    filters?: {
        subject?: string;
        topic?: string;
        year?: string;
        difficulty?: string;
    };
    enabled?: boolean;
}

// --- Fetcher Functions ---

const fetchQuestionById = async (collectionPath: string, id: string): Promise<Question | null> => {
    if (!id || !collectionPath) return null;
    const docRef = doc(db, collectionPath, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Question;
    }
    return null;
};

// --- Hooks ---

export function useQuestion(id: string) {
    const { questionCollectionPath } = useMetadata();

    return useQuery({
        queryKey: ['question', questionCollectionPath, id],
        queryFn: () => fetchQuestionById(questionCollectionPath, id),
        enabled: !!id && !!questionCollectionPath,
        staleTime: 1000 * 60 * 60, // 1 hour for individual questions (they rarely change)
    });
}

export function useQuestions(options: UseQuestionsOptions = {}) {
    const { questionCollectionPath } = useMetadata();

    return useQuery({
        queryKey: ['questions', questionCollectionPath, options],
        queryFn: async () => {
            if (!questionCollectionPath) return [];

            const constraints: QueryConstraint[] = [];

            if (options.filters?.subject) {
                constraints.push(where('subject', '==', options.filters.subject));
            }
            if (options.filters?.topic) {
                constraints.push(where('topic', '==', options.filters.topic));
            }
            if (options.filters?.year) {
                constraints.push(where('year', '==', options.filters.year));
            }

            // Add limit if provided
            if (options.limit) {
                constraints.push(limit(options.limit));
            }

            const q = query(collection(db, questionCollectionPath), ...constraints);
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Question));
        },
        enabled: options.enabled !== false && !!questionCollectionPath,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
