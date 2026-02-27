"use client";

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
    content: string;
    className?: string;
    inline?: boolean;
}

const renderMathInString = (text: string): string => {
    if (!text) return '';

    const delimiters = [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '[latex]', right: '[/latex]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false }
    ];

    let processedStr = text;

    delimiters.forEach(({ left, right, display }) => {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapeRegExp(left)}(.*?)${escapeRegExp(right)}`, 'gs');

        processedStr = processedStr.replace(regex, (match, math) => {
            try {
                const decodedMathString = math
                    .replace(/&gt;/g, '>')
                    .replace(/&lt;/g, '<')
                    .replace(/&amp;/g, '&')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");

                return katex.renderToString(decodedMathString, {
                    displayMode: display,
                    throwOnError: false,
                });
            } catch (error) {
                console.warn("KaTeX rendering error:", error);
                return match;
            }
        });
    });

    return processedStr;
};

const MathRenderer: React.FC<MathRendererProps> = ({ content, className, inline = false }) => {
    const htmlContent = useMemo(() => renderMathInString(content), [content]);
    const Container = inline ? 'span' : 'div';

    return (
        <Container
            className={className}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};

export default React.memo(MathRenderer);
