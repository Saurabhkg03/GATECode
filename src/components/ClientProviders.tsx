"use client";

import React from "react";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import { DailyChallengeProvider } from "../contexts/DailyChallengeContext";
import { MetadataProvider } from "../contexts/MetadataContext";
import { QueryCacheProvider } from "../contexts/QueryCacheContext";

export default function ClientProviders({
    children,
}: {
    children: React.ReactNode;
}) {
    // Note: BrowserRouter has been removed as Next.js App Router handles routing.
    return (
        <ThemeProvider>
            <AuthProvider>
                <MetadataProvider>
                    <QueryCacheProvider>
                        <DailyChallengeProvider>{children}</DailyChallengeProvider>
                    </QueryCacheProvider>
                </MetadataProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
