"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Contest, ContestAttempt, QuestionResponse, QuestionStatus, Question, Section } from '../types/exam';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// --- Types ---

interface ExamState {
    questions: Question[]; // Flattened list for easy indexing
    sections: Section[];
    currentQuestionIndex: number; // Global index across all sections
    responses: Record<string, QuestionResponse>;
    timeLeft: number; // seconds remaining (live updating)
    startedAt: number; // Server timestamp (millis)
    initialTimeLimit: number; // Allocated duration (seconds)
    timeOffset: number; // Local time minus Server time
    isLoading: boolean;
    isSubmitting: boolean;
    isSubmitted: boolean;
    isTimeUp: boolean; // Flag to show the auto-submit overlay
    error: string | null;
    contest: Contest | null;
    attemptId: string | null;
    isSyncing: boolean;
    tabSwitchCount: number;
    tabSwitchViolations: number[];
}

interface ExamActionBase { type: string; }
type ExamAction =
    | { type: 'INIT_EXAM'; payload: { questions: Question[]; contest: Contest; attempt: ContestAttempt; timeOffset: number } }
    | { type: 'SET_CURRENT_QUESTION'; payload: number }
    | { type: 'MARK_ANSWER'; payload: { questionId: string; selectedOptions: string[]; natAnswer?: string } }
    | { type: 'MARK_REVIEW'; payload: { questionId: string } }
    | { type: 'CLEAR_RESPONSE'; payload: { questionId: string } }
    | { type: 'VISIT_QUESTION'; payload: { questionId: string } }
    | { type: 'TICK_TIMER' }
    | { type: 'SYNC_TIME'; payload: number }
    | { type: 'SET_SUBMITTING'; payload: boolean }
    | { type: 'SET_SUBMITTED' }
    | { type: 'SET_TIME_UP' }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_SYNCING'; payload: boolean }
    | { type: 'RECORD_TAB_SWITCH'; payload: number };

const initialState: ExamState = {
    questions: [],
    sections: [],
    currentQuestionIndex: 0,
    responses: {},
    timeLeft: 0,
    startedAt: 0,
    initialTimeLimit: 0,
    timeOffset: 0,
    isLoading: true,
    isSubmitting: false,
    isSubmitted: false,
    isTimeUp: false,
    error: null,
    contest: null,
    attemptId: null,
    isSyncing: false,
    tabSwitchCount: 0,
    tabSwitchViolations: [],
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
                startedAt: action.payload.attempt.startedAt,
                initialTimeLimit: action.payload.attempt.timeLeftSeconds, // Capture initial
                timeOffset: action.payload.timeOffset || 0,
                attemptId: action.payload.attempt.id,
                isSubmitted: action.payload.attempt.isSubmitted,
                tabSwitchCount: action.payload.attempt.tabSwitchCount || 0,
                tabSwitchViolations: action.payload.attempt.tabSwitchViolations || [],
                isLoading: false,
            };

        case 'SET_SUBMITTED':
            return { ...state, isSubmitted: true, isSubmitting: false, isTimeUp: false };

        case 'SET_TIME_UP':
            return { ...state, isTimeUp: true };

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

        case 'RECORD_TAB_SWITCH':
            return {
                ...state,
                tabSwitchCount: state.tabSwitchCount + 1,
                tabSwitchViolations: [...state.tabSwitchViolations, action.payload]
            };

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
        const controller = new AbortController();

        const startExam = async () => {
            try {
                const forceFresh = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('force_fresh') === 'true';

                await auth.authStateReady();
                const user = auth.currentUser;
                if (!user) {
                    throw new Error("User not authenticated.");
                }
                const token = await user.getIdToken();

                const res = await fetch('/api/exam/start', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ contestId, uid, forceFresh }),
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error("[ExamContext] /api/exam/start failed with status:", res.status);
                    console.error("[ExamContext] Raw response body:", errorText);
                    
                    let errMessage = 'Failed to start exam';
                    try {
                        const errData = JSON.parse(errorText);
                        errMessage = errData.error || errMessage;
                    } catch (e) {
                        console.error("[ExamContext] Could not parse error response as JSON", e);
                    }
                    
                    throw new Error(`Error ${res.status}: ${errMessage}`);
                }

                const data = await res.json();

                // Calculate the clock offset immediately upon receiving response
                const serverTime = data.serverTime || Date.now();
                const offset = Date.now() - serverTime;

                let restoredResponses = data.attempt.responses || {};
                let restoredTime = data.attempt.timeLeftSeconds;

                // NOTE: We now use attempt.id for the backup key to prevent bleeding
                // between different practice attempts of the same contest.
                let didRestoreFromLocal = false;

                if (!forceFresh && data.attempt.id) {
                    const localKey = `exam_backup_${data.attempt.id}`;
                    const localDataStr = typeof window !== 'undefined' ? localStorage.getItem(localKey) : null;
                    if (localDataStr) {
                        try {
                            const localData = JSON.parse(localDataStr);
                            const localKeysCount = Object.keys(localData || {}).length;
                            const remoteKeysCount = Object.keys(restoredResponses).length;
                            // Merge local responses into restored responses by timestamp
                            const allKeys = new Set([...Object.keys(localData || {}), ...Object.keys(restoredResponses)]);
                            const merged: any = {};
                            
                            allKeys.forEach(key => {
                                const localQ = localData[key];
                                const remoteQ = restoredResponses[key];
                                
                                if (localQ && !remoteQ) {
                                    merged[key] = localQ;
                                } else if (!localQ && remoteQ) {
                                    merged[key] = remoteQ;
                                } else {
                                    // Both exist, compare markedAt
                                    const localTime = localQ.markedAt || 0;
                                    const remoteTime = remoteQ.markedAt || 0;
                                    merged[key] = localTime >= remoteTime ? localQ : remoteQ;
                                }
                            });
                            
                            restoredResponses = merged;

                            // If local had more or different data, we consider it a restore event
                            if (localKeysCount > 0 && JSON.stringify(restoredResponses) !== JSON.stringify(data.attempt.responses)) {
                                didRestoreFromLocal = true;
                            }
                        } catch (e) {
                            console.error("Failed to parse local backup", e);
                        }
                    }
                } else {
                    // Force Fresh ignores localData.
                }

                dispatch({
                    type: 'INIT_EXAM', payload: {
                        questions: data.questions,
                        contest: data.contest,
                        attempt: {
                            ...data.attempt,
                            responses: restoredResponses,
                            // Use raw original time limit strictly, not decremented local-saved time
                            timeLeftSeconds: data.attempt.timeLeftSeconds
                        },
                        timeOffset: offset
                    }
                });

                if (didRestoreFromLocal) {
                    console.log("[Resiliency] Restored offline responses from localStorage. Triggering background sync...");
                    // Give state a tiny moment to flush, then force a sync
                    setTimeout(() => triggerSync(), 1000);
                }

            } catch (err: any) {
                if (err.name === 'AbortError') return; // Ignore — React StrictMode cleanup
                dispatch({ type: 'SET_ERROR', payload: err.message });
            }
        };

        if (uid && contestId) {
            startExam();
        }

        return () => controller.abort();
    }, [contestId, uid]);

    // 2. Timer (Absolute Offset-Based Drift Proof)
    useEffect(() => {
        if (state.isLoading || state.isSubmitted || !state.contest || !state.startedAt) return;

        // The absolute server deadline timestamp
        const absoluteDeadlineMs = state.startedAt + (state.initialTimeLimit * 1000);

        const timer = setInterval(() => {
            // Find current time normalized to server time
            const currentTrueTime = Date.now() - state.timeOffset;
            const remainingMs = absoluteDeadlineMs - currentTrueTime;

            const secondsLeft = Math.max(0, Math.floor(remainingMs / 1000));

            if (secondsLeft <= 0) {
                // Time's up!
                dispatch({ type: 'SYNC_TIME', payload: 0 });
                dispatch({ type: 'SET_TIME_UP' });
                clearInterval(timer);

                // Trigger submission immediately if not already submitting
                if (!stateRef.current.isSubmitted && !stateRef.current.isSubmitting) {
                    submitExam();
                }
            } else {
                // Throttle updates locally if needed, but here we just tick exactly what's remaining.
                if (stateRef.current.timeLeft !== secondsLeft) {
                    dispatch({ type: 'SYNC_TIME', payload: secondsLeft });
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [state.isLoading, state.isSubmitted, state.contest, state.startedAt, state.initialTimeLimit, state.timeOffset]);

    // 3. Auto-Submit on Timeout
    useEffect(() => {
        if (!state.isLoading && state.timeLeft === 0 && !state.isSubmitted && state.contest) {
            submitExam();
        }
    }, [state.timeLeft]);

    // 4. Aggressive Caching (Debounced LocalStorage)
    useEffect(() => {
        if (!state.attemptId || state.isSubmitted) return;

        const timeoutId = setTimeout(() => {
            if (typeof window !== 'undefined') {
                // Strictly backup only the responses map keyed by attemptId
                const localKey = `exam_backup_${state.attemptId}`;
                try {
                    localStorage.setItem(localKey, JSON.stringify(state.responses));
                } catch (e) {
                    console.warn('LocalStorage full, clearing old backups');
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('exam_backup_') && key !== localKey) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    
                    try {
                        localStorage.setItem(localKey, JSON.stringify(state.responses));
                    } catch (e2) {
                        console.error('Failed to save to LocalStorage even after cleanup', e2);
                    }
                }
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [state.responses, state.attemptId, state.isSubmitted]);

    // 5. Background Sync & Retry Logic
    const syncToFirestore = useCallback(async () => {
        const attemptId = stateRef.current.attemptId;
        const responses = stateRef.current.responses;
        const accurateTimeLeft = stateRef.current.timeLeft;
        const tabSwitchCount = stateRef.current.tabSwitchCount;
        const tabSwitchViolations = stateRef.current.tabSwitchViolations;

        if (!attemptId) return;

        dispatch({ type: 'SET_SYNCING', payload: true });

        try {
            const cleanResponses = JSON.parse(JSON.stringify(responses));
            await auth.authStateReady();
            const user = auth.currentUser;
            if (!user) {
                throw new Error("User not authenticated.");
            }
            const token = await user.getIdToken();

            const res = await fetch('/api/exam/autosave', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    uid,
                    attemptId,
                    responses: cleanResponses,
                    tabSwitchCount,
                    tabSwitchViolations
                }),
            });

            if (!res.ok) {
                 throw new Error("Autosave failed");
            }

            dispatch({ type: 'SYNC_TIME', payload: accurateTimeLeft });
            dispatch({ type: 'SET_SYNCING', payload: false });

            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        } catch (error) {
            console.error("Sync failed, queuing retry...", error);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = setTimeout(() => {
                syncToFirestore();
            }, 5000);
        }
    }, [uid]);

    // Trigger sync periodically or manually
    useEffect(() => {
        const syncInterval = setInterval(() => {
            if (!state.isSubmitted && !state.isLoading) {
                syncToFirestore();
            }
        }, 25000); // 25s periodic sync
        return () => clearInterval(syncInterval);
    }, [syncToFirestore, state.isSubmitted, state.isLoading]);

    const triggerSync = useCallback(() => {
        setTimeout(() => syncToFirestore(), 0);
    }, [syncToFirestore]);

    // 7. Tab Switching Detection (Proctoring)
    useEffect(() => {
        if (!state.attemptId || state.isSubmitted || state.isLoading) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                dispatch({ type: 'RECORD_TAB_SWITCH', payload: Date.now() });
                console.warn('[Proctoring] Tab switched or window minimized');
                // Force an autosave right when they hide the tab
                triggerSync();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [state.attemptId, state.isSubmitted, state.isLoading, triggerSync]);

    // 6. Reliable Submission (Beacon API)
    const submitExam = async () => {
        if (stateRef.current.isSubmitting) return;

        // Prevent submission if no attempt ID
        if (!stateRef.current.attemptId) {
            console.error("No attempt ID found during submission");
            return;
        }

        dispatch({ type: 'SET_SUBMITTING', payload: true });

        // Final time left is cleanly pulled from our state ref
        const finalTimeLeft = stateRef.current.timeLeft;

        const payload = {
            responses: stateRef.current.responses,
            timeLeftSeconds: finalTimeLeft,
            isSubmitted: true,
            submittedAt: Date.now(),
            lastUpdated: Date.now(),
            contestId: contestId,
            uid: uid,
            attemptId: stateRef.current.attemptId
        };

        const url = '/api/exam/submit';

        // Use standard fetch instead of sendBeacon for reliable awaiting
        try {
            await auth.authStateReady();
            const user = auth.currentUser;
            if (!user) {
                throw new Error("User not authenticated.");
            }
            const token = await user.getIdToken();

            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                // Optimistic clean up
                if (typeof window !== 'undefined') {
                    // Remove the actual backup key used during the session
                    localStorage.removeItem(`exam_backup_${stateRef.current.attemptId}`);
                    // Also clean up any legacy keys
                    localStorage.removeItem(`gate_exam_progress_${contestId}`);
                    localStorage.removeItem(`exam_target_time_${contestId}_${uid}`);
                }
                dispatch({ type: 'SET_SUBMITTED' });
                window.location.href = `/exam/${contestId}/result?attemptId=${stateRef.current.attemptId}`;
            } else {
                throw new Error("Server returned non-ok status");
            }
        } catch (e) {
            console.error("Submission failed", e);
            dispatch({ type: 'SET_SUBMITTING', payload: false });
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
