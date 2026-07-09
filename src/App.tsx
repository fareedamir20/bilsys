import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { Sidebar } from './components/Sidebar';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { store, User } from './lib/store';
import { db } from './lib/firebase';
import { doc, getDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { Toaster } from 'sonner';

// Lazy loading for large pages
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GenerateBillPage = React.lazy(() => import('./pages/GenerateBillPage').then(m => ({ default: m.GenerateBillPage })));
const LiftBillPage = React.lazy(() => import('./pages/LiftBillPage').then(m => ({ default: m.LiftBillPage })));
const UploadReceiptsPage = React.lazy(() => import('./pages/UploadReceiptsPage').then(m => ({ default: m.UploadReceiptsPage })));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));

function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center p-12">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

function AppLayout({ children, user, onLogout }: { children: React.ReactNode, user: User | null, onLogout: () => void }) {
  useInactivityLogout();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 min-w-0 overflow-y-auto w-full relative pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ 
  children, 
  user,
  adminOnly = false,
  userOnly = false
}: { 
  children: React.ReactNode, 
  user: User | null,
  adminOnly?: boolean,
  userOnly?: boolean
}) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (userOnly && user.role !== 'user') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSession: (() => void) | undefined;

    const checkSession = async () => {
      // Test Firestore connection on boot
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();

      setLoading(true);
      const token = store.token;
      if (!token) {
        setUser(null);
        setLoading(false);
        if (unsubSession) unsubSession();
        return;
      }

      if (unsubSession) unsubSession();

      unsubSession = onSnapshot(doc(db, 'sessions', token), async (snap) => {
        if (!snap.exists()) {
          setUser(null);
          store.token = null;
          setLoading(false);
          return;
        }

        const data = snap.data();
        if (new Date(data.expiresAt) < new Date()) {
          setUser(null);
          store.token = null;
          setLoading(false);
          return;
        }

        // Fetch user doc to keep it updated
        try {
          const userSnap = await getDoc(doc(db, 'users', data.userId));
          if (userSnap.exists()) {
            setUser({ id: userSnap.id, ...userSnap.data() } as User);
          } else {
            setUser(null);
            store.token = null;
          }
        } catch (e) {
          console.error(e);
          setUser(null);
          store.token = null;
        }
        setLoading(false);
      }, (error) => {
        console.error("Session snapshot error:", error);
        setUser(null);
        store.token = null;
        setLoading(false);
      });
    };

    checkSession();

    window.addEventListener('auth-state-changed', checkSession);

    return () => {
      window.removeEventListener('auth-state-changed', checkSession);
      if (unsubSession) unsubSession();
    };
  }, []);

  const handleLogout = () => {
    store.token = null;
    setUser(null);
    window.dispatchEvent(new Event('auth-state-changed'));
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" theme={store.theme} />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><DashboardPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/generate-bill" element={
          <ProtectedRoute user={user} userOnly>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><GenerateBillPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

         <Route path="/lift-bill" element={
          <ProtectedRoute user={user} userOnly>
            <AppLayout user={user} onLogout={handleLogout}>
               <Suspense fallback={<PageLoader />}><LiftBillPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/upload-receipts" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><UploadReceiptsPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><HistoryPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><AnalyticsPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute user={user} adminOnly>
            <AppLayout user={user} onLogout={handleLogout}>
              <Suspense fallback={<PageLoader />}><AdminPage user={user} /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
