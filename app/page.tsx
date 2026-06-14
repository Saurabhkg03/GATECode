import { cookies } from "next/headers";
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { Question } from "@/data/mockData";

export const metadata: Metadata = {
    title: "GATECode",
    description: "Join GATECode to practice verified GATE questions. Track your progress, compete on the leaderboard, and master concepts with AI explanations.",
};

export default async function Home() {
    let initialQuestions: Question[] = [];
    let initialBranch = "ece";

    try {
        const cookieStore = await cookies();
        const branchCookie = cookieStore.get("selectedBranch")?.value;

        if (branchCookie) {
            initialBranch = branchCookie;
        }
    } catch (error) {
        console.error("Error fetching cookie:", error);
    }

    return <HomeClient initialQuestions={initialQuestions} initialBranch={initialBranch} />;
}
