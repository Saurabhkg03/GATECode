"use client";

import React from "react";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import { DailyChallengeProvider } from "../contexts/DailyChallengeContext";
import { MetadataProvider } from "../contexts/MetadataContext";
import QueryProvider from "../providers/QueryProvider";

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
                    <QueryProvider>
                        <DailyChallengeProvider>{children}</DailyChallengeProvider>
                    </QueryProvider>
                </MetadataProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
