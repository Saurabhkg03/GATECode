import Link from 'next/link';
import { Home, Search } from 'lucide-react';

const UserNotFoundIllustration = () => (
    <svg width="200" height="150" viewBox="0 0 400 300" className="drop-shadow-lg mx-auto">
        <defs>
            <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Background elements */}
        <circle cx="200" cy="150" r="140" fill="url(#bgGrad)" />
        <path d="M 50 150 Q 200 50 350 150" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" strokeDasharray="5 5" />
        <path d="M 50 150 Q 200 250 350 150" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" strokeDasharray="5 5" />

        {/* Magnifying glass */}
        <g transform="translate(180 130) rotate(30)">
            <circle cx="0" cy="0" r="60" strokeWidth="12" stroke="#60a5fa" fill="rgba(96, 165, 250, 0.2)" />
            <line x1="50" y1="50" x2="100" y2="100" strokeWidth="15" stroke="#60a5fa" strokeLinecap="round" />
        </g>

        {/* Question Mark */}
        <text
            x="180" y="155"
            fontFamily="Arial, sans-serif"
            fontSize="100"
            fontWeight="bold"
            fill="#93c5fd"
            textAnchor="middle"
            filter="url(#glow-blue)"
        >
            ?
        </text>

        <defs>
            <radialGradient id="bgGrad" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="rgba(30, 41, 59, 0.5)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
            </radialGradient>
        </defs>
    </svg>
);


export default function UserNotFound({ username }: { username?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center text-center px-4">
            <div>
                <UserNotFoundIllustration />
                <h1 className="text-4xl md:text-5xl font-bold text-zinc-800 dark:text-white mt-8">
                    User Not Found
                </h1>
                <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                    We searched far and wide, but the profile for <span className="font-semibold text-zinc-700 dark:text-zinc-300">@{username || 'this user'}</span> could not be found.
                </p>
                <div className="mt-8 flex justify-center items-center gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/50"
                    >
                        <Home className="w-5 h-5" />
                        Go to Homepage
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="inline-flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-6 py-3 rounded-full font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                    >
                        <Search className="w-5 h-5" />
                        Find Users
                    </Link>
                </div>
            </div>
        </div>
    );
}
