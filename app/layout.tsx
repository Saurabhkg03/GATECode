
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import ClientProviders from "@/components/ClientProviders";
import NavbarWrapper from "@/components/NavbarWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
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
                    <div className="flex flex-col min-h-screen">
                        {/* Navbar logic: The user wanted conditional hiding on Login. 
                 Since layout wraps everything, we can't easily conditionally hide based on route inside Server Component layout without headers or middleware.
                 However, valid approach is to check path in Client Component or use Route Groups.
                 For simplicity and "Lift and Shift", I'll put Navbars inside ClientProviders or use a Client Wrapper for Navbars. 
                 Wait, ClientProviders wraps everything.
                 Let's put Navbars inside ClientProviders children in layout? No, they need to be inside ClientProviders context to access Auth/Theme potentially.
                 Actually, in App.tsx, Navbar was strictly outside Routes but inside Providers.
                 So I will put them inside ClientProviders.
            */}
                        <NavbarWrapper />
                        <main className="flex-1 relative z-10 pb-16 md:pb-0">
                            {children}
                        </main>
                    </div>
                </ClientProviders>
            </body>
        </html>
    );
}
