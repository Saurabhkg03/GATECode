import { NextRequest } from 'next/server';
import { initAdmin } from './firebaseAdmin';

export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
  }

  const token = authHeader.split('Bearer ')[1];
  
  const app = await initAdmin();
  if (!app) {
      throw new Error('Firebase Admin not configured');
  }

  const decoded = await app.auth().verifyIdToken(token);

  const db = app.firestore();
  const userDoc = await db.collection("users").doc(decoded.uid).get();
  
  const data = userDoc.data();

  // Allow either role === 'admin' or isAdmin === true
  if (!userDoc.exists || (data?.role !== 'admin' && data?.isAdmin !== true)) {
      throw new Error("Forbidden: Requires admin privileges");
  }

  return decoded;
}
