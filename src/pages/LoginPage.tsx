import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../lib/store';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { getAuthEmail, getAuthPassword, pushActivityLog, bootstrapSystem } from '../lib/firestoreSync';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { Building2, Download, X } from 'lucide-react';
import { generateId } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show popup after a small delay to draw attention
    const timer = setTimeout(() => {
      setShowInstallPopup(true);
    }, 1500);

    const handlePromptReady = () => {
      exportDeferredPrompt = (window as any).deferredPrompt;
    };
    
    // Check if it already fired
    let exportDeferredPrompt = (window as any).deferredPrompt;

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      exportDeferredPrompt = e;
      (window as any).deferredPrompt = e;
    });
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) {
      toast.info('To install: click the share/install button in your browser menu (or "Add to Home Screen" on mobile). Open this app in a new tab first if you are in preview mode.', { duration: 6000 });
      return;
    }
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPopup(false);
    }
    (window as any).deferredPrompt = null;
  };

  useEffect(() => {
    const ensureAdmin = async () => {
      try {
        const q = query(collection(db, 'users'), where('username', '==', 'owner22bb'));
        const snaps = await getDocs(q);
        if (snaps.empty) {
          const adminId = generateId();
          const adminData = {
            id: adminId,
            fullName: 'System Admin',
            username: 'owner22bb',
            pin: '7412',
            role: 'admin'
          };
          await setDoc(doc(db, 'users', adminId), adminData);
          try {
            const secondaryAuth = getAuth();
            await createUserWithEmailAndPassword(secondaryAuth, getAuthEmail('owner22bb'), getAuthPassword('7412'));
          } catch(e) {}
        } else {
            // make sure auth exists
            try {
              const secondaryAuth = getAuth();
              await createUserWithEmailAndPassword(secondaryAuth, getAuthEmail('owner22bb'), getAuthPassword('7412'));
            } catch(e) {}
        }
      } catch(e) {
        console.error('ensureAdmin failed', e);
      }
    };
    ensureAdmin();

    bootstrapSystem();
    // If already logged in, redirect gracefully using router rather than window.location
    if (store.token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanUsername = username.trim();
      const cleanPin = pin.trim();
      console.log('Attempting login with username', cleanUsername);
      
      // Fetch User data from Firestore first
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snaps = await getDocs(q);
      console.log('User query result empty?', snaps.empty);

      if (snaps.empty) {
        toast.error('Invalid username or PIN');
        setLoading(false);
        return;
      }

      const userDoc = snaps.docs[0];
      const userData = userDoc.data();
      console.log('User data retrieved:', userData);

      // Verify PIN against Firestore record
      if (userData.pin !== cleanPin && userData.pin !== pin) {
        toast.error('Invalid username or PIN');
        setLoading(false);
        return;
      }

      // User verified. Now sync/migrate with Firebase Auth
      try {
        await signInWithEmailAndPassword(auth, getAuthEmail(cleanUsername), getAuthPassword(cleanPin));
        console.log("Firebase Auth successful");
      } catch (authErr: any) {
         console.warn("Firebase Auth failed", authErr);
         // Try to create the user in Firebase Auth if it doesn't exist
         try {
             await createUserWithEmailAndPassword(auth, getAuthEmail(cleanUsername), getAuthPassword(cleanPin));
             console.log("Firebase Auth user created successfully");
         } catch (createErr: any) {
             console.warn("Firebase Auth creation failed", createErr);
             // We continue anyway, so the local session system works
         }
      }

      // Success
      console.log('Login success! Creating session token');
      const token = generateId();
      await setDoc(doc(db, 'sessions', token), {
        userId: userDoc.id,
        userName: userData.fullName,
        username: userData.username,
        role: userData.role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      console.log('Session saved, pushing activity log');
      store.token = token;
      
      await pushActivityLog({
        id: generateId(),
        userId: userDoc.id,
        userName: userData.fullName,
        username: userData.username,
        action: 'LOGIN',
        details: 'User logged in via PIN',
        timestamp: new Date().toISOString()
      });

      console.log('Redirecting to dashboard');
      toast.success(`Welcome back, ${userData.fullName}`);
      
      // Dispatch a custom event to tell App.tsx to re-check the session immediately
      window.dispatchEvent(new Event('auth-state-changed'));
      navigate('/dashboard', { replace: true });

    } catch (e: any) {
      console.error('Login error:', e);
      toast.error('Error logging in: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
      {/* Install App Popup */}
      <AnimatePresence>
        {showInstallPopup && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-2 sm:p-2.5 rounded-3xl flex items-center gap-2 sm:gap-4 w-full md:min-w-[600px] justify-between pointer-events-auto ring-1 ring-black/5">
              
              <div className="flex items-center gap-3 pl-2 sm:pl-4 overflow-hidden shrink min-w-0">
                <div className="flex items-center justify-center p-1.5 bg-primary/10 rounded-lg text-primary shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[13px] tracking-tight text-foreground flex items-center gap-1.5">
                    Installation Ready
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate leading-none mt-1">Get BillingSys for direct desktop & mobile access</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-1">
                <button 
                  onClick={handleInstallClick}
                  className="bg-[#5B4AE6] hover:bg-[#4c3ce0] text-white shadow-[0_8px_20px_rgb(91,74,230,0.25)] hover:shadow-[0_12px_24px_rgba(91,74,230,0.35)] hover:-translate-y-[1px] transition-all duration-300 text-xs sm:text-[13px] font-bold py-2.5 px-5 rounded-2xl whitespace-nowrap active:scale-95"
                >
                  Install App
                </button>
                <button 
                  onClick={() => setShowInstallPopup(false)}
                  className="text-muted-foreground hover:text-foreground p-2 hover:bg-secondary rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient luxury background glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-200/40 blur-[120px] dark:bg-amber-900/20 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/30 blur-[120px] dark:bg-rose-900/20 pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-200/30 blur-[100px] dark:bg-blue-900/20 pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl mb-6 relative hover:scale-105 transition-transform duration-500">
            <Building2 className="w-10 h-10 align-middle text-amber-600 dark:text-amber-400 drop-shadow-sm" />
          </div>
          <div className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-zinc-800 to-zinc-500 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent mb-3 font-heading">
            Billing System
          </div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-widest mt-2">
            Copyright © BillingSys
          </p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-white/50 dark:border-zinc-800/50 p-10 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.2)]">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 ml-1">Username</label>
              <input 
                type="text" 
                required
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 focus:outline-none transition-all shadow-sm" 
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 ml-1">Secure PIN</label>
              <input 
                type="password" 
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={4}
                required
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-2xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 focus:outline-none transition-all tracking-[1em] font-mono text-center shadow-sm" 
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value)}
              />
            </div>

            <div className="pt-6">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-2xl text-sm font-bold transition-all uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-amber-500/25 active:scale-[0.98]"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400 mt-10 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Secure encrypted connection
        </div>
      </div>
    </div>
  );
}
