import { db } from './firebase.js';
import { collection, getDocs } from 'firebase/firestore';

async function listContests() {
  try {
    const contestsRef = collection(db, 'contests');
    const snapshot = await getDocs(contestsRef);
    if (snapshot.empty) {
      console.log('No contests found in the database.');
    } else {
      snapshot.forEach(doc => {
        console.log(`Contest ID: ${doc.id}`);
      });
    }
  } catch (err) {
    console.error('Error fetching contests:', err);
  }
}

listContests();
