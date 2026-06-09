"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfileRedirect() {
    const { user, userInfo, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.replace('/login?returnUrl=/profile');
            } else if (userInfo?.username) {
                router.replace(`/profile/${userInfo.username}`);
            }
        }
    }, [user, userInfo, loading, router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    );
}
