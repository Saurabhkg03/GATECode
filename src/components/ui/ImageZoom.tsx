"use client";

import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ImageZoomProps {
    src: string;
    alt?: string;
    className?: string; // For thumbnail customization
}

const ImageZoom: React.FC<ImageZoomProps> = ({ src, alt = "Image", className }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Thumbnail */}
            <div
                className={`relative group inline-block cursor-zoom-in ${className}`}
                onClick={() => setIsOpen(true)}
            >
                <img
                    src={src}
                    alt={alt}
                    className={`max-w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 object-contain hover:shadow-lg transition-all ${className}`}
                />

                {/* Overlay Hint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 pointer-events-none">
                        <ZoomIn className="w-3 h-3" /> Zoom
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div className="relative max-w-full max-h-screen flex flex-col items-center justify-center">
                        {/* Close Button */}
                        <button
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <img
                            src={src}
                            alt={alt}
                            className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl object-contain bg-white select-none"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image itself
                        />

                        {alt && (
                            <p className="mt-4 text-white/50 text-sm text-center max-w-lg">
                                {alt}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ImageZoom;
