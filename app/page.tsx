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

    if (adminDb) {
        try {
            // Default to 'ece' branch or fetch global recent if preferred. 
            // For now, let's fetch recent questions from 'questions/ece/questions' as a default, 
            // or we could fetch from all known branches if we had a combined index.
            // Given the current structure, let's pick a default branch like 'ece' 
            // OR ideally, we should maybe pass correct branch context. 
            // But since this is the landing page, maybe just display general recent questions?
            // The prompt says "Fetch the latest 20 questions".
            // Let's assume 'questions/ece/questions' for now as a safe default or 
            // fetch a mix if possible, but Firestore doesn't easily support cross-collection queries without group indices.
            // Let's stick to ECE for the landing page initial load to be safe and simple.

            const questionsRef = adminDb
                .collection("questions")
                .doc("ece")
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

    return <HomeClient initialQuestions={initialQuestions} />;
}
