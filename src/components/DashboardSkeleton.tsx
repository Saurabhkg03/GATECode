"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
            {/* Header Skeleton */}
            <div className="text-center mb-16">
                <Skeleton className="h-12 w-3/4 md:w-1/2 mx-auto mb-4" />
                <Skeleton className="h-6 w-full md:w-2/3 mx-auto" />

                {/* Welcome Message Skeleton */}
                <div className="mt-8 inline-block p-4 border rounded-xl w-64 mx-auto">
                    <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                </div>
            </div>

            {/* Daily Challenge Skeleton */}
            <div className="mb-16 border rounded-xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                    <Skeleton className="w-16 h-16 rounded-2xl" />
                    <div className="flex-1 w-full space-y-2">
                        <Skeleton className="h-8 w-1/2 md:w-1/3" />
                        <Skeleton className="h-4 w-3/4 md:w-1/2" />
                    </div>
                    <Skeleton className="h-12 w-32 rounded-full" />
                </div>
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {/* Subjects Section */}
                <div className="lg:col-span-2">
                    <Skeleton className="h-8 w-1/3 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="border rounded-xl p-6 h-32 flex items-center gap-4">
                                <Skeleton className="w-12 h-12 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Leaderboard Skeleton */}
                <div className="border rounded-xl p-6 h-full">
                    <div className="flex justify-between mb-6">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="w-8 h-8 rounded-full" />
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Questions Skeleton */}
            <div className="mb-16">
                <Skeleton className="h-8 w-1/3 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="border rounded-xl p-6 h-40 space-y-3">
                            <div className="flex justify-between">
                                <Skeleton className="h-5 w-20 rounded" />
                                <Skeleton className="h-4 w-10" />
                            </div>
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-2/3" />
                            <div className="flex gap-2 pt-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
