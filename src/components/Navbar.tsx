"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, LogOut, User, Shield, Settings, ChevronDown, Flame, BookCopy } from 'lucide-react';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyChallenge } from '@/contexts/DailyChallengeContext';
import { useMetadata } from '@/contexts/MetadataContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// --- Branch Selector Component ---
const BranchSelector = () => {
  const { selectedBranch, setSelectedBranch, availableBranches, loading } = useMetadata();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse">
        <BookCopy className="w-4 h-4 text-zinc-400" />
        <div className="h-4 w-12 rounded bg-zinc-400/50"></div>
        <ChevronDown className="w-5 h-5 text-zinc-400" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-8 gap-2 px-3 font-normal text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
        >
          <BookCopy className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">
            {availableBranches[selectedBranch] || 'Select'}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-500 alpha-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Select Branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(availableBranches).map(([key, name]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setSelectedBranch(key)}
            className={cn(
              "cursor-pointer",
              selectedBranch === key && "bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-zinc-100"
            )}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// --- Nav Link Component ---
const NavLinkItem = ({ to, label, icon }: { to: string, label: string, icon?: React.ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === to;

  return (
    <Link
      href={to}
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-full z-10",
        isActive ? "text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      )}
    >
      {icon}
      {label}
    </Link>
  );
};

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { userInfo, logout, isAuthenticated } = useAuth();
  const { selectedBranch } = useMetadata();
  const streak = (userInfo?.branchStreakData?.[selectedBranch] || userInfo?.streakData)?.currentStreak || 0;
  const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GATECode Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-xl tracking-tight">GATECode</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
            <NavLinkItem to="/" label="Home" />
            <NavLinkItem to="/practice" label="Practice" />
            <NavLinkItem to="/leaderboard" label="Leaderboard" />
            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
              <NavLinkItem to="/admin" label="Admin" icon={<Shield className="w-3.5 h-3.5" />} />
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            <BranchSelector />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full w-9 h-9 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hidden md:flex"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {isAuthenticated && streak > 0 && (
              <Link
                href={!loadingChallenge && dailyChallengeId ? `/question/${dailyChallengeId}` : '/practice'}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all border",
                  !loadingChallenge && dailyChallengeId
                    ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 cursor-default border-transparent"
                )}
                title={!loadingChallenge && dailyChallengeId ? "Daily Challenge" : "Practice Questions"}
              >
                <Flame className={cn("w-4 h-4 fill-current", !loadingChallenge && dailyChallengeId && "animate-pulse")} />
                <span className="text-sm font-bold tabular-nums">{streak}</span>
              </Link>
            )}

            {isAuthenticated && userInfo ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 border border-zinc-200 dark:border-zinc-800 p-0 overflow-hidden hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={userInfo.avatar || '/user.png'}
                      alt={userInfo.name}
                      className="w-full h-full object-cover"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                  <DropdownMenuLabel className="font-normal p-3 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-xl mb-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-zinc-900 dark:text-zinc-100">{userInfo.name}</p>
                      <p className="text-xs leading-none text-zinc-500 dark:text-zinc-400 font-medium">@{userInfo.username}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild className="rounded-lg focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-600 dark:focus:text-blue-400 cursor-pointer p-2.5 transition-colors">
                    <Link href={userInfo.username ? `/profile/${userInfo.username}` : '#'}>
                      <User className="mr-2.5 h-4 w-4" />
                      <span className="font-medium">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer p-2.5 transition-colors">
                    <Link href="/settings">
                      <Settings className="mr-2.5 h-4 w-4" />
                      <span className="font-medium">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                    <DropdownMenuItem asChild className="md:hidden rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer p-2.5 transition-colors">
                      <Link href="/admin">
                        <Shield className="mr-2.5 h-4 w-4" />
                        <span className="font-medium">Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-zinc-200/50 dark:bg-zinc-800/50 my-1" />
                  <DropdownMenuItem onClick={toggleTheme} className="rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer p-2.5 transition-colors">
                    {theme === 'light' ? <Moon className="mr-2.5 h-4 w-4" /> : <Sun className="mr-2.5 h-4 w-4" />}
                    <span className="font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-200/50 dark:bg-zinc-800/50 my-1" />
                  <DropdownMenuItem onClick={logout} className="rounded-lg text-red-600 dark:text-red-400 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer p-2.5 transition-colors">
                    <LogOut className="mr-2.5 h-4 w-4" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="rounded-full px-4">
                <Link href="/login">
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav is handled in BottomNavbar.tsx, but we hide parts of this navbar on mobile via CSS if needed */}
    </nav>
  );
}
