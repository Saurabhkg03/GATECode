"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNavbar } from "@/components/BottomNavbar";
import { cn } from "@/lib/utils";

export default function NavbarWrapper() {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";
    const isExamPage = pathname?.startsWith("/exam");

    if (isExamPage) return null;

    return (
        <>
            <Navbar />
            <div className="md:hidden">
                <BottomNavbar />
            </div>
        </>
    );
}
