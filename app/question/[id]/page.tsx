import type { Metadata } from "next";
import QuestionClient from "./QuestionClient";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { Question } from "@/data/mockData";
import { adminDb } from "@/lib/firebaseAdmin";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;

    // Default metadata
    let title = `Question ${id} | GATE Code`;
    let description = `Practice question ${id} on GATE Code.`;

    // Collections to check in order (default first, then branches)
    const collectionsToCheck = [
        'questions', // Main/Default
        'questions_ece',
        'questions_cse',
        'questions_me',
        'questions_ce',
        'questions_ee',
        'questions_in'
    ];

    try {
        let data: Question | undefined;

        if (adminDb) {
            // Preferred: Use Admin SDK (Bypasses Firestore Rules)
            for (const colName of collectionsToCheck) {
                try {
                    const docRef = adminDb.collection(colName).doc(id);
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        data = { id: docSnap.id, ...docSnap.data() } as Question;
                        break; // Found it!
                    }
                } catch (adminError) {
                    console.warn(`[SEO] Admin fetch failed for ${colName}/${id}:`, adminError);
                }
            }
        }

        if (!data) {
            // Fallback: Use Client SDK (Subject to Rules)
            for (const colName of collectionsToCheck) {
                try {
                    const questionRef = doc(db, colName, id);
                    const questionSnap = await getDoc(questionRef);
                    if (questionSnap.exists()) {
                        data = questionSnap.data() as Question;
                        break; // Found it!
                    }
                } catch (e) {
                    // Ignore fallback errors usually
                }
            }
        }

        if (data) {
            title = `${data.title} | GATE Code`;
            description = `Solve this GATE question on ${data.subject || 'GATE Code'}.`;
        } else {
            console.warn(`[SEO] Question ${id} not found in any known collection.`);
        }

    } catch (e: any) {
        // Suppress the full stack trace for permission errors to avoid cluttering logs
        if (e?.code === 'permission-denied' || e?.message?.includes('Missing or insufficient permissions')) {
            console.warn(`[SEO] metadata fetch skipped for question ${id}: Firestore permission denied. (Enable public read or use firebase-admin)`);
        } else {
            console.warn("[SEO] metadata fetch failed:", e);
        }
    }

    return {
        title,
        description,
    };
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <QuestionClient id={id} />;
}
