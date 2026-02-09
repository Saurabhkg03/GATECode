"use client";

import React, { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

interface LatexRendererProps {
    content: string;
    className?: string;
    inline?: boolean;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ content, className, inline = false }) => {
    const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const renderOptions = {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '[latex]', right: '[/latex]', display: true },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            };

            try {
                renderMathInElement(containerRef.current as HTMLElement, renderOptions);
            } catch (error) {
                console.warn("KaTeX rendering error:", error);
            }
        }
    }, [content]);

    const Container = inline ? 'span' : 'div';

    return (
        <Container
            ref={containerRef as any}
            className={className}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
};

export default React.memo(LatexRenderer);
