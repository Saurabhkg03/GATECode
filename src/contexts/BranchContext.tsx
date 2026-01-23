import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';

// --- CONFIGURATION ---
// These MUST match the codes used in your seeder (e.g., "ece", "cse")
export const AVAILABLE_BRANCHES = [
  { code: 'ece', name: 'Electronics (ECE)' },
  { code: 'cse', name: 'Computer Sci (CSE)' },
  { code: 'me', name: 'Mechanical (ME)' },
  { code: 'ce', name: 'Civil (CE)' },
  { code: 'ee', name: 'Electrical (EE)' },
];

const DEFAULT_BRANCH_CODE = AVAILABLE_BRANCHES[0].code; // 'ece'

// --- CONTEXT TYPE ---
interface BranchContextType {
  /** The currently active branch code (e.g., "ece") */
  activeBranch: string;
  /** A function to set the new active branch */
  setActiveBranch: (branchCode: string) => void;
  /** The full list of available branch objects */
  availableBranches: typeof AVAILABLE_BRANCHES;
  /** The full object for the currently active branch */
  activeBranchConfig: typeof AVAILABLE_BRANCHES[0];
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

// --- LOCAL STORAGE KEY ---
const BRANCH_STORAGE_KEY = 'gatecode_active_branch';

export function BranchProvider({ children }: { children: ReactNode }) {
  const [activeBranch, setActiveBranchState] = useState<string>(() => {
    // 1. Try to get from localStorage
    const storedBranch = localStorage.getItem(BRANCH_STORAGE_KEY);
    if (storedBranch && AVAILABLE_BRANCHES.some(b => b.code === storedBranch)) {
      return storedBranch;
    }
    // 2. Fallback to default
    return DEFAULT_BRANCH_CODE;
  });

  // This effect syncs state changes back to localStorage
  useEffect(() => {
    localStorage.setItem(BRANCH_STORAGE_KEY, activeBranch);
  }, [activeBranch]);

  // Function to update the branch
  const setActiveBranch = (branchCode: string) => {
    if (AVAILABLE_BRANCHES.some(b => b.code === branchCode)) {
      setActiveBranchState(branchCode);
      console.log(`[BranchContext] Active branch changed to: ${branchCode}`);
    } else {
      console.warn(`[BranchContext] Attempted to set invalid branch: ${branchCode}`);
    }
  };

  // Find the full config object for the active branch
  const activeBranchConfig = useMemo(() => {
    return AVAILABLE_BRANCHES.find(b => b.code === activeBranch) || AVAILABLE_BRANCHES[0];
  }, [activeBranch]);

  const value = {
    activeBranch,
    setActiveBranch,
    availableBranches: AVAILABLE_BRANCHES,
    activeBranchConfig,
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
