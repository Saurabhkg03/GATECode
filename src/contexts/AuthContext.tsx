"use client";

import { createContext, useContext, useState, ReactNode, useEffect, Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  deleteUser,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, writeBatch, onSnapshot, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../data/mockData';

interface AuthContextType {
  user: FirebaseUser | null;
  userInfo: User | null;
  setUserInfo: Dispatch<SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);

  // --- PREDICTIVE AUTH: Initialize loading based on localStorage ---
  // If 'isLoggedIn' is true in localStorage, start loading as TRUE (expecting user).
  // If 'isLoggedIn' is missing/false, start loading as FALSE (show Landing Page immediately).
  // --- PREDICTIVE AUTH: Initialize loading based on localStorage ---
  // If 'isLoggedIn' is true in localStorage, start loading as TRUE (expecting user).
  // If 'isLoggedIn' is missing/false, start loading as FALSE (show Landing Page immediately).
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    // This outer unsubscribe is for onAuthStateChanged
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth State Changed:", currentUser ? `UID: ${currentUser.uid}, Verified: ${currentUser.emailVerified}` : 'No User');
      setUser(currentUser);

      // --- PREDICTIVE AUTH: Sync localStorage ---
      if (currentUser) {
        localStorage.setItem('isLoggedIn', 'true');
      } else {
        localStorage.removeItem('isLoggedIn');
        setLoading(false); // Stop loading immediately if no user
      }

      // This inner unsubscribe is for onSnapshot
      let unsubscribeSnapshot: () => void = () => { };

      if (currentUser) {
        const isGoogleProvider = currentUser.providerData.some(provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID);

        if (currentUser.emailVerified || isGoogleProvider) {
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);

            // --- MODIFICATION: Use onSnapshot for real-time updates ---
            unsubscribeSnapshot = onSnapshot(userDocRef, (userDocSnap) => {
              if (userDocSnap.exists()) {
                console.log("Real-time user data received:", userDocSnap.data());
                const userData = userDocSnap.data() as User;

                // --- NEW: Ensure new branch-specific fields exist ---
                if (!userData.branchStats) { userData.branchStats = {}; }
                if (!userData.ratings) { userData.ratings = {}; }
                if (!userData.branchActivityCalendar) { userData.branchActivityCalendar = {}; }
                if (!userData.branchStreakData) { userData.branchStreakData = {}; }

                // Ensure old stats exist for migration/safety
                if (!userData.stats) { userData.stats = { attempted: 0, correct: 0, accuracy: 0, subjects: {} }; }
                if (!userData.streakData) { userData.streakData = { currentStreak: 0, lastSubmissionDate: '' }; }
                if (!userData.activityCalendar) { userData.activityCalendar = {}; }

                setUserInfo(userData);

              } else if (isGoogleProvider) {
                // This logic only runs if onSnapshot returns no doc AND it's a Google user.
                // This is a one-time setup for a new Google user.
                console.log("Google user exists in Auth but not Firestore. Creating Firestore doc.");

                (async () => {
                  let usernameToSet = currentUser.email ? currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) : `user_${currentUser.uid.slice(-6)}`;
                  if (usernameToSet.length < 3) usernameToSet = `user_${currentUser.uid.slice(-6)}`;

                  const q = query(collection(db, 'users'), where('username', '==', usernameToSet), limit(1));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                    usernameToSet = `user_${currentUser.uid.slice(-6)}`;
                  }

                  // --- FIXED: Initialize all new branch-specific fields ---
                  const newUser: User = {
                    uid: currentUser.uid,
                    name: currentUser.displayName || 'New User',
                    username: usernameToSet,
                    email: currentUser.email || '',
                    joined: new Date().toISOString(),
                    avatar: currentUser.photoURL || '/user.png',
                    role: 'user',
                    needsSetup: !currentUser.displayName,

                    // Initialize new branch fields
                    ratings: {},
                    branchStats: {},
                    branchActivityCalendar: {},
                    branchStreakData: {},

                    // Initialize old fields for safety (can be removed after migration)
                    stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
                    streakData: { currentStreak: 0, lastSubmissionDate: '' },
                    activityCalendar: {},
                    rating: 0
                  };
                  await setDoc(userDocRef, newUser);
                  setUserInfo(newUser); // Set the new user in state
                })();
              } else {
                console.log("User exists in Auth but not Firestore and is not Google provider. UserInfo not set.");
                setUserInfo(null);
              }
              setLoading(false); // Set loading to false *after* snapshot resolves
            }, (error) => {
              console.error("Error in onSnapshot listener:", error);
              setUserInfo(null);
              setLoading(false);
            });
            // --- END MODIFICATION ---

          } catch (error) {
            console.error("Error setting up user listener:", error);
            setUserInfo(null);
            setLoading(false);
          }
        } else {
          console.log("User email not verified. UserInfo not set.");
          setUserInfo(null); // Clear userInfo if email is not verified
          setLoading(false);
        }
      } else {
        setUserInfo(null); // Clear userInfo if no user
        setLoading(false); // Ensure loading is false if no user
      }

      // Return the snapshot unsubscriber
      return () => {
        console.log("[AuthContext] Unsubscribing from user snapshot.");
        unsubscribeSnapshot();
      };
    });

    // Return the auth state unsubscriber
    return () => {
      console.log("[AuthContext] Unsubscribing from auth state changes.");
      unsubscribeAuth();
    };
  }, []); // Run only once on mount

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Check verification status AFTER successful sign-in
    if (!userCredential.user.emailVerified) {
      // If not verified, sign the user out immediately and throw specific error
      await signOut(auth);
      console.log("Login attempt failed: Email not verified.");
      throw new Error('auth/email-not-verified'); // Throw specific error message
    }
    // --- PREDICTIVE AUTH: Set localStorage on successful login ---
    localStorage.setItem('isLoggedIn', 'true');
    console.log("Login successful, email verified.");
    // No need to set user/userInfo here, onAuthStateChanged handles it
  };

  const signup = async (name: string, username: string, email: string, password: string) => {
    // Create user in Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("User created in Auth:", userCredential.user.uid);
    const uid = userCredential.user.uid;

    let baseUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (baseUsername.length < 3) {
      baseUsername = `user_${uid.slice(-6)}`;
    }

    let usernameExists = true;
    let finalUsername = baseUsername;
    let counter = 1;
    while (usernameExists) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', finalUsername));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        usernameExists = false;
      } else {
        finalUsername = `${baseUsername}_${counter}`;
        counter++;
        console.log(`Username exists, trying: ${finalUsername}`);
      }
    }

    // --- Send verification email ---
    try {
      await sendEmailVerification(userCredential.user);
      console.log("Verification email sent to:", email);
    } catch (verificationError) {
      console.error("Error sending verification email:", verificationError);
      try {
        await deleteUser(userCredential.user);
        console.log("Auth user deleted due to verification email failure.");
      } catch (deleteError) {
        console.error("Failed to delete auth user after verification error:", deleteError);
      }
      throw new Error("Could not send verification email. Please check the email address and try signing up again.");
    }

    // --- Update Auth profile (Display Name) ---
    try {
      await updateProfile(userCredential.user, { displayName: name });
      console.log("Auth profile display name updated.");
    } catch (profileError) {
      console.error("Error updating Auth profile display name:", profileError);
    }

    // --- FIXED: Initialize all new branch-specific fields ---
    const newUser: User = {
      uid: userCredential.user.uid,
      name,
      username: finalUsername,
      email: email,
      joined: new Date().toISOString(),
      avatar: userCredential.user.photoURL || '/user.png',
      role: 'user',
      needsSetup: false, // Set to false as name/username are provided

      // Initialize new branch fields with defaults for all branches so they appear on leaderboard
      ratings: { ece: 0, cse: 0, me: 0, ce: 0, ee: 0 },
      branchRatings: { ece: 1500, cse: 1500, me: 1500, ce: 1500, ee: 1500 },
      branchStats: {},
      branchActivityCalendar: {},
      branchStreakData: {},

      // Initialize old fields for safety
      stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
      streakData: { currentStreak: 0, lastSubmissionDate: '' },
      activityCalendar: {},
      rating: 0
    };
    await setDoc(doc(db, 'users', newUser.uid), newUser);
    console.log("User document created in Firestore for:", newUser.uid);

    // Don't setUserInfo here. Let onAuthStateChanged handle it after verification.
    // Sign the user out immediately after signup to force verification before login
    await signOut(auth);
    console.log("User signed out pending email verification.");
  };

  // --- Added resetPassword function ---
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    console.log("Password reset email sent to:", email);
  };


  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const googleUser = userCredential.user;

    const userDocRef = doc(db, 'users', googleUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.log("Google Sign-in: First time user. Creating Firestore doc.");
      let usernameToSet = googleUser.email ? googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) : `user_${googleUser.uid.slice(-6)}`;
      if (usernameToSet.length < 3) usernameToSet = `user_${googleUser.uid.slice(-6)}`;

      // Check if generated username exists
      let usernameExists = true;
      let finalUsername = usernameToSet;
      let counter = 1;
      while (usernameExists) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', finalUsername));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          usernameExists = false;
        } else {
          finalUsername = `${usernameToSet}_${counter}`;
          counter++;
          console.log(`Username exists, trying: ${finalUsername}`);
        }
      }

      // --- FIXED: Initialize all new branch-specific fields ---
      const newUser: User = {
        uid: googleUser.uid,
        name: googleUser.displayName || 'New User',
        username: finalUsername, // Use the unique username
        email: googleUser.email || '',
        joined: new Date().toISOString(),
        avatar: googleUser.photoURL || '/user.png',
        role: 'user',
        needsSetup: !googleUser.displayName, // Needs setup if no display name from Google

        // Initialize new branch fields with defaults for all branches so they appear on leaderboard
        ratings: { ece: 0, cse: 0, me: 0, ce: 0, ee: 0 },
        branchRatings: { ece: 1500, cse: 1500, me: 1500, ce: 1500, ee: 1500 },
        branchStats: {},
        branchActivityCalendar: {},
        branchStreakData: {},

        // Initialize old fields for safety
        stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
        streakData: { currentStreak: 0, lastSubmissionDate: '' },
        activityCalendar: {},
        rating: 0
      };
      await setDoc(userDocRef, newUser);
      // setUserInfo(newUser); // Let onAuthStateChanged handle this
      console.log("Firestore doc created for Google user:", newUser.uid);
    } else {
      console.log("Google Sign-in: Existing user. Firestore doc exists.");
      // setUserInfo(userDocSnap.data() as User); // Let onAuthStateChanged handle this
    }
  };

  const logout = () => {
    signOut(auth);
    localStorage.removeItem('isLoggedIn'); // --- PREDICTIVE AUTH: Clear key on logout ---
    console.log("User signed out.");
    router.push('/login');
  };

  // Helper function to delete subcollections
  async function deleteCollection(collectionPath: string) {
    const q = query(collection(db, collectionPath));
    const snapshot = await getDocs(q);

    // Use chunks if the collection might be very large
    const MAX_WRITES_PER_BATCH = 500;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      count++;
      if (count === MAX_WRITES_PER_BATCH) {
        await batch.commit();
        batch = writeBatch(db); // Start a new batch
        count = 0;
      }
    }
    // Commit the remaining deletes
    if (count > 0) {
      await batch.commit();
    }
    console.log(`Deleted ${snapshot.size} documents from subcollection: ${collectionPath}`);
  }


  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is currently signed in.");
    }

    try {
      console.log("Attempting to delete account for user:", currentUser.uid);
      // 1. Delete Firestore subcollections first
      await deleteCollection(`users/${currentUser.uid}/submissions`);
      await deleteCollection(`users/${currentUser.uid}/userQuestionData`);
      await deleteCollection(`users/${currentUser.uid}/questionLists`); // Also delete question lists

      // 2. Delete main user document
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userDocRef);
      console.log("Firestore user document and subcollections deleted.");

      // 3. Delete Auth user
      await deleteUser(currentUser);
      console.log("Firebase Auth user deleted.");

      // Clear local state immediately
      setUserInfo(null);
      setUser(null);
      router.push('/');

    } catch (error: any) {
      console.error("Error deleting account:", error);
      // Re-throw the error for the component to handle specific cases like re-authentication
      throw error;
    }
  };


  return (
    <AuthContext.Provider value={{
      user,
      userInfo,
      setUserInfo,
      login,
      signup,
      loginWithGoogle,
      resetPassword, // Added resetPassword
      logout,
      deleteAccount,
      // User is authenticated IF firebase auth user exists AND userInfo is loaded (implies verification for email/pass)
      isAuthenticated: !!user && !!userInfo,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}