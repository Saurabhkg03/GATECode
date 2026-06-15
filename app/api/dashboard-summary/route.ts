import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { unstable_cache } from 'next/cache';

const getDashboardSummary = unstable_cache(
    async (branch: string) => {
        const app = await initAdmin();
        if (!app) throw new Error("Firebase admin not initialized");
        const db = app.firestore();
        
        // 1. Fetch Recent Questions
        const qSnapshot = await db.collection(`questions_${branch}`)
            .orderBy('year', 'desc')
            .limit(20)
            .get();
            
        const recentQuestions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
            recentQuestions
        };
    },
    ['dashboard-summary'],
    {
        revalidate: 300, // 5 minutes cache
        tags: ['dashboard']
    }
);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
        }

        const summary = await getDashboardSummary(branch);
        
        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('Dashboard summary error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
