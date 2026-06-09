"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ExamRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/contests');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    );
}
