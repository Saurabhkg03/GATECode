import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice | GATECode',
  description: 'Practice thousands of GATE questions by subject and topic. Track your accuracy and mastery.',
};

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
