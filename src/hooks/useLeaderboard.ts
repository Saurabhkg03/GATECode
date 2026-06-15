"use client";

import { useQuery } from '@tanstack/react-query';
import { User } from '@/data/mockData';
import { useMetadata } from '@/contexts/MetadataContext';

export function useLeaderboard(limitCount: number = 5) {
    const { selectedBranch } = useMetadata();

    return useQuery({
        queryKey: ['leaderboard', selectedBranch, limitCount],
        queryFn: async () => {
            if (!selectedBranch) return [];

            const res = await fetch(`/api/leaderboard?branch=${selectedBranch}&limit=${limitCount}`);
            if (!res.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            const data = await res.json();
            return (data.data || []) as any[];
        },
        enabled: !!selectedBranch,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
