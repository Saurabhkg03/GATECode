"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLiveExamPage = pathname?.endsWith("/live");

    return (
        <div className={cn(
            "flex flex-col min-h-screen",
            isLiveExamPage && "overflow-hidden h-screen"
        )}>
            <main className={cn(
                "flex-1 relative z-10",
                !pathname?.includes("/exam") && "pb-16 md:pb-0"
            )}>
                {children}
            </main>
        </div>
    );
}
