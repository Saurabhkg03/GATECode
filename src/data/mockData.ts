export interface Question {
  id: string; // The document ID from Firestore
  qIndex?: number; // --- *** NEW: ADDED FOR NUMERICAL SORTING *** ---
  title: string;
  subject: string;
  topic: string;
  question_html: string;
  question_image_links?: string[];
  explanation_html: string;
  explanation_image_links?: string[];
  explanation_redirect_url?: string | null; // For GateOverflow links
  options: {
    label: string;
    text_html: string;
    is_correct: boolean;
  }[];
  correctAnswerLabel?: string | null; // For MCQ
  correctAnswerLabels?: string[]; // For MSQ
  // difficulty: 'Easy' | 'Medium' | 'Hard'; // REMOVED: No longer in use
  year: string;
  source?: string;
  createdAt?: string;
  tags: string[];
  accuracy?: number;
  attempts?: number;
  question_type: 'mcq' | 'nat' | 'msq';
  nat_answer_min?: string | null; // For NAT ranges
  nat_answer_max?: string | null; // For NAT ranges
  verified: boolean;
  addedBy?: string;
  branch: string; // To know which branch this question belongs to
}

// --- NEW: Branch-specific stat sub-types ---
export interface UserStats {
  attempted: number;
  correct: number;
  accuracy: number;
  // Pre-calculated map of { [subjectName]: count }
  subjects: Record<string, number>;
}

export interface UserStreakData {
  currentStreak: number;
  lastSubmissionDate: string; // ISO date string 'YYYY-MM-DD'
}

// Represents the data structure in the 'users/{uid}' document
export interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  joined: string;
  avatar?: string;
  role?: 'admin' | 'moderator' | 'user';
  needsSetup?: boolean;
  
  // --- NEW: Branch-keyed objects ---
  // e.g., { ece: 1500, cse: 1450 }
  ratings: Record<string, number>;
  
  // e.g., { ece: { attempted: 10, ... }, cse: { attempted: 5, ... } }
  branchStats: Record<string, UserStats>;
  
  // e.g., { ece: { '2024-01-01': 5, ... }, cse: { ... } }
  branchActivityCalendar: Record<string, Record<string, number>>;
  
  // e.g., { ece: { currentStreak: 5, ... }, cse: { ... } }
  branchStreakData: Record<string, UserStreakData>;


  // --- DEPRECATED: Old global stats (we'll migrate away from these) ---
  stats?: {
    attempted: number;
    correct: number;
    accuracy: number;
    subjects?: Record<string, number>;
  };
  activityCalendar?: Record<string, number>;
  streakData?: {
    currentStreak: number;
    lastSubmissionDate: string;
  };
  rating?: number; 
}

// Represents a document in 'users/{uid}/submissions'
export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string; // ISO string
  selectedOptions: string[]; // Always an array
  natAnswer?: string;
  timeTaken?: number;
  branch: string; // --- NEW: Record which branch this submission was for ---
}

// Represents a document in 'users/{uid}/userQuestionData'
export interface UserQuestionData {
  isFavorite?: boolean;
  note?: string;
  savedListIds?: string[];
}

// Represents a document in 'users/{uid}/questionLists'
export interface QuestionList {
  id: string; // Firestore document ID
  uid: string; // Owner's UID
  name: string;
  questionIds: string[]; // Array of question IDs
  createdAt: string; // ISO string or Firestore Timestamp
  isPrivate?: boolean;
}
