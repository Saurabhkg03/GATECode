
import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
    title: "GATECode - Master GATE with AI-Powered Practice",
    description: "Join GATECode to practice verified GATE questions. Track your progress, compete on the leaderboard, and master concepts with AI explanations.",
};

export default function Home() {
    return <HomeClient />;
}
