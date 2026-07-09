import { generateId } from '../lib/utils';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../lib/store';
import { pushActivityLog } from '../lib/firestoreSync';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export function useInactivityLogout(timeoutMs: number = 1800000) {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleInactivity = async () => {
      const token = store.token;
      if (token) {
        // Find session in firestore to get userId to log out
        try {
          const sessionRef = doc(db, 'sessions', token);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            const data = sessionSnap.data();
            await pushActivityLog({
              id: generateId(),
              userId: data.userId,
              userName: data.userName || 'System',
              username: data.username || 'system',
              action: 'AUTO_LOGOUT',
              details: 'Logged out due to inactivity',
              timestamp: new Date().toISOString()
            });
          }
          await deleteDoc(sessionRef);
        } catch (e) {
          console.error('Failed to handle inactivity logout cleanup');
        }
        
        store.token = null;
        toast.error('Session expired due to inactivity.');
        navigate('/');
      }
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (store.token) {
        timeoutId = setTimeout(handleInactivity, timeoutMs);
      }
    };

    // Attach event listeners
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'visibilitychange'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearTimeout(timeoutId);
    };
  }, [navigate]);
}
