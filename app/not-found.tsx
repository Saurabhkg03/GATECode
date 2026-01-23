import Link from 'next/link';
import { Home } from 'lucide-react';

const NotFoundIllustration = () => (
    <svg width="200" height="200" viewBox="0 0 300 300" className="drop-shadow-lg">
        <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Planet & Stars */}
        <circle cx="100" cy="220" r="80" fill="url(#planetGradient)" />
        <circle cx="50" cy="50" r="2" fill="white" opacity="0.8" />
        <circle cx="350" cy="80" r="1.5" fill="white" opacity="0.7" />
        <circle cx="280" cy="250" r="1" fill="white" opacity="0.6" />
        <circle cx="150" cy="40" r="1.2" fill="white" opacity="0.9" />

        {/* Sad Robot */}
        <g transform="translate(200 150)">
            {/* Body */}
            <rect x="-40" y="-30" width="80" height="90" rx="15" fill="#a0aec0" className="dark:fill-zinc-600" />
            <rect x="-30" y="-20" width="60" height="70" rx="10" fill="#e2e8f0" className="dark:fill-zinc-700" />

            {/* Screen */}
            <rect x="-25" y="-10" width="50" height="40" rx="5" fill="#1a202c" className="dark:fill-black" />
            <text x="0" y="15" fontFamily="monospace" fontSize="24" fill="#f87171" textAnchor="middle" filter="url(#glow)">404</text>

            {/* Head & Antenna */}
            <rect x="-25" y="-50" width="50" height="20" rx="5" fill="#a0aec0" className="dark:fill-zinc-600" />
            <line x1="0" y1="-50" x2="0" y2="-65" stroke="#718096" className="dark:stroke-zinc-500" strokeWidth="3" />
            <circle cx="0" cy="-70" r="5" fill="#f87171" filter="url(#glow)">
                <animate attributeName="r" values="5; 7; 5" dur="1.5s" repeatCount="indefinite" />
            </circle>

            {/* Arms */}
            <rect x="-55" y="0" width="15" height="40" rx="5" fill="#a0aec0" className="dark:fill-zinc-600" transform="rotate(-20 -55 20)" />
            <rect x="40" y="0" width="15" height="40" rx="5" fill="#a0aec0" className="dark:fill-zinc-600" transform="rotate(20 40 20)" />

            {/* Legs */}
            <rect x="-25" y="60" width="15" height="30" rx="5" fill="#a0aec0" className="dark:fill-zinc-600" />
            <rect x="10" y="60" width="15" height="30" rx="5" fill="#a0aec0" className="dark:fill-zinc-600" />
        </g>

        <defs>
            <radialGradient id="planetGradient">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
        </defs>
    </svg>
);


export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center text-center px-4">
            <div>
                <NotFoundIllustration />
                <h1 className="text-4xl md:text-6xl font-bold text-zinc-800 dark:text-white mt-8">
                    Page Not Found
                </h1>
                <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                    Oops! The page you're looking for seems to have gotten lost in space.
                </p>
                <Link
                    href="/"
                    className="mt-8 inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/50"
                >
                    <Home className="w-5 h-5" />
                    Go to Homepage
                </Link>
            </div>
        </div>
    );
}
