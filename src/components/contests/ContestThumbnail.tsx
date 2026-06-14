import React, { useMemo } from 'react';

interface ContestThumbnailProps {
  contestId: string;
  title: string;
  className?: string;
}

// A deterministic string hash function
function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Curated list of vibrant gradients
const GRADIENTS = [
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-cyan-500 via-blue-500 to-indigo-500",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-rose-400 via-fuchsia-500 to-indigo-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-blue-600 via-indigo-600 to-purple-700",
  "from-teal-400 via-emerald-500 to-green-600",
  "from-fuchsia-500 via-pink-600 to-rose-600",
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-cyan-400 via-sky-500 to-blue-600",
];

// Curated list of shapes and patterns (we use CSS clip-paths or just rounded divs for abstract blobs)
const SHAPES = [
  { className: "rounded-full mix-blend-overlay opacity-40 blur-2xl", w: "w-32", h: "h-32" },
  { className: "rounded-[40%] mix-blend-overlay opacity-30 blur-xl rotate-12", w: "w-40", h: "h-24" },
  { className: "rounded-t-full mix-blend-overlay opacity-50 blur-3xl -rotate-45", w: "w-48", h: "h-48" },
  { className: "rounded-b-full mix-blend-overlay opacity-40 blur-2xl rotate-90", w: "w-24", h: "h-32" },
  { className: "rounded-[30%_70%_70%_30%/30%_30%_70%_70%] mix-blend-overlay opacity-30 blur-xl", w: "w-36", h: "h-36" },
];

export default function ContestThumbnail({ contestId, title, className = "" }: ContestThumbnailProps) {
  // Use a combination of contestId and title to make the hash highly unique
  const seed = useMemo(() => getStringHash(`${contestId}-${title}`), [contestId, title]);

  const gradientClass = GRADIENTS[seed % GRADIENTS.length];
  
  // We'll generate 3 abstract shapes to overlay
  const shape1 = SHAPES[(seed + 1) % SHAPES.length];
  const shape2 = SHAPES[(seed + 2) % SHAPES.length];
  const shape3 = SHAPES[(seed + 3) % SHAPES.length];

  // Pseudo-random positions based on seed
  const pos1 = { top: `${(seed % 60) - 10}%`, left: `${((seed * 2) % 60) - 10}%` };
  const pos2 = { bottom: `${(seed % 40) - 20}%`, right: `${((seed * 3) % 40) - 20}%` };
  const pos3 = { top: `${((seed * 7) % 60) + 20}%`, left: `${((seed * 5) % 60) + 20}%` };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br ${gradientClass} ${className}`}>
      {/* Background grain texture for a premium look */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/7/76/1k_Dissolve_Noise_Texture.png')", backgroundSize: '100px 100px' }}></div>
      
      {/* Abstract floating shapes */}
      <div 
        className={`absolute bg-white ${shape1.w} ${shape1.h} ${shape1.className}`} 
        style={pos1}
      />
      <div 
        className={`absolute bg-white ${shape2.w} ${shape2.h} ${shape2.className}`} 
        style={pos2}
      />
      <div 
        className={`absolute bg-white ${shape3.w} ${shape3.h} ${shape3.className}`} 
        style={pos3}
      />
      
      {/* Fallback subtle radial glow in the center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] pointer-events-none" />
    </div>
  );
}
