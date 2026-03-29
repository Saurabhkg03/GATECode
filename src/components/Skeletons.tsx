import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SkeletonBase = ({ className }: { className?: string }) => (
  <Skeleton className={className} />
);

// --- Home Page Skeletons ---
export const HomeSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-16">
    <div className="text-center">
      <SkeletonBase className="h-10 md:h-16 w-3/4 mx-auto mb-4" />
      <SkeletonBase className="h-5 md:h-6 w-full max-w-2xl mx-auto" />
      <SkeletonBase className="h-16 w-48 mx-auto mt-8 rounded-xl" />
    </div>

    <div className="bg-card rounded-2xl p-6 md:p-8 border border-border">
      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
        <SkeletonBase className="w-16 h-16 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2 text-center md:text-left">
          <SkeletonBase className="h-6 w-48 mx-auto md:mx-0" />
          <SkeletonBase className="h-4 w-3/4 mx-auto md:mx-0" />
        </div>
        <SkeletonBase className="h-12 w-36 rounded-full" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <SkeletonBase className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-4">
                <SkeletonBase className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBase className="h-5 w-3/4" />
                  <SkeletonBase className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card rounded-xl p-6 space-y-4 border border-border">
        <SkeletonBase className="h-7 w-48 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBase className="w-8 h-8 rounded-full" />
            <SkeletonBase className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <SkeletonBase className="h-4 w-3/4" />
              <SkeletonBase className="h-3 w-1/2" />
            </div>
            <SkeletonBase className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Practice Page Skeletons ---
const MobilePracticeListItemSkeleton = () => (
  <div className="px-4 py-4">
    <SkeletonBase className="h-5 w-3/4 mb-2" />
    <div className="flex items-center gap-2 mb-2">
      <SkeletonBase className="w-4 h-4 rounded-full" />
      <SkeletonBase className="h-3 w-16" />
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <SkeletonBase className="h-5 w-12 rounded-full" />
      <SkeletonBase className="h-5 w-20 rounded-full" />
      <SkeletonBase className="h-5 w-10 rounded" />
    </div>
  </div>
);

const DesktopPracticeListItemSkeleton = () => (
  <tr className="hidden md:table-row">
    <td className="px-6 py-4"><SkeletonBase className="w-5 h-5 rounded-full mx-auto" /></td>
    <td className="px-6 py-4"><SkeletonBase className="h-4 w-12" /></td>
    <td className="px-6 py-4"><SkeletonBase className="h-4 w-4/5" /></td>
    <td className="px-6 py-4"><SkeletonBase className="h-4 w-24" /></td>
    <td className="px-6 py-4"><SkeletonBase className="h-5 w-16 rounded-full" /></td>
    <td className="px-6 py-4"><SkeletonBase className="h-4 w-24 rounded" /></td>
  </tr>
);

export const PracticeSkeleton = () => (
  <div className="max-w-full mx-auto flex flex-col md:flex-row">
    <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-border">
      <div className="flex justify-between items-center mb-2">
        <SkeletonBase className="h-4 w-24" />
        <SkeletonBase className="h-6 w-6 rounded-md" />
      </div>
      <div className="flex flex-col gap-1">
        {[...Array(5)].map((_, i) => (
          <SkeletonBase key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>

    <div className="flex-1 min-w-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header area matching the gradient banner */}
        <div className="mb-4 rounded-2xl bg-secondary/50 border border-border p-4 sm:p-8">
          <div className="flex items-center gap-4 sm:gap-5">
            <SkeletonBase className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <SkeletonBase className="h-7 w-2/3" />
              <SkeletonBase className="h-4 w-1/3" />
            </div>
          </div>
        </div>

        {/* Topic filter bar */}
        <div className="mb-2">
          <div className="flex gap-2 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <SkeletonBase key={i} className="h-9 w-24 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="hidden md:block bg-card rounded-xl border border-border p-4 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <SkeletonBase key={i} className="h-8 w-28 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-4 border-b border-border">
          <SkeletonBase className="w-8 h-4 rounded" />
          <SkeletonBase className="flex-1 h-4 rounded" />
          <SkeletonBase className="w-24 h-4 rounded" />
          <SkeletonBase className="hidden md:block w-20 h-4 rounded" />
          <SkeletonBase className="hidden lg:block w-16 h-4 rounded" />
        </div>

        {/* Question list items */}
        <div className="flex flex-col">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 sm:py-5 border-b border-border/50">
              <SkeletonBase className="w-4 h-4 rounded-full flex-shrink-0" />
              <SkeletonBase className="flex-1 h-4 rounded" />
              <SkeletonBase className="hidden sm:block w-16 h-4 rounded" />
              <SkeletonBase className="hidden md:block w-12 h-4 rounded" />
              <SkeletonBase className="hidden lg:block w-10 h-4 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// --- Question Detail Page Skeleton ---
export const QuestionDetailSkeleton = () => (
  <div className="min-h-screen bg-background pb-20 md:pb-8 flex flex-col">
    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 flex-1 flex flex-col min-h-0">

      <div className="flex justify-between items-center mb-4 shrink-0">
        <SkeletonBase className="h-8 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-32 rounded" />
        <SkeletonBase className="h-8 w-24 rounded-lg" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-[600px] lg:min-h-0 lg:h-[calc(100vh-140px)]">

        {/* Left Pane */}
        <div className="flex-1 lg:w-1/2 flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-border/50 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
              <SkeletonBase className="h-8 w-3/4 rounded-lg" />
              <div className="flex gap-2">
                <SkeletonBase className="h-9 w-24 rounded-lg" />
                <SkeletonBase className="h-9 w-24 rounded-lg" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {[...Array(4)].map((_, i) => <SkeletonBase key={i} className="h-6 w-20 rounded-full" />)}
            </div>
          </div>

          <div className="p-5 md:p-6 flex-1">
            <div className="space-y-4">
              <SkeletonBase className="h-5 w-full" />
              <SkeletonBase className="h-5 w-11/12" />
              <SkeletonBase className="h-5 w-4/5" />
              <SkeletonBase className="h-5 w-full" />
              <SkeletonBase className="h-5 w-3/4" />
            </div>
            <SkeletonBase className="h-48 w-full rounded-xl mt-8" />
          </div>
        </div>

        {/* Right Pane */}
        <div className="flex-1 lg:w-1/2 flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden mt-6 lg:mt-0 lg:h-full">
          <div className="p-5 md:p-6 flex-1 flex flex-col">
            <div className="flex-1 space-y-4 lg:space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border">
                  <SkeletonBase className="w-6 h-6 rounded-lg flex-shrink-0" />
                  <SkeletonBase className="h-6 w-1/2 rounded" />
                </div>
              ))}
            </div>
            <div className="pt-6 shrink-0 mt-auto border-t border-border">
              <SkeletonBase className="h-14 w-full rounded-xl" />
            </div>
          </div>

          <div className="bg-secondary/30 p-5 shrink-0 border-t border-border">
            <SkeletonBase className="h-5 w-32 mb-4" />
            <SkeletonBase className="h-28 w-full rounded-xl" />
          </div>
        </div>

      </div>
    </div>
  </div>
);

// --- Leaderboard Skeleton ---
export const LeaderboardSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-8">
    <div className="text-center mb-10">
      <SkeletonBase className="h-10 w-64 mx-auto mb-3" />
      <SkeletonBase className="h-5 w-48 mx-auto" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
      {[2, 1, 3].map((rank) => (
        <div key={rank} className={cn("w-full", rank === 1 ? "md:-mt-8 order-1 md:order-2" : rank === 2 ? "order-2 md:order-1" : "order-3")}>
          <div className="w-full bg-card rounded-2xl p-5 border border-border flex flex-row md:flex-col items-center gap-5">
            <SkeletonBase className="w-20 h-20 md:w-24 md:h-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 w-full">
              <SkeletonBase className="h-6 w-3/4 md:w-32 md:mx-auto" />
              <SkeletonBase className="h-4 w-1/2 md:w-24 md:mx-auto" />
              <SkeletonBase className="h-12 md:h-14 w-full rounded-xl mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex items-center p-4 border-b border-border/50 last:border-0">
          <SkeletonBase className="w-6 h-6 rounded mr-4" />
          <SkeletonBase className="w-10 h-10 rounded-full mr-4" />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-4 w-32" />
            <SkeletonBase className="h-3 w-20" />
          </div>
          <div className="flex gap-4">
            <SkeletonBase className="h-5 w-16 rounded-full" />
            <SkeletonBase className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Profile Skeleton ---
export const ProfileSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-card rounded-2xl p-6 border border-border flex flex-row md:flex-col items-center text-left md:text-center gap-5">
          <SkeletonBase className="w-20 h-20 md:w-28 md:h-28 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-7 w-3/4 md:w-48 md:mx-auto" />
            <SkeletonBase className="h-4 w-1/2 md:w-32 md:mx-auto" />
            <SkeletonBase className="h-4 w-2/3 md:w-40 md:mx-auto" />
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <SkeletonBase className="h-6 w-32 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between"><SkeletonBase className="h-4 w-24" /><SkeletonBase className="h-4 w-12" /></div>
                <SkeletonBase className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <SkeletonBase className="h-6 w-32 mb-4" />
          <SkeletonBase className="h-48 w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 border border-border">
              <SkeletonBase className="w-10 h-10 rounded-lg mb-3" />
              <SkeletonBase className="h-6 w-16 mb-1" />
              <SkeletonBase className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <SkeletonBase className="h-6 w-48" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 border-b border-border/50 last:border-0 flex justify-between items-center">
              <div className="space-y-2">
                <SkeletonBase className="h-5 w-64" />
                <SkeletonBase className="h-3 w-32" />
              </div>
              <SkeletonBase className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// --- Settings Skeleton ---
export const SettingsSkeleton = () => (
  <div className="min-h-screen bg-background p-4 md:p-8">
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <SkeletonBase className="w-10 h-10 rounded-full" />
        <SkeletonBase className="h-8 w-48 rounded" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="flex flex-col items-center">
            <SkeletonBase className="w-24 h-24 rounded-full" />
            <SkeletonBase className="h-4 w-40 mt-3" />
          </div>

          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonBase className="h-4 w-24" />
                <SkeletonBase className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <SkeletonBase className="h-12 w-full rounded-xl mt-4" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-destructive/20 overflow-hidden">
        <div className="p-4 bg-destructive/5 border-b border-destructive/20">
          <SkeletonBase className="h-6 w-32" />
        </div>
        <div className="p-6">
          <SkeletonBase className="h-4 w-full mb-4" />
          <SkeletonBase className="h-10 w-48 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

// --- Admin Panel Skeleton ---
export const AdminPanelSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
    <div className="flex items-center gap-3 mb-6">
      <SkeletonBase className="w-8 h-8 rounded" />
      <SkeletonBase className="h-10 w-64 rounded" />
    </div>

    <SkeletonBase className="h-12 w-48 rounded-xl" />

    <div className="border-b border-border flex gap-8">
      <SkeletonBase className="h-12 w-32" />
      <SkeletonBase className="h-12 w-32" />
    </div>

    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex justify-between">
        <SkeletonBase className="h-8 w-32" />
        <SkeletonBase className="h-10 w-48 rounded-lg" />
      </div>
      <div className="p-0">
        <div className="bg-secondary/50 p-4 grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonBase key={i} className="h-4 w-20" />)}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 grid grid-cols-6 gap-4 border-b border-border last:border-0 items-center">
            {[...Array(5)].map((_, j) => <SkeletonBase key={j} className="h-5 w-full rounded" />)}
            <div className="flex gap-2"><SkeletonBase className="h-8 w-8 rounded-full" /><SkeletonBase className="h-8 w-8 rounded-full" /></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Add Question Skeleton ---
export const AddQuestionSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <SkeletonBase className="h-6 w-32 mb-6" />
    <SkeletonBase className="h-10 w-64 mb-6" />

    <div className="bg-card p-8 rounded-2xl border border-border space-y-8">
      <div className="space-y-2">
        <SkeletonBase className="h-4 w-16" />
        <SkeletonBase className="h-10 w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBase className="h-4 w-16" />
            <SkeletonBase className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <SkeletonBase className="h-4 w-32" />
        <SkeletonBase className="h-32 w-full rounded-lg" />
      </div>

      <div className="space-y-4">
        <SkeletonBase className="h-4 w-24" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <SkeletonBase className="w-5 h-5 rounded-full" />
            <SkeletonBase className="w-6 h-6 rounded" />
            <SkeletonBase className="h-10 flex-1 rounded-lg" />
          </div>
        ))}
      </div>

      <SkeletonBase className="h-14 w-full rounded-xl" />
    </div>
  </div>
);

// --- QuestionCard Skeleton ---
export const QuestionCardSkeleton = () => (
  <div className="flex items-center gap-4 px-4 py-3 sm:py-5 border-b border-border/50">
    {/* Status */}
    <SkeletonBase className="w-4 h-4 rounded-full flex-shrink-0" />
    {/* Title */}
    <SkeletonBase className="flex-1 h-4 rounded" />
    {/* Accuracy */}
    <SkeletonBase className="hidden sm:block w-16 h-4 rounded flex-shrink-0" />
    {/* Type */}
    <SkeletonBase className="hidden md:block w-12 h-4 rounded flex-shrink-0" />
    {/* Year */}
    <SkeletonBase className="hidden lg:block w-10 h-4 rounded flex-shrink-0" />
  </div>
);

// --- Dashboard Skeleton (Grid of QuestionCards) ---
export const DashboardSkeleton = () => (
  <div className="flex flex-col">
    {[...Array(6)].map((_, i) => (
      <QuestionCardSkeleton key={i} />
    ))}
  </div>
);

// --- Contests Page Skeleton ---
export const ContestsSkeleton = () => (
  <div className="min-h-screen bg-background transition-colors">
    {/* Page header */}
    <div className="relative pt-10 pb-5 px-4 sm:px-6 lg:px-8 text-center">
      <SkeletonBase className="h-10 md:h-12 w-48 mx-auto mb-2" />
      <SkeletonBase className="h-4 w-64 mx-auto" />
    </div>

    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-7xl mx-auto space-y-7">
        {/* Tab bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="inline-flex bg-secondary/50 border border-border p-1 rounded-xl gap-1">
            <SkeletonBase className="h-10 w-24 rounded-lg" />
            <SkeletonBase className="h-10 w-28 rounded-lg" />
            <SkeletonBase className="h-10 w-24 rounded-lg" />
          </div>
          <SkeletonBase className="hidden sm:block h-10 w-44 rounded-xl" />
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <SkeletonBase className="h-10 w-full rounded-xl" />
        </div>

        {/* Section heading */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <SkeletonBase className="h-6 w-48" />
        </div>

        {/* Scheduled contest cards */}
        <div className="flex flex-col sm:flex-row gap-5">
          <SkeletonBase className="flex-1 h-[180px] rounded-2xl" />
          <SkeletonBase className="flex-1 h-[180px] rounded-2xl" />
        </div>

        {/* Contest grid */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mt-6">
          <SkeletonBase className="h-6 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-[24px] p-6 border border-border">
              <div className="flex gap-2 mb-5">
                <SkeletonBase className="h-6 w-16 rounded-full" />
                <SkeletonBase className="h-6 w-10 rounded-full" />
              </div>
              <SkeletonBase className="h-6 w-3/4 mb-2" />
              <SkeletonBase className="h-4 w-full mb-5" />
              <div className="grid grid-cols-2 gap-3 mb-6">
                <SkeletonBase className="h-4 w-20" />
                <SkeletonBase className="h-4 w-24" />
              </div>
              <SkeletonBase className="h-12 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
