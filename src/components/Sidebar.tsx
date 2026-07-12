import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { NavLink } from './NavLink';
import { 
  LayoutDashboard, 
  FileText, 
  Wrench, 
  UploadCloud, 
  History, 
  Settings, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  X,
  BarChart,
  Users,
  CheckCircle2,
  Download
} from 'lucide-react';
import { store, User } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { pushActivityLog } from '../lib/firestoreSync';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(store.theme === 'dark');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      store.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      store.theme = 'light';
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  
  const handleLogout = async () => {
    if (user && store.token) {
      try {
        await pushActivityLog({
          id: generateId(),
          userId: user.id,
          userName: user.fullName,
          username: user.username,
          action: 'LOGOUT',
          details: 'User logged out normally',
          timestamp: new Date().toISOString()
        });
        await deleteDoc(doc(db, 'sessions', store.token));
      } catch (e) {
        console.error('Logout error', e);
      }
    }
    onLogout();
  };

  const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(user?.role === 'user' ? [
      { to: '/generate-bill', icon: FileText, label: 'Generate Bill' },
      { to: '/lift-bill', icon: Wrench, label: 'LESCO Lift Bill' },
    ] : []),
    { to: '/upload-receipts', icon: UploadCloud, label: 'Upload Receipts' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/analytics', icon: BarChart, label: 'Analytics' },
    ...(user?.role === 'admin' ? [
      { to: '/admin', icon: Settings, label: 'Admin Panel' }
    ] : [])
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg border shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-sidebar-background border-r flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Header */}
        <div className="p-6 flex flex-col justify-center border-b border-border/50 h-[88px] relative">
          <div className="text-xl font-bold tracking-tighter gradient-text uppercase">
            Billing System
          </div>
          <button onClick={toggleTheme} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
          {navLinks.filter(l => l.label !== 'Admin Panel').map((link) => (
            <NavLink 
              key={link.to} 
              to={link.to}
              icon={link.icon}
              label={link.label}
              onClick={() => setIsOpen(false)} 
            />
          ))}

          {user?.role === 'admin' && (
            <div className="pt-6 space-y-6">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-3 mb-2">Admin Control</div>
                <NavLink 
                  to="/admin" 
                  icon={Settings} 
                  label="Admin Panel" 
                  onClick={() => setIsOpen(false)} 
                />
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-3 mb-2">Management</div>
                <div className="space-y-1">
                  <NavLink to="/admin?tab=users" icon={Users} label="User Management" onClick={() => setIsOpen(false)} />
                  <NavLink to="/admin?tab=approvals" icon={CheckCircle2} label="Approvals" onClick={() => setIsOpen(false)} />
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-3 mb-2">Configuration</div>
                <div className="space-y-1">
                  <NavLink to="/admin?tab=settings" icon={Settings} label="System Settings" onClick={() => setIsOpen(false)} />
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-3 mb-2">Data & Reports</div>
                <div className="space-y-1">
                  <NavLink to="/admin?tab=logs" icon={History} label="Activity Logs" onClick={() => setIsOpen(false)} />
                  <NavLink to="/admin?tab=export" icon={Download} label="Export Data" onClick={() => setIsOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Footer / User Info */}
        {user && (
          <div className="p-4 border-t border-border/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              {user.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold truncate text-foreground">{user.fullName}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{user.role} Role</div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-2"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
