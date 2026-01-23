"use client";
import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description: string;
}

export default function SEO({ title, description }: SEOProps) {
    useEffect(() => {
        document.title = title;

        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', description);
        } else {
            const meta = document.createElement('meta');
            meta.name = 'description';
            meta.content = description;
            document.head.appendChild(meta);
        }
    }, [title, description]);

    return null;
}
