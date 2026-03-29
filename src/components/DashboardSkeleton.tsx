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
                <div className="mt-8 inline-block bg-card border border-border p-4 rounded-xl w-64 mx-auto">
                    <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                </div>
            </div>

            {/* Dashboard Widgets (2-col grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-6 w-36" />
                    </div>
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                        <Skeleton className="h-10 w-12" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                    <Skeleton className="h-4 w-2/3 mb-4" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
            </div>

            {/* Contest Cards */}
            <div className="mb-16">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-[180px] rounded-2xl" />
                    <Skeleton className="h-[180px] rounded-2xl" />
                </div>
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {/* Subjects Section */}
                <div className="lg:col-span-2">
                    <Skeleton className="h-8 w-1/3 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-card border border-border rounded-xl p-6 flex items-center gap-4">
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
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex justify-between mb-6">
                        <Skeleton className="h-7 w-1/2" />
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
        </div>
    );
}
