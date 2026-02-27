import { NextResponse } from "next/server";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import {
  getNextWeeklyContest,
  getNextBiweeklyContest,
} from "@/utils/contestSchedule";
import { Contest, Question, Section } from "@/types/exam";

const shuffle = <T>(array: T[]) => array.sort(() => Math.random() - 0.5);

// Allowed branches for auto generation
const TARGET_BRANCHES = ["ece", "cse", "me", "ee", "in"];

export async function GET(request: Request) {
  // In production, you would definitely want to secure this endpoint!
  // e.g., using a secret token passed in headers by your cron service.

  try {
    const nextWeekly = getNextWeeklyContest();
    const nextBiweekly = getNextBiweeklyContest();

    const generatedIds: string[] = [];
    const errors: string[] = [];

    // Generate Weekly
    for (const branch of TARGET_BRANCHES) {
      const contestId = `${nextWeekly.id}-${branch}`;
      const exists = await checkContestExists(contestId);

      if (!exists) {
        try {
          await attemptToGenerateContest(
            contestId,
            nextWeekly.id,
            "Weekly",
            branch,
            nextWeekly.startTime,
            nextWeekly.durationMinutes,
          );
          generatedIds.push(contestId);
        } catch (e: any) {
          errors.push(`Failed for ${contestId}: ${e.message}`);
        }
      }
    }

    // Generate Biweekly
    for (const branch of TARGET_BRANCHES) {
      const contestId = `${nextBiweekly.id}-${branch}`;
      const exists = await checkContestExists(contestId);

      if (!exists) {
        try {
          await attemptToGenerateContest(
            contestId,
            nextBiweekly.id,
            "Biweekly",
            branch,
            nextBiweekly.startTime,
            nextBiweekly.durationMinutes,
          );
          generatedIds.push(contestId);
        } catch (e: any) {
          errors.push(`Failed for ${contestId}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({
      message: "Auto-generation complete",
      generated: generatedIds,
      errors,
      nextWeekly: nextWeekly.id,
      nextBiweekly: nextBiweekly.id,
    });
  } catch (error: any) {
    console.error("Auto-generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function checkContestExists(contestId: string): Promise<boolean> {
  const docRef = doc(db, "contests", contestId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}

async function attemptToGenerateContest(
  fullContestId: string,
  baseId: string,
  contestType: string,
  branch: string,
  startTime: Date,
  durationMinutes: number,
) {
  const sourceCollection = `questions_${branch}`;

  let qCol = collection(db, sourceCollection);
  let qSnapshot = await getDocs(qCol);

  if (qSnapshot.empty) {
    // Try subcollection fallback
    qCol = collection(db, `${sourceCollection}/questions`);
    qSnapshot = await getDocs(qCol);
  }

  const allQuestions: Question[] = [];
  qSnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.question_html || data.title) {
      allQuestions.push({
        id: docSnap.id,
        ...data,
        branch: data.branch || branch,
        marks: Number(data.marks) || 1,
        // fallback logic
        negative_marks:
          Number(data.negative_marks) ||
          (Number(data.marks) === 2 ? 0.66 : 0.33),
      } as Question);
    }
  });

  if (allQuestions.length < 5) {
    throw new Error(
      `Insufficient questions in '${sourceCollection}' (Found ${allQuestions.length})`,
    );
  }

  // Simplified fallback selection for automated contests to prevent failure
  const gaQuestions = allQuestions.filter((q) => {
    const sub = (q.subject || "").toLowerCase();
    const br = (q.branch || "").toLowerCase();
    return (
      sub.includes("aptitude") ||
      sub.includes("verbal") ||
      sub.includes("reasoning") ||
      br === "general" ||
      br === "ga"
    );
  });

  const techQuestions = allQuestions.filter(
    (q) =>
      !gaQuestions.includes(q) &&
      (q.branch?.toLowerCase() === branch.toLowerCase() ||
        q.branch === "all" ||
        !q.branch),
  );

  const selectQuestions = (
    pool: Question[],
    target1: number,
    target2: number,
  ) => {
    const q1 = shuffle(pool.filter((q) => q.marks === 1));
    const q2 = shuffle(pool.filter((q) => q.marks === 2));

    const selected1 = q1.slice(0, target1);
    const selected2 = q2.slice(0, target2);

    const usedIds = new Set([...selected1, ...selected2].map((q) => q.id));

    const deficit = target1 + target2 - (selected1.length + selected2.length);
    let fill: Question[] = [];

    if (deficit > 0) {
      const remainingPool = shuffle(pool.filter((q) => !usedIds.has(q.id)));
      fill = remainingPool.slice(0, deficit);
    }

    return [...selected1, ...selected2, ...fill];
  };

  // Standard 65 questions (10 GA, 55 Tech)
  const finalGa = shuffle(selectQuestions(gaQuestions, 5, 5));
  const finalTech = shuffle(selectQuestions(techQuestions, 25, 30));

  const finalSections: Section[] = [
    { name: "General Aptitude", questions: finalGa },
    { name: "Technical", questions: finalTech },
  ];

  const newContest: Contest = {
    id: fullContestId,
    title: `GATE ${branch.toUpperCase()} ${contestType} Contest ${baseId.split("-")[1]}`,
    type: "admin",
    branch: branch,
    createdBy: "system-auto",
    isPublic: true,
    startTime: startTime.toISOString(),
    durationMinutes: durationMinutes,
    totalMarks: 100, // Hardcoded for standard GATE
    sections: finalSections,
    description: `Official ${contestType.toLowerCase()} live contest. Test your rank amongst thousands of peers.`,
  };

  await setDoc(doc(db, "contests", fullContestId), newContest);
}
