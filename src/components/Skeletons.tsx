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

    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 md:p-8 border border-zinc-200 dark:border-zinc-800">
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
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
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
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-4 border border-zinc-200 dark:border-zinc-800">
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
    <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-zinc-200 dark:border-zinc-800">
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
        <div className="mb-8">
          <SkeletonBase className="h-8 w-1/3 mb-2" />
          <SkeletonBase className="h-4 w-1/4" />
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 mb-6">
          <div className="space-y-4">
            <SkeletonBase className="h-10 w-full rounded-lg" />
            <div className="flex flex-wrap items-center gap-2">
              {[...Array(6)].map((_, i) => (
                <SkeletonBase key={i} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
            {[...Array(5)].map((_, i) => <MobilePracticeListItemSkeleton key={i} />)}
          </div>
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  {[...Array(6)].map((_, i) => <th key={i} className="px-6 py-3"><SkeletonBase className="h-4 w-16" /></th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {[...Array(5)].map((_, i) => <DesktopPracticeListItemSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Question Detail Page Skeleton ---
export const QuestionDetailSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-6 w-24 rounded" />
      <SkeletonBase className="h-4 w-32 rounded" />
      <SkeletonBase className="h-6 w-20 rounded" />
    </div>

    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
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

      <div className="p-6 space-y-6">
        <div className="space-y-3">
          <SkeletonBase className="h-4 w-full" />
          <SkeletonBase className="h-4 w-5/6" />
          <SkeletonBase className="h-4 w-4/5" />
        </div>

        <div className="space-y-3 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <SkeletonBase className="w-6 h-6 rounded-full flex-shrink-0" />
              <SkeletonBase className="h-5 w-full rounded" />
            </div>
          ))}
        </div>

        <SkeletonBase className="h-12 w-full rounded-xl mt-4" />
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
        <div key={rank} className={cn("flex flex-col items-center", rank === 1 ? "md:-mt-8 order-1 md:order-2" : rank === 2 ? "order-2 md:order-1" : "order-3")}>
          <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
            <SkeletonBase className="w-20 h-20 rounded-full mb-4" />
            <SkeletonBase className="h-6 w-32 mb-2" />
            <SkeletonBase className="h-4 w-24 mb-4" />
            <SkeletonBase className="h-14 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex items-center p-4 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
          <SkeletonBase className="w-28 h-28 rounded-full mb-4" />
          <SkeletonBase className="h-8 w-48 mb-2" />
          <SkeletonBase className="h-4 w-32 mb-4" />
          <SkeletonBase className="h-4 w-40" />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
          <SkeletonBase className="h-6 w-32 mb-4" />
          <SkeletonBase className="h-48 w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 border-zinc-200 dark:border-zinc-800">
              <SkeletonBase className="w-10 h-10 rounded-lg mb-3" />
              <SkeletonBase className="h-6 w-16 mb-1" />
              <SkeletonBase className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/50">
            <SkeletonBase className="h-6 w-48" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 flex justify-between items-center">
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
  <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
    <div className="flex items-center gap-4 mb-8">
      <SkeletonBase className="w-10 h-10 rounded-full" />
      <SkeletonBase className="h-8 w-48 rounded" />
    </div>

    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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

    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
      <div className="p-4 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/50">
        <SkeletonBase className="h-6 w-32" />
      </div>
      <div className="p-6">
        <SkeletonBase className="h-4 w-full mb-4" />
        <SkeletonBase className="h-10 w-48 rounded-lg" />
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

    <div className="border-b border-zinc-200 dark:border-zinc-800 flex gap-8">
      <SkeletonBase className="h-12 w-32" />
      <SkeletonBase className="h-12 w-32" />
    </div>

    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
        <SkeletonBase className="h-8 w-32" />
        <SkeletonBase className="h-10 w-48 rounded-lg" />
      </div>
      <div className="p-0">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonBase key={i} className="h-4 w-20" />)}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 grid grid-cols-6 gap-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 items-center">
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

    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-8">
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
