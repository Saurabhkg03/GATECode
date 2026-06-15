import type { Metadata } from 'next';
import ProtectedRoute from '@/components/ProtectedRoute';

export const metadata: Metadata = {
  title: 'Exam | GATECode',
  description: 'Take a realistic GATE contest.',
};

export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
