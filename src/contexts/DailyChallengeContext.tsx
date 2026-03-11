"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMetadata } from './MetadataContext';

interface DailyChallengeContextType {
  dailyChallengeId: string | null;
  loadingChallenge: boolean;
}

const DailyChallengeContext = createContext<DailyChallengeContextType | undefined>(undefined);

export function DailyChallengeProvider({ children }: { children: ReactNode }) {
  const [dailyChallengeId, setDailyChallengeId] = useState<string | null>(null);

  const { selectedBranch } = useMetadata();
  const [loadingChallenge, setLoadingChallenge] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchChallenge() {
      if (!selectedBranch) return;

      console.log(`[DailyChallenge] Fetching challenge for ${selectedBranch}...`);
      setLoadingChallenge(true);

      try {
        const res = await fetch(`/api/daily-challenge?branch=${selectedBranch}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch daily challenge: ${res.status}`);
        }

        const data = await res.json();

        if (isMounted) {
          if (data.dailyChallengeId) {
            console.log(
              `[DailyChallenge] Branch: ${selectedBranch}, Day ${data.dayOfYear || 'unknown'}, Index ${data.index || 'unknown'}, ID: ${data.dailyChallengeId}`
            );
            setDailyChallengeId(data.dailyChallengeId);
          } else {
            console.warn(`[DailyChallenge] API returned no challenge ID for ${selectedBranch}.`);
            setDailyChallengeId(null);
          }
        }
      } catch (error) {
        console.error(
          `[DailyChallenge] Error fetching daily challenge for ${selectedBranch}:`,
          error
        );
        if (isMounted) {
          setDailyChallengeId(null);
        }
      } finally {
        if (isMounted) {
          setLoadingChallenge(false);
        }
      }
    }

    fetchChallenge();

    return () => {
      isMounted = false;
    };
  }, [selectedBranch]);

  return (
    <DailyChallengeContext.Provider
      value={{ dailyChallengeId, loadingChallenge }}
    >
      {children}
    </DailyChallengeContext.Provider>
  );
}

export function useDailyChallenge() {
  const context = useContext(DailyChallengeContext);
  if (context === undefined) {
    throw new Error('useDailyChallenge must be used within a DailyChallengeProvider');
  }
  return context;
}
