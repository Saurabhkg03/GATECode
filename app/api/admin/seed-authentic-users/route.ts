import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { processContestRatings } from '@/lib/ratingProcessor';
import { apiError, apiSuccess } from '@/lib/apiResponse';

const firstNames = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Siddharth", "Rohan", "Krishna", "Ishaan", "Shaurya", "Atharva", "Kabir", "Vivaan", "Ayush", "Dev", "Reyansh", "Ananya", "Diya", "Aadhya", "Saanvi", "Priya", "Neha", "Riya", "Kriti", "Aditi", "Isha", "Rashi", "Kavya", "Aarohi", "Mira", "Rahul", "Vikram", "Suresh", "Ramesh", "Karan", "Pooja", "Sneha", "Tanvi", "Nikhil", "Akash"];
const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Reddy", "Rao", "Das", "Mukherjee", "Nair", "Iyer", "Jain", "Bansal", "Agarwal", "Mishra", "Pandey", "Chauhan", "Joshi", "Bhatia", "Desai", "Menon", "Kapoor", "Ahuja", "Yadav", "Tiwari", "Chatterjee", "Sen", "Nath", "Pillai"];

const subjects = ["Data Structures & Algorithms", "Operating Systems", "Database Management", "Computer Networks", "Computer Organization", "Engineering Mathematics", "General Aptitude", "Theory of Computation", "Compiler Design", "Digital Logic"];

function generateName() {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${fn} ${ln}`;
}

export async function POST(req: NextRequest) {
    try {
        console.log('[Seed Authentic] Starting...');
        
        let batches: Promise<any>[] = [];
        let batch = adminDb.batch();
        let ops = 0;
        
        const commit = async () => {
            if (ops > 0) {
                batches.push(batch.commit());
                batch = adminDb.batch();
                ops = 0;
            }
        };

        // 1. Generate 100 new users with specific profiles
        const users = [];
        for (let i = 0; i < 100; i++) {
            let profile = 'normal';
            if (i < 5) profile = 'acer'; // always top 5%
            else if (i < 10) profile = 'bomber'; // always bottom 5%
            else if (i < 15) profile = 'improver'; // gets better each test
            else if (i < 20) profile = 'deteriorator'; // gets worse each test
            else if (i < 25) profile = 'skipper'; // skips ~40% of tests
            
            const uid = `sim_auth_${Date.now()}_${i}`;
            const fullName = generateName();
            const username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
            
            users.push({ uid, profile, index: i, name: fullName });
            
            // Generate some random subject mastery
            const mastery: any = {};
            subjects.forEach(sub => {
                // Determine mastery somewhat based on profile
                let base = 50;
                if (profile === 'acer') base = 80;
                if (profile === 'bomber') base = 20;
                mastery[sub] = Math.min(100, Math.max(0, base + (Math.random() * 40 - 20))); // +/- 20
            });

            batch.set(adminDb.collection('users').doc(uid), {
                uid,
                username,
                name: fullName,
                email: `${username}@example.com`,
                createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), // Created 30 days ago
                branchRatings: { cse: 1500 },
                highestBranchRatings: { cse: 1500 },
                contestCount: 0,
                isSimulated: true, // Legacy compatibility
                isAuthenticSeed: true,
                role: 'user',
                stats: {
                    totalQuestionsAttempted: Math.floor(Math.random() * 500) + 50,
                    correctAnswers: Math.floor(Math.random() * 300) + 20,
                    subjectMastery: mastery,
                    studyStreak: Math.floor(Math.random() * 15)
                }
            });
            ops++;
            if (ops >= 400) await commit();
        }
        await commit();
        await Promise.all(batches);
        batches = [];
        console.log(`[Seed Authentic] Generated 100 authentic accounts.`);

        // 2. Generate 5 Contests
        const contestIds = [];
        for (let c = 1; c <= 5; c++) {
            const contestId = `auth_contest_${Date.now()}_${c}`;
            contestIds.push(contestId);
            
            batch.set(adminDb.collection('contests').doc(contestId), {
                id: contestId,
                title: `Weekly GATE Mock ${Date.now().toString().slice(-4)} - Pt ${c}`,
                branch: 'cse',
                totalMarks: 100,
                durationMinutes: 90,
                startTime: Date.now() - (15 - c*3) * 86400000, // Every 3 days over last 15 days
                endTime: Date.now() - (15 - c*3) * 86400000 + 5400000,
                isRatingsProcessed: false,
                status: 'completed',
                isRated: true,
                participants: users.map(u => u.uid)
            });
            ops++;
            if (ops >= 400) await commit();
        }
        await commit();
        await Promise.all(batches);
        batches = [];

        // 3. Run attempts and process ratings for each contest consecutively
        for (let c = 0; c < 5; c++) {
            const contestId = contestIds[c];
            console.log(`[Seed Authentic] Running contest ${c+1}: ${contestId}`);
            
            for (const user of users) {
                // Edge case: skippers
                if (user.profile === 'skipper' && Math.random() < 0.4) {
                    continue; // Skip this contest
                }

                // Determine score
                let expectedPct = 0.5 + (Math.random() * 0.4 - 0.2); // Normal: 30% to 70%
                
                if (user.profile === 'acer') expectedPct = 0.85 + Math.random() * 0.1; // 85-95%
                if (user.profile === 'bomber') expectedPct = 0.1 + Math.random() * 0.15; // 10-25%
                if (user.profile === 'improver') expectedPct = 0.3 + (c * 0.15) + (Math.random()*0.1-0.05);
                if (user.profile === 'deteriorator') expectedPct = 0.9 - (c * 0.15) + (Math.random()*0.1-0.05);

                const actualPct = Math.min(1.0, Math.max(0.0, expectedPct));
                const score = Math.round(actualPct * 100);

                const attemptId = `${user.uid}_${contestId}`;
                batch.set(adminDb.collection('contest_attempts').doc(attemptId), {
                    id: attemptId,
                    uid: user.uid,
                    contestId,
                    startedAt: Date.now() - (15 - c*3) * 86400000 - 3600000, // Accurately simulate timestamp
                    lastUpdated: Date.now(),
                    timeLeftSeconds: 0,
                    isSubmitted: true,
                    submittedAt: Date.now() - (15 - c*3) * 86400000,
                    isPractice: false,
                    score: score,
                    responses: {}
                });
                ops++;
                if (ops >= 400) await commit();
            }
            await commit();
            await Promise.all(batches);
            batches = [];

            // Process Ratings for this contest
            await processContestRatings(adminDb, contestId);
            console.log(`[Seed Authentic] Processed ratings for contest ${c+1}`);
        }

        return apiSuccess({ message: 'Successfully seeded authentic users and 5 contest simulations.', contests: contestIds });

    } catch (error: any) {
        console.error(error);
        return apiError(error.message, 'INTERNAL_ERROR', 500);
    }
}
