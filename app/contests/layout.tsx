import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contests | GATECode',
  description: 'Participate in live weekly and biweekly mock GATE exams to compete globally.',
};

export default function ContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
