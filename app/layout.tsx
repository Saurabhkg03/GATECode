
import { Inter } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import ClientProviders from "@/components/ClientProviders";
import NavbarWrapper from "@/components/NavbarWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import LayoutWrapper from "@/components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "GATECode",
    description: "Master GATE with GATECode",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-foreground antialiased`}>
                <ClientProviders>
                    <ErrorBoundary>
                        <LayoutWrapper>
                            <NavbarWrapper />
                            {children}
                        </LayoutWrapper>
                    </ErrorBoundary>
                </ClientProviders>
            </body>
        </html>
    );
}
