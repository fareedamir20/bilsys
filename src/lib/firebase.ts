import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
// Initialize services
export const db = initializeFirestore(app, {}, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
