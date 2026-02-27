// No changes needed here, but I'm adding a Question type for clarity
// based on your seeder script.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let analytics: any;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, storage, analytics };

// --- Types ---
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
  role?: 'admin' | 'user';
  // Add other user-specific fields

  // NEW RATING FIELDS
  rating?: number; // Defaults to 1500
  highestRating?: number; // Defaults to 1500
  contestCount?: number; // Number of rated contests taken
  ratingHistory?: {
    contestId: string;
    contestTitle: string;
    date: number;
    oldRating: number;
    newRating: number;
    rank: number;
  }[];
}

export interface Option {
  label: string | null;
  text_html: string;
  is_correct: boolean;
}

export interface Question {
  id: string; // Document ID
  scraped_id: string;
  title: string;
  question_html: string;
  question_image_links: string[];
  explanation_html: string;
  explanation_image_links: string[]; // FIXED TYPO: axplanation_ -> explanation_
  explanation_redirect_url?: string | null; // ADDED
  options: Option[];
  correctAnswerLabel: string | null; // For MCQ
  correctAnswerLabels: string[]; // For MSQ
  question_type: 'mcq' | 'msq' | 'nat';
  nat_answer_min: string | null;
  nat_answer_max: string | null;
  year: string;
  subject: string;
  branch: string;
  topic: string;
  tags: string[];
  createdAt: string;
  verified: boolean;
  attempts: number;
  accuracy: number;
}
