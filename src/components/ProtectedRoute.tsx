"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { user, userInfo, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                // Redirect to login, preserving the return URL
                router.push(`/login?returnUrl=${encodeURIComponent(pathname || '/')}`);
            } else if (requireAdmin && userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                // Redirect if not authorized
                router.push('/');
            }
        }
    }, [user, loading, router, pathname, requireAdmin, userInfo]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) {
        return null; // Return null while redirecting
    }

    if (requireAdmin && userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
        return null; // Return null while redirecting
    }

    return <>{children}</>;
}
