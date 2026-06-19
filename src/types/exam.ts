export type QuestionStatus =
    | 'not_visited'
    | 'not_answered'
    | 'answered'
    | 'marked_for_review'
    | 'answered_marked_for_review';

export interface Question {
    id: string;
    title: string;
    question_html: string;
    question_type: 'mcq' | 'msq' | 'nat';
    options?: { label: string; text_html: string; is_correct: boolean }[];
    nat_answer_min?: string;
    nat_answer_max?: string;
    marks: number;
    negative_marks?: number;
    branch?: string;
    subject?: string;
    topic?: string;
    year?: string;
    explanation_html?: string;
    explanation_redirect_url?: string;
    explanation_image_links?: string[];
    question_image_links?: string[];
}

export interface Section {
    name: string;
    // Store full question objects to make the contest self-contained and immutable to original Q changes
    questions: Question[];
}

export interface Contest {
    id: string;
    title: string;
    type?: 'admin' | 'mock';
    branch?: string;
    createdBy?: string;
    isPublic?: boolean;
    isRated?: boolean; // True for Weekly/Biweekly, False for Mocks
    isRatingsProcessed?: boolean; // Set to true once the backend script runs
    startTime?: string; // ISO string
    endTime?: string;   // ISO string — explicit end time (overrides durationMinutes-based calc)
    durationMinutes: number;
    totalMarks?: number;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    sections: Section[];
    description?: string;
    examMode?: 'full' | 'custom';
    targetSubjects?: string[];
    prizes?: { rank: string; prize: string }[];
}

export interface QuestionResponse {
    questionId: string;
    selectedOptions: string[]; // For MCQ/MSQ
    natAnswer?: string | null; // For NAT
    status: QuestionStatus;
    timeSpent: number; // in seconds
    markedAt?: number; // timestamp
}

export interface ContestAttempt {
    id: string;
    contestId: string;
    uid: string;
    startedAt: number; // Server timestamp (millis)
    lastUpdated: number; // timestamp
    timeLeftSeconds: number;
    isSubmitted: boolean;
    submittedAt?: number;

    // Tracking & Anti-cheat
    isPractice: boolean;
    autoSubmitted?: boolean;
    tabSwitchCount?: number;
    tabSwitchViolations?: number[]; // Array of timestamps

    responses: Record<string, QuestionResponse>; // key is questionId
    score?: number; // calculated after submission
}

// Helper to get color for palette
export const getPaletteColor = (status: QuestionStatus): string => {
    switch (status) {
        case 'answered': return 'bg-green-500 text-white';
        case 'not_answered': return 'bg-red-500 text-white';
        case 'marked_for_review': return 'bg-purple-500 text-white';
        case 'answered_marked_for_review': return 'bg-purple-500 relative'; // We'll handle the green dot in the UI component
        case 'not_visited': default: return 'bg-white dark:bg-zinc-800 border text-gray-700 dark:text-gray-300 dark:border-zinc-700';
    }
};
