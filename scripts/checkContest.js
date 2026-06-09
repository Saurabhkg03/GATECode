import { db } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';

async function checkContest(id) {
  try {
    const docRef = doc(db, 'contests', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log(`Contest ${id} exists!`);
    } else {
      console.log(`Contest ${id} DOES NOT exist.`);
    }
  } catch (err) {
    console.error('Error fetching contest:', err);
  }
}

checkContest('weekly-15-ece');
checkContest('weekly-15');
