"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Contest, ContestAttempt, QuestionResponse, QuestionStatus, Question, Section } from '../types/exam';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// --- Types ---

interface ExamState {
    questions: Question[]; // Flattened list for easy indexing
    sections: Section[];
    currentQuestionIndex: number; // Global index across all sections
    responses: Record<string, QuestionResponse>;
    timeLeft: number; // seconds
    isLoading: boolean;
    isSubmitting: boolean;
    isSubmitted: boolean;
    error: string | null;
    contest: Contest | null;
    attemptId: string | null;
    isSyncing: boolean;
}

interface ExamActionBase { type: string; }
type ExamAction =
    | { type: 'INIT_EXAM'; payload: { questions: Question[]; contest: Contest; attempt: ContestAttempt } }
    | { type: 'SET_CURRENT_QUESTION'; payload: number }
    | { type: 'MARK_ANSWER'; payload: { questionId: string; selectedOptions: string[]; natAnswer?: string } }
    | { type: 'MARK_REVIEW'; payload: { questionId: string } }
    | { type: 'CLEAR_RESPONSE'; payload: { questionId: string } }
    | { type: 'VISIT_QUESTION'; payload: { questionId: string } }
    | { type: 'TICK_TIMER' }
    | { type: 'SYNC_TIME'; payload: number }
    | { type: 'SET_SUBMITTING'; payload: boolean }
    | { type: 'SET_SUBMITTED' }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_SYNCING'; payload: boolean };

const initialState: ExamState = {
    questions: [],
    sections: [],
    currentQuestionIndex: 0,
    responses: {},
    timeLeft: 0,
    isLoading: true,
    isSubmitting: false,
    isSubmitted: false,
    error: null,
    contest: null,
    attemptId: null,
    isSyncing: false,
};

// --- Reducer ---

function examReducer(state: ExamState, action: ExamAction): ExamState {
    switch (action.type) {
        case 'INIT_EXAM':
            return {
                ...state,
                questions: action.payload.questions,
                contest: action.payload.contest,
                sections: action.payload.contest.sections,
                responses: action.payload.attempt.responses || {},
                timeLeft: action.payload.attempt.timeLeftSeconds,
                attemptId: action.payload.attempt.id,
                isSubmitted: action.payload.attempt.isSubmitted,
                isLoading: false,
            };

        case 'SET_SUBMITTED':
            return { ...state, isSubmitted: true, isSubmitting: false };

        case 'SET_CURRENT_QUESTION':
            return { ...state, currentQuestionIndex: action.payload };

        case 'VISIT_QUESTION': {
            const { questionId } = action.payload;
            const prevResponse = state.responses[questionId];

            // If already has a status, don't revert to "not_answered" unless it was "not_visited"
            // "not_visited" (White) -> "not_answered" (Red)
            if (!prevResponse || prevResponse.status === 'not_visited') {
                return {
                    ...state,
                    responses: {
                        ...state.responses,
                        [questionId]: {
                            questionId,
                            selectedOptions: [],
                            status: 'not_answered', // Visited but not answered (Red)
                            timeSpent: prevResponse?.timeSpent || 0,
                            markedAt: Date.now(),
                        },
                    },
                };
            }
            return state;
        }

        case 'MARK_ANSWER': {
            const { questionId, selectedOptions, natAnswer } = action.payload;
            const prevResponse = state.responses[questionId];

            // Determine if there is a valid answer
            // Note: natAnswer might be '0' or '-' which are truthy strings. Empty string is falsy.
            const hasAnswer = (selectedOptions && selectedOptions.length > 0) || (natAnswer !== undefined && natAnswer !== null && natAnswer.trim() !== '');

            // Check previous review status
            const wasReview = prevResponse?.status === 'marked_for_review' || prevResponse?.status === 'answered_marked_for_review';

            let newStatus: QuestionStatus;

            if (wasReview) {
                // If in review mode, toggle between Answered+Marked and Marked(Empty)
                newStatus = hasAnswer ? 'answered_marked_for_review' : 'marked_for_review';
            } else {
                // If normal mode, toggle between Answered and Not Answered
                newStatus = hasAnswer ? 'answered' : 'not_answered';
            }

            return {
                ...state,
                responses: {
                    ...state.responses,
                    [questionId]: {
                        ...prevResponse,
                        questionId,
                        selectedOptions,
                        natAnswer,
                        status: newStatus,
                        timeSpent: (prevResponse?.timeSpent || 0),
                        markedAt: Date.now(),
                    },
                },
            };
        }

        case 'MARK_REVIEW': {
            const qId = action.payload.questionId;
            const currentResp = state.responses[qId];

            // Strict GATE Logic:
            // If the user has selected an option (or typed NAT answer), status = 'answered_marked_for_review'
            // If no option selected, status = 'marked_for_review'
            // We do NOT toggle back to 'answered' or 'not_answered' here. 
            // The "Mark for Review" button always sets a Review state.
            // To remove review status, one would typically "Unmark" or just "Save & Next" (which sets to Answered).

            // However, typical GATE interface:
            // "Mark for Review & Next" button -> Sets Review state and moves next.
            // "Save & Next" button -> Sets Answered state (if answered) and moves next.

            // So this action matches "Mark for Review & Next".

            const hasAnswer = (currentResp?.selectedOptions && currentResp.selectedOptions.length > 0) ||
                (currentResp?.natAnswer && currentResp.natAnswer.trim() !== '');

            const nextStatus: QuestionStatus = hasAnswer ? 'answered_marked_for_review' : 'marked_for_review';

            return {
                ...state,
                responses: {
                    ...state.responses,
                    [qId]: {
                        ...currentResp,
                        questionId: qId,
                        status: nextStatus,
                        selectedOptions: currentResp?.selectedOptions || [],
                        natAnswer: currentResp?.natAnswer,
                        timeSpent: currentResp?.timeSpent || 0,
                        markedAt: Date.now()
                    }
                }
            };
        }

        case 'CLEAR_RESPONSE': {
            const qId = action.payload.questionId;
            return {
                ...state,
                responses: {
                    ...state.responses,
                    [qId]: {
                        questionId: qId,
                        status: 'not_answered', // Goes back to Visited (Red)
                        selectedOptions: [],
                        natAnswer: null, // undefined is fine for local state, but sanitizer handles it for DB
                        timeSpent: state.responses[qId]?.timeSpent || 0
                    }
                }
            };
        }

        case 'TICK_TIMER':
            return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };

        case 'SYNC_TIME':
            return { ...state, timeLeft: Math.max(0, action.payload) };

        case 'SET_SUBMITTING':
            return { ...state, isSubmitting: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };

        case 'SET_SYNCING':
            return { ...state, isSyncing: action.payload };

        default:
            return state;
    }
}

// --- Context ---

const ExamContext = createContext<{
    state: ExamState;
    dispatch: React.Dispatch<ExamAction>;
    submitExam: () => Promise<void>;
    triggerSync: () => void;
    clearError: () => void;
} | undefined>(undefined);

export const ExamProvider: React.FC<{ children: React.ReactNode; contestId: string; uid: string }> = ({
    children, contestId, uid
}) => {
    const [state, dispatch] = useReducer(examReducer, initialState);

    // Ref to hold the latest state for async operations (to avoid stale closures in timeouts/intervals)
    const stateRef = React.useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Retry Queue Ref
    const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // 1. Initial Fetch and Rehydration
    useEffect(() => {
        const startExam = async () => {
            try {
                const res = await fetch('/api/exam/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contestId, uid }),
                });

                if (!res.ok) throw new Error('Failed to start exam');

                const data = await res.json();

                // Aggressive Rehydration: Check LocalStorage
                // Key format: gate_exam_progress_${contestId}
                const localKey = `gate_exam_progress_${contestId}`;
                const localDataStr = typeof window !== 'undefined' ? localStorage.getItem(localKey) : null;

                let restoredResponses = data.attempt.responses || {};
                let restoredTime = data.attempt.timeLeftSeconds;

                if (localDataStr) {
                    try {
                        const localData = JSON.parse(localDataStr);
                        // If we have a valid timestamp, check if local is fresher
                        // Logic: If local has MORE answers or is more recent? 
                        // Simple logic: Merge. Local overwrites server for same Type.
                        restoredResponses = { ...restoredResponses, ...localData.responses };
                        // Prefer the minimum time left to prevent cheating by clearing cache? 
                        // Actually, taking the MIN is safer for the exam integrity.
                        // But if user was offline, local time might be correct. 
                        // Let's trust local time if it's reasonable (not greater than server time + margin).
                        // For now, use the server time for critical integrity, but responses from local.
                    } catch (e) {
                        console.error("Failed to parse local backup", e);
                    }
                }

                dispatch({
                    type: 'INIT_EXAM', payload: {
                        questions: data.questions,
                        contest: data.contest,
                        attempt: {
                            ...data.attempt,
                            responses: restoredResponses,
                            timeLeftSeconds: restoredTime
                        }
                    }
                });

            } catch (err: any) {
                dispatch({ type: 'SET_ERROR', payload: err.message });
            }
        };

        if (uid && contestId) {
            startExam();
        }
    }, [contestId, uid]);

    // 2. Timer (Delta-Based Drift Proof)
    // 2. Timer (Drift-Proof "Delta" Calculation)
    useEffect(() => {
        if (state.isLoading || state.isSubmitted || !state.contest) return;

        const TARGET_TIME_KEY = `exam_target_time_${contestId}_${uid}`;

        // 1. Initialize or Retrieve Target Time
        let targetEndTime = parseInt(localStorage.getItem(TARGET_TIME_KEY) || '0');

        // If invalid or in the past (and we have time remaining), calculate new target
        // We trust the server's "timeLeft" on initial load/rehydration
        if (!targetEndTime || targetEndTime < Date.now()) {
            // Buffer: current time + remaining seconds
            targetEndTime = Date.now() + (state.timeLeft * 1000);
            localStorage.setItem(TARGET_TIME_KEY, targetEndTime.toString());
        }

        const timer = setInterval(() => {
            const now = Date.now();
            const diff = targetEndTime - now;

            // Calculate exact seconds remaining
            const secondsLeft = Math.floor(diff / 1000);

            if (secondsLeft <= 0) {
                // Time's up!
                dispatch({ type: 'SYNC_TIME', payload: 0 });
                clearInterval(timer);

                // Trigger submission immediately if not already submitting
                if (!stateRef.current.isSubmitted && !stateRef.current.isSubmitting) {
                    submitExam();
                }
            } else {
                // Update UI
                // Only dispatch if necessary (optional optimization, but React handles it well)
                dispatch({ type: 'SYNC_TIME', payload: secondsLeft });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [state.isLoading, state.isSubmitted, state.contest, contestId, uid]);

    // 3. Auto-Submit on Timeout
    useEffect(() => {
        if (!state.isLoading && state.timeLeft === 0 && !state.isSubmitted && state.contest) {
            submitExam();
        }
    }, [state.timeLeft]);

    // 4. Aggressive Caching (Debounced LocalStorage)
    useEffect(() => {
        if (!state.attemptId) return;

        const timeoutId = setTimeout(() => {
            if (typeof window !== 'undefined') {
                const localKey = `gate_exam_progress_${contestId}`;
                const payload = {
                    responses: state.responses,
                    timeLeft: state.timeLeft,
                    lastUpdated: Date.now()
                };
                localStorage.setItem(localKey, JSON.stringify(payload));
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [state.responses, state.timeLeft, state.attemptId, contestId]);

    // 5. Background Sync & Retry Logic
    const syncToFirestore = useCallback(async () => {
        const attemptId = stateRef.current.attemptId;
        const responses = stateRef.current.responses;
        const timeLeft = stateRef.current.timeLeft;

        if (!attemptId) return;

        dispatch({ type: 'SET_SYNCING', payload: true });

        try {
            const attemptRef = doc(db, 'contest_attempts', attemptId);
            // Sanitize undefineds
            const cleanResponses = JSON.parse(JSON.stringify(responses));

            await updateDoc(attemptRef, {
                responses: cleanResponses,
                timeLeftSeconds: timeLeft,
                lastUpdated: Date.now()
            });

            dispatch({ type: 'SET_SYNCING', payload: false });

            // Clear any pending retries if success
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

        } catch (error) {
            console.error("Sync failed, queuing retry...", error);
            // Don't set syncing to false, maybe? Or keep it true to show "Offline"?
            // Requirement says: Show "Syncing..." or "Offline"
            // If we keep isSyncing=true, it indicates pending work.

            // Queue retry in 5 seconds
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = setTimeout(() => {
                syncToFirestore();
            }, 5000);
        }
    }, []);

    // Trigger sync periodically or manually
    useEffect(() => {
        const syncInterval = setInterval(() => {
            if (!state.isSubmitted && !state.isLoading) {
                syncToFirestore();
            }
        }, 10000); // 10s periodic sync
        return () => clearInterval(syncInterval);
    }, [syncToFirestore, state.isSubmitted, state.isLoading]);

    const triggerSync = () => {
        // Debounce slightly to allow state to settle if called immediately after dispatch
        setTimeout(() => syncToFirestore(), 0);
    };

    // 6. Reliable Submission (Beacon API)
    const submitExam = async () => {
        if (stateRef.current.isSubmitting) return;

        // Prevent submission if no attempt ID
        if (!stateRef.current.attemptId) {
            console.error("No attempt ID found during submission");
            return;
        }

        dispatch({ type: 'SET_SUBMITTING', payload: true });

        const payload = {
            responses: stateRef.current.responses,
            timeLeftSeconds: stateRef.current.timeLeft,
            isSubmitted: true,
            submittedAt: Date.now(),
            lastUpdated: Date.now(),
            contestId: contestId,
            uid: uid,
            attemptId: stateRef.current.attemptId
        };

        // Beacon API Logic
        const url = '/api/exam/submit';
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

        let sent = false;
        if (navigator.sendBeacon) {
            sent = navigator.sendBeacon(url, blob);
        }

        if (!sent) {
            // Fallback to fetch with keepalive
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true
                });
                sent = true;
            } catch (e) {
                console.error("Fetch fallback failed", e);
            }
        }

        if (sent) {
            // Optimistic clean up
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`gate_exam_progress_${contestId}`);
            }
            dispatch({ type: 'SET_SUBMITTED' });
            window.location.href = `/exam/${contestId}/result`;
        } else {
            dispatch({ type: 'SET_SUBMITTING', payload: false });
            // Instead of native alert, we set error state which will be picked up by UI
            dispatch({ type: 'SET_ERROR', payload: "Submission failed. Please check your internet connection and try again." });
        }
    };

    const clearError = () => dispatch({ type: 'SET_ERROR', payload: null });

    return (
        <ExamContext.Provider value={{ state, dispatch, submitExam, triggerSync, clearError }}>
            {children}
        </ExamContext.Provider>
    );
};

export const useExam = () => {
    const context = useContext(ExamContext);
    if (!context) throw new Error("useExam must be used within ExamProvider");
    return context;
};
