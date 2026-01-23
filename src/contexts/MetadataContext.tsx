"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getCache, setCache } from '../utils/cache';

// A map of available branches from your seeder script
const BRANCH_MAP: Record<string, string> = {
  ece: 'ECE',
  cse: 'CSE',
  me: 'ME',
  ce: 'CE',
  ee: 'EE',
  in: 'IN', // Added IN (Instrumentation) just in case, removing if not needed is fine but safer to have generic map
};
// Ensure we use the exact map from the previous file if strict adherence is needed, 
// but the previous file had: ece, cse, me, ce, ee. I will stick to that.
const BRANCH_MAP_STRICT: Record<string, string> = {
  ece: 'ECE',
  cse: 'CSE',
  me: 'ME',
  ce: 'CE',
  ee: 'EE',
};

const DEFAULT_BRANCH = 'ece';
const BRANCH_CACHE_KEY = 'gatecode_selected_branch';
const METADATA_CACHE_TTL = 3600;

export interface BranchMetadata {
  branch: string;
  questionCount: number;
  allQuestionIds: string[];
  subjects: string[];
  topics: string[];
  years: string[];
  tags: string[];
  subjectCounts: Record<string, number>;
  questionTypeCounts: Record<string, number>;
  yearCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  subjectTopicMap: Record<string, string[]>;
  branchSubjectMap: Record<string, string[]>;
  lastUpdated: string;
}

interface MetadataContextType {
  metadata: BranchMetadata | null;
  loading: boolean;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  availableBranches: Record<string, string>;
  questionCollectionPath: string;
  metadataDocPath: string;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export function MetadataProvider({ children }: { children: ReactNode }) {
  const [availableBranches] = useState(BRANCH_MAP_STRICT);

  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    // Check for window existence before accessing localStorage
    if (typeof window !== 'undefined') {
      const savedBranch = localStorage.getItem(BRANCH_CACHE_KEY);
      if (savedBranch && BRANCH_MAP_STRICT[savedBranch]) {
        return savedBranch;
      }
    }
    return DEFAULT_BRANCH;
  });

  const [metadata, setMetadata] = useState<BranchMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const { questionCollectionPath, metadataDocPath } = useMemo(() => {
    return {
      questionCollectionPath: `questions_${selectedBranch}`,
      metadataDocPath: `metadata/${selectedBranch}`,
    };
  }, [selectedBranch]);

  useEffect(() => {
    localStorage.setItem(BRANCH_CACHE_KEY, selectedBranch);
  }, [selectedBranch]);

  useEffect(() => {
    setLoading(true);
    setMetadata(null); // Clear old metadata to prevent stale UI

    const cacheKey = `metadata_${selectedBranch}`;

    // 1. Try Cache
    const cachedData = getCache<BranchMetadata>(cacheKey);
    if (cachedData) {
      console.log(`[MetadataContext] CACHE HIT: Loaded metadata for ${selectedBranch} from cache.`);
      setMetadata(cachedData);
      setLoading(false);
    } else {
      console.log(`[MetadataContext] CACHE MISS: No cache for ${selectedBranch}.`);
    }

    // 2. Subscribe to Firestore updates
    console.log(`[MetadataContext] Subscribing to: ${metadataDocPath}`);
    const metadataRef = doc(db, 'metadata', selectedBranch);

    const unsubscribe = onSnapshot(
      metadataRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BranchMetadata;
          console.log(
            `[MetadataContext] SNAPSHOT: Metadata loaded for ${data.branch.toUpperCase()}. Total Questions: ${data.questionCount}`
          );
          setMetadata(data);
          setCache(cacheKey, data, METADATA_CACHE_TTL);
        } else {
          console.error(
            `[MetadataContext] CRITICAL ERROR: '${metadataDocPath}' document not found!`
          );
          setMetadata(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error(
          `[MetadataContext] FATAL ERROR fetching metadata from '${metadataDocPath}':`,
          error
        );
        setMetadata(null);
        setLoading(false);
      }
    );

    return () => {
      console.log(`[MetadataContext] Unsubscribing from ${metadataDocPath}.`);
      unsubscribe();
    };
  }, [selectedBranch, metadataDocPath]);

  const value = {
    metadata,
    loading,
    selectedBranch,
    setSelectedBranch,
    availableBranches,
    questionCollectionPath,
    metadataDocPath,
  };

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  const context = useContext(MetadataContext);
  if (context === undefined) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
}
