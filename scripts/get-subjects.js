const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error("Missing Firebase Admin environment variables in .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore();

async function getSubjects() {
  const branches = ['cse', 'ece', 'me', 'ee', 'in'];
  
  for (const branch of branches) {
    console.log(`\n--- Fetching subjects for ${branch.toUpperCase()} ---`);
    let qCol = db.collection(`questions_${branch}`);
    let snapshot = await qCol.get();
    
    if (snapshot.empty) {
        qCol = db.collection(`questions_${branch}/questions`);
        snapshot = await qCol.get();
    }
    
    const subjects = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.subject) {
        subjects.add(data.subject);
      }
    });
    
    console.log(Array.from(subjects));
  }
}

getSubjects().catch(console.error);
