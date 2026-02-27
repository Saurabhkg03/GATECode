export const getRankTier = (rating: number) => {
    if (rating < 1200) return { title: 'Novice', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (rating < 1400) return { title: 'Pupil', color: 'text-green-500', bg: 'bg-green-100' };
    if (rating < 1600) return { title: 'Specialist', color: 'text-cyan-500', bg: 'bg-cyan-100' };
    if (rating < 1800) return { title: 'Expert', color: 'text-blue-500', bg: 'bg-blue-100' };
    if (rating < 2000) return { title: 'Master', color: 'text-purple-500', bg: 'bg-purple-100' };
    return { title: 'Grandmaster', color: 'text-red-500', bg: 'bg-red-100' };
};
