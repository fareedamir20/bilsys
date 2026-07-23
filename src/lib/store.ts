export interface User {
  id: string;
  fullName: string;
  username: string;
  pin: string; // 4-digit string
  role: 'admin' | 'user';
  lastActive?: string; // ISO timestamp
}

export interface ExpenseCategory {
  id: string;
  title: string;
  limit: number; // 0 = no limit
  dieselControlled?: boolean; // only shown in diesel months
  enabled?: boolean; // toggle to turn on/off the category
  floors?: string[]; // empty or undefined means all floors, otherwise list of specific floors
}

export interface UserFeatureToggles {
  generateBill?: boolean;   // Generate Bill page
  liftBill?: boolean;       // LESCO Lift Bill page
  uploadReceipts?: boolean; // Upload Receipts page
  refunds?: boolean;        // Refunds page
  history?: boolean;        // History page
  analytics?: boolean;      // Analytics page
}

export interface SystemSettings {
  serviceChargesLimit: number;
  maxBillsPerMonth: number;
  liftMaintenanceLimit: number;
  fireSystemLimit: number;
  dashboardMessage: string;
  dieselMonths: string[];
  floors: string[];
  paymentMethods: string[];
  generalCategories: ExpenseCategory[];
  liftCategories: ExpenseCategory[];
  allowUserDownloads?: boolean;
  enableRefunds?: boolean;
  userFeatureToggles?: UserFeatureToggles;
}

export function isUserFeatureEnabled(
  settings: SystemSettings | null | undefined,
  feature: keyof UserFeatureToggles
): boolean {
  if (!settings) return true;
  if (feature === 'refunds') {
    if (settings.userFeatureToggles?.refunds !== undefined) {
      return Boolean(settings.userFeatureToggles.refunds);
    }
    if (settings.enableRefunds !== undefined) {
      return Boolean(settings.enableRefunds);
    }
    return true;
  }
  if (!settings.userFeatureToggles) return true;
  const val = settings.userFeatureToggles[feature];
  return val === undefined ? true : Boolean(val);
}

export interface RefundRequest {
  id: string;
  userId: string;
  userName: string;
  floor: string;
  month: string;
  year: string;
  notes: string;
  transactionRef: string;
  amount: number;
  date: string;
  time: string;
  toAccountName?: string;
  screenshotData: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  uploadedAt: string;
}

export interface AdditionalExpense {
  title: string;
  amount: number;
  approved?: boolean;
  approvedBy?: string;
}

export interface Bill {
  id: string;
  type: 'general' | 'lift';
  userId: string;
  userName: string;
  month: string;
  year: string;
  floor: string;
  dueDate: string;
  expenses: { title: string; amount: number }[];
  additionalExpenses: AdditionalExpense[];
  totalAmount: number;
  generatedAt: string; // ISO timestamp
  generatedBy: string;
}

export interface Receipt {
  id: string;
  userId: string;
  userName: string;
  category: string;
  floor?: string;
  paidDate?: string; // YYYY-MM-DD
  month?: string;
  year?: string;
  status?: string;
  fileName: string;
  fileData: string; // base64
  uploadedAt: string;
}

export interface PendingExpense {
  id: string;
  billId: string;
  userId: string;
  userName: string;
  title: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  username: string;
  action: string; // 'LOGIN' | 'LOGOUT' | 'BILL_GENERATED' | 'AUTO_LOGOUT'
  details: string;
  timestamp: string;
}

// LocalStorage Helper
class Store {
  private get<T>(key: string, defaultValue: T): T {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  get token(): string | null {
    return localStorage.getItem('dha_session_token');
  }

  set token(value: string | null) {
    if (value) {
      localStorage.setItem('dha_session_token', value);
    } else {
      localStorage.removeItem('dha_session_token');
    }
  }

  get theme(): 'dark' | 'light' {
    return localStorage.getItem('dha_theme') as 'dark' | 'light' || 'dark';
  }

  set theme(value: 'dark' | 'light') {
    localStorage.setItem('dha_theme', value);
  }

  get settings(): SystemSettings | null {
    return this.get<SystemSettings | null>('dha_settings', null);
  }

  set settings(value: SystemSettings) {
    this.set('dha_settings', value);
  }
}

export const store = new Store();
