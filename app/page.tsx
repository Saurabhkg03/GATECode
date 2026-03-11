import { cookies } from "next/headers";
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { adminDb } from "@/lib/firebaseAdmin";
import { Question } from "@/data/mockData";

export const metadata: Metadata = {
    title: "GATECode",
    description: "Join GATECode to practice verified GATE questions. Track your progress, compete on the leaderboard, and master concepts with AI explanations.",
};

export const revalidate = 0; // Disable static caching for real-time data

export default async function Home() {
    let initialQuestions: Question[] = [];
    let initialBranch = "ece";

    if (adminDb) {
        try {
            const cookieStore = await cookies();
            const branchCookie = cookieStore.get("selectedBranch")?.value;

            if (branchCookie) {
                initialBranch = branchCookie;
            }

            const questionsRef = adminDb
                .collection("questions")
                .doc(initialBranch)
                .collection("questions");

            const snapshot = await questionsRef
                .orderBy("year", "desc")
                .limit(20)
                .get();

            initialQuestions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Question));
        } catch (error) {
            console.error("Error fetching initial questions:", error);
            // Fallback to empty, client will fetch
        }
    }

    return <HomeClient initialQuestions={initialQuestions} initialBranch={initialBranch} />;
}
