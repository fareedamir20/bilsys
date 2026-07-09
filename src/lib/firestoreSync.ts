import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
  where,
  limit,
  orderBy
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { app, db, auth } from './firebase';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// Create auth email string
export const getAuthEmail = (username: string) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@dha-billing.com`;
export const getAuthPassword = (pin: string) => `${pin}0000`.slice(0, 8); // Ensure it's at least 6 chars

import {
  User,
  Bill,
  Receipt,
  SystemSettings,
  ActivityLog,
  PendingExpense
} from './store';

// Helper enum for Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'custom-auth-used',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to allow the app to work offline or with open rules initially without crashing everything
}


import { generateId } from './utils';

// pullAllFromFirestore
export async function factoryResetSystem() {
  try {
    const collectionsToClear = ['bills', 'receipts', 'activity_logs', 'pending_expenses', 'sessions'];
    
    for (const coll of collectionsToClear) {
      const snap = await getDocs(collection(db, coll));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, coll, d.id));
      }
    }
    
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      if (d.data().role !== 'admin') {
        await deleteDoc(doc(db, 'users', d.id));
      }
    }

    const defaultSettings: SystemSettings = {
      serviceChargesLimit: 5000,
      maxBillsPerMonth: 1,
      liftMaintenanceLimit: 2000,
      fireSystemLimit: 1000,
      dashboardMessage: "Welcome to the Billing System.",
      dieselMonths: ['May', 'June', 'July', 'August'],
      floors: [],
      paymentMethods: ['EasyPaisa: M. ZAFAR — A/C 0307 5965879', 'Soneri Bank: MUHAMMAD ZAFAR — A/C 30000966319'],
      generalCategories: [
        { id: generateId(), title: 'Water', limit: 0 },
        { id: generateId(), title: 'Security', limit: 2500 },
        { id: generateId(), title: 'Diesel', limit: 0, dieselControlled: true },
      ],
      liftCategories: [
        { id: generateId(), title: 'Electricity', limit: 0 },
        { id: generateId(), title: 'Maintenance', limit: 2000 },
      ]
    };
    await setDoc(doc(db, 'settings', 'system'), defaultSettings);
    
    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function bootstrapSystem() {
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'system'));
    if (settingsSnap.exists()) {
      return; // Already bootstrapped, skip to avoid permission errors
    }

    const usersSnap = await getDocs(query(collection(db, 'users')));
    
    if (!usersSnap.empty) {
      // Find admin and update it just in case it's the old one
      usersSnap.docs.forEach(async (d) => {
        const u = d.data();
        if (u.username === 'admin' && u.pin === '1234') {
          await updateDoc(doc(db, 'users', d.id), {
            username: 'owner22bb',
            pin: '7412'
          });
          try {
            await createUserWithEmailAndPassword(secondaryAuth, getAuthEmail('owner22bb'), getAuthPassword('7412'));
          } catch (e: any) {
            console.warn('Firebase Auth creation failed for admin update:', e.message);
          }
        }
      });
    }

    if (usersSnap.empty) {
      const adminId = generateId();
      const adminData = {
        id: adminId,
        fullName: 'System Admin',
        username: 'owner22bb',
        pin: '7412',
        role: 'admin'
      };
      
      try {
        await createUserWithEmailAndPassword(secondaryAuth, getAuthEmail(adminData.username), getAuthPassword(adminData.pin));
      } catch (e: any) {
        console.warn('Firebase Auth creation failed for admin:', e.message);
      }

      await setDoc(doc(db, 'users', adminId), adminData);
      
      const defaultSettings: SystemSettings = {
        serviceChargesLimit: 2000,
        maxBillsPerMonth: 1,
        liftMaintenanceLimit: 5000,
        fireSystemLimit: 5000,
        dashboardMessage: 'Welcome to the new DHA Billing System backend!',
        dieselMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        floors: ['Ground', '1st', '2nd', '3rd', '4th', '5th'],
        paymentMethods: [
          'EasyPaisa: M. ZAFAR — A/C 0307 5965879',
          'Soneri Bank: MUHAMMAD ZAFAR — A/C 30000966319'
        ],
        generalCategories: [
          { id: '1', title: 'DHA Water Bill', limit: 0 },
          { id: '2', title: 'Lift Maintenance', limit: 5000 },
          { id: '3', title: 'Fire System Maintenance', limit: 5000 },
          { id: '4', title: 'Diesel for Lift', limit: 0, dieselControlled: true },
          { id: '5', title: 'Service Charges', limit: 2000 },
        ],
        liftCategories: [
          { id: '1', title: 'LESCO Lift Bill', limit: 0 },
        ]
      };
      await setDoc(doc(db, 'settings', 'system'), defaultSettings);
    }
  } catch (e) {
    console.error('Bootstrap failed', e);
  }
}

let globalDataCache: any = null;
let globalDataPromise: Promise<any> | null = null;
let areGlobalListenersActive = false;

type SubscriptionCallback = (data: any, collectionName: string) => void;
const subscribers: Set<SubscriptionCallback> = new Set();

function activateGlobalListeners() {
  if (areGlobalListenersActive) return;
  areGlobalListenersActive = true;

  onSnapshot(collection(db, 'users'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (globalDataCache) globalDataCache.users = data;
    subscribers.forEach(cb => cb(data, 'users'));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

  onSnapshot(collection(db, 'bills'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (globalDataCache) globalDataCache.bills = data;
    subscribers.forEach(cb => cb(data, 'bills'));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'bills'));

  onSnapshot(collection(db, 'receipts'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (globalDataCache) globalDataCache.receipts = data;
    subscribers.forEach(cb => cb(data, 'receipts'));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'receipts'));

  onSnapshot(doc(db, 'settings', 'system'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (globalDataCache) globalDataCache.settings = data;
      subscribers.forEach(cb => cb(data, 'settings'));
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/system'));

  onSnapshot(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (globalDataCache) globalDataCache.logs = data;
    subscribers.forEach(cb => cb(data, 'logs'));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs'));
  
  onSnapshot(collection(db, 'pending_expenses'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (globalDataCache) globalDataCache.pendingExpenses = data;
    subscribers.forEach(cb => cb(data, 'pendingExpenses'));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'pending_expenses'));
}

export async function pullAllFromFirestore() {
  if (globalDataCache) return globalDataCache;
  if (globalDataPromise) return globalDataPromise;

  activateGlobalListeners();

  globalDataPromise = (async () => {
    try {
      const [usersSnap, billsSnap, receiptsSnap, settingsSnap, logsSnap, pendingSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bills')),
        getDocs(collection(db, 'receipts')),
        getDoc(doc(db, 'settings', 'system')),
        getDocs(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(100))),
        getDocs(collection(db, 'pending_expenses'))
      ]);

      globalDataCache = {
        users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)),
        bills: billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)),
        receipts: receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Receipt)),
        settings: settingsSnap.exists() ? settingsSnap.data() as SystemSettings : null,
        logs: logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)),
        pendingExpenses: pendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as PendingExpense)),
      };
      
      // Seed subscribers once if they missed initial snap
      subscribers.forEach(cb => {
        cb(globalDataCache.users, 'users');
        cb(globalDataCache.bills, 'bills');
        cb(globalDataCache.receipts, 'receipts');
        cb(globalDataCache.settings, 'settings');
        cb(globalDataCache.logs, 'logs');
        cb(globalDataCache.pendingExpenses, 'pendingExpenses');
      });

      return globalDataCache;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'multiple');
      globalDataPromise = null;
      return null;
    }
  })();

  return globalDataPromise;
}

// subscribeToChanges
export function subscribeToChanges(callback: SubscriptionCallback) {
  activateGlobalListeners();
  subscribers.add(callback);
  
  // if cache is already populated, immediately call callback so UI catches up
  if (globalDataCache) {
    callback(globalDataCache.users, 'users');
    callback(globalDataCache.bills, 'bills');
    callback(globalDataCache.receipts, 'receipts');
    callback(globalDataCache.settings, 'settings');
    callback(globalDataCache.logs, 'logs');
    callback(globalDataCache.pendingExpenses, 'pendingExpenses');
  }

  return () => {
    subscribers.delete(callback);
  };
}

export async function pushUser(user: User) {
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function pushNewUser(user: User) {
  try {
    try {
      await createUserWithEmailAndPassword(secondaryAuth, getAuthEmail(user.username), getAuthPassword(user.pin));
    } catch (e: any) {
      console.warn("Firebase Auth creation failed (might exist):", e.message);
    }
  } catch (e) {
    // Ignore secondaryauth init issues if any
  }
  await pushUser(user);
}

export async function pushDeleteUser(id: string) {
  try {
    await deleteDoc(doc(db, 'users', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `users/${id}`);
  }
}

export async function pushBill(bill: Bill) {
  try {
    await setDoc(doc(db, 'bills', bill.id), bill);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `bills/${bill.id}`);
  }
}

export async function pushDeleteBill(id: string) {
  try {
    await deleteDoc(doc(db, 'bills', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `bills/${id}`);
  }
}

export async function pushReceipt(receipt: Receipt) {
  try {
    await setDoc(doc(db, 'receipts', receipt.id), receipt);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `receipts/${receipt.id}`);
  }
}

export async function pushDeleteReceipt(id: string) {
  try {
    await deleteDoc(doc(db, 'receipts', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `receipts/${id}`);
  }
}

export async function pushSettings(settings: SystemSettings) {
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await setDoc(doc(db, 'settings', 'system'), cleanSettings);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `settings/system`);
  }
}

export async function pushActivityLog(entry: ActivityLog) {
  try {
    await setDoc(doc(db, 'activity_logs', entry.id), entry);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `activity_logs/${entry.id}`);
  }
}

export async function pushUserLogin(userId: string) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      lastActive: new Date().toISOString()
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function pushPendingExpense(expense: PendingExpense) {
  try {
    await setDoc(doc(db, 'pending_expenses', expense.id), expense);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `pending_expenses/${expense.id}`);
  }
}

export async function pushApproveExpense(expenseId: string, status: 'approved' | 'rejected', adminId: string) {
  try {
    await updateDoc(doc(db, 'pending_expenses', expenseId), {
      status
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `pending_expenses/${expenseId}`);
  }
}
