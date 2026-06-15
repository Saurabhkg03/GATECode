
import { Inter } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import ClientProviders from "@/components/ClientProviders";
import NavbarWrapper from "@/components/NavbarWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import LayoutWrapper from "@/components/LayoutWrapper";
import NextTopLoader from 'nextjs-toploader';

import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "GATECode",
    description: "Master GATE with GATECode",
};

export const viewport = {
    themeColor: "#09090b",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* 
                  Inline theme script — runs synchronously before first paint.
                  Reads the stored theme from localStorage and applies the 'dark' 
                  class to <html> immediately, preventing the white flash.
                */}
                <script
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`,
                    }}
                />
            </head>
            <body className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-foreground antialiased`} suppressHydrationWarning>
                <NextTopLoader color="#3b82f6" height={1} showSpinner={false} zIndex={1600} />
                <ClientProviders>
                    <ErrorBoundary>
                        <LayoutWrapper>
                            <NavbarWrapper />
                            {children}
                            <Toaster position="bottom-right" richColors />
                        </LayoutWrapper>
                    </ErrorBoundary>
                </ClientProviders>
            </body>
        </html>
    );
}
