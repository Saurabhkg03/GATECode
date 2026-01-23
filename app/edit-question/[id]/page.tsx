import QuestionForm from '@/components/QuestionForm';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditQuestionPage({ params }: PageProps) {
    const { id } = await params;
    return <QuestionForm questionId={id} />;
}
