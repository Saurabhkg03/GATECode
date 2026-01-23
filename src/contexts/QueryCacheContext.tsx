"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Next.js-like Query Caching Context
 * 
 * Provides a centralized, in-memory cache for:
 * 1. Firestore query results (e.g., question lists)
 * 2. Individual document data (e.g., questions)
 * 3. Filter/Scroll states for persistent navigation
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface QueryCacheContextType {
    // Generic data caching
    getCachedData: <T>(key: string) => T | null;
    setCachedData: <T>(key: string, data: T) => void;
    invalidateCache: (key?: string) => void;

    // Navigation persistence
    getPersistentState: (key: string) => any;
    setPersistentState: (key: string, value: any) => void;
}

const QueryCacheContext = createContext<QueryCacheContextType | undefined>(undefined);

const DEFAULT_TTL = 1000 * 60 * 5; // 5 minutes default

export function QueryCacheProvider({ children }: { children: React.ReactNode }) {
    const [cache, setCache] = useState<Record<string, CacheEntry<any>>>({});
    const persistentState = useRef<Record<string, any>>({});

    const getCachedData = useCallback(<T,>(key: string): T | null => {
        const entry = cache[key];
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > DEFAULT_TTL;
        if (isExpired) {
            console.log(`[QueryCache] Cache for ${key} expired.`);
            return null;
        }

        return entry.data as T;
    }, [cache]);

    const setCachedData = useCallback(<T,>(key: string, data: T) => {
        console.log(`[QueryCache] Caching data for ${key}`);
        setCache(prev => ({
            ...prev,
            [key]: {
                data,
                timestamp: Date.now()
            }
        }));
    }, []);

    const invalidateCache = useCallback((key?: string) => {
        if (key) {
            console.log(`[QueryCache] Invalidating ${key}`);
            setCache(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } else {
            console.log('[QueryCache] Invalidating all');
            setCache({});
        }
    }, []);

    const getPersistentState = useCallback((key: string) => {
        return persistentState.current[key];
    }, []);

    const setPersistentState = useCallback((key: string, value: any) => {
        persistentState.current[key] = value;
    }, []);

    return (
        <QueryCacheContext.Provider value={{
            getCachedData,
            setCachedData,
            invalidateCache,
            getPersistentState,
            setPersistentState
        }}>
            {children}
        </QueryCacheContext.Provider>
    );
}

export function useQueryCache() {
    const context = useContext(QueryCacheContext);
    if (context === undefined) {
        throw new Error('useQueryCache must be used within a QueryCacheProvider');
    }
    return context;
}
