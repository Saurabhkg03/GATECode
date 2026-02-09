"use client";

import { useQuery } from '@tanstack/react-query';
import { db } from '@/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { User } from '@/data/mockData';
import { useMetadata } from '@/contexts/MetadataContext';

export function useLeaderboard(limitCount: number = 5) {
    const { selectedBranch } = useMetadata();

    return useQuery({
        queryKey: ['leaderboard', selectedBranch, limitCount],
        queryFn: async () => {
            if (!selectedBranch) return [];

            const usersQuery = query(
                collection(db, 'users'),
                orderBy(`ratings.${selectedBranch}`, 'desc'),
                limit(limitCount)
            );
            const usersSnapshot = await getDocs(usersQuery);

            return usersSnapshot.docs.map(doc => {
                const data = doc.data() as User;
                const branchStats = data.branchStats?.[selectedBranch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
                const branchRating = data.ratings?.[selectedBranch] || 0;

                return {
                    ...data,
                    stats: branchStats,
                    rating: branchRating,
                };
            });
        },
        enabled: !!selectedBranch,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
