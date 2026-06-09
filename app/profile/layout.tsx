import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | GATECode',
  description: 'View your GATECode profile, statistics, and history.',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
