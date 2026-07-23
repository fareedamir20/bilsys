import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { User, SystemSettings, PendingExpense, ActivityLog, ExpenseCategory } from '../lib/store';
import { 
  pullAllFromFirestore, 
  pushSettings, 
  pushUser, 
  pushNewUser,
  pushDeleteUser,
  pushApproveExpense,
  subscribeToChanges
} from '../lib/firestoreSync';
import { toast } from 'sonner';
import { exportDataPDF } from '../lib/pdfGenerator';
import { Loader2, Users, Settings as SettingsIcon, CheckCircle2, History as HistoryIcon, Plus, Trash2, SwitchCamera, Pencil, Download, BarChart3, Shield, Webhook } from 'lucide-react';
import { formatDateTimeDMY } from '../lib/utils';
import { db } from '../lib/firebase';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';

export function AdminPage({ user }: { user: User | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as any;
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'approvals' | 'logs' | 'export'>(tabParam || 'users');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    setSearchParams({ tab });
  };
  
  // Export Data States
  const [exportFrom, setExportFrom] = useState(''); // YYYY-MM
  const [exportTo, setExportTo] = useState(''); // YYYY-MM
  const [exportFloor, setExportFloor] = useState('');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // User form
  const [uName, setUName] = useState('');
  const [uUsername, setUUsername] = useState('');
  const [uPin, setUPin] = useState('');
  const [uRole, setURole] = useState<'admin' | 'user'>('user');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const handleEditClick = (u: User) => {
    setEditingUserId(u.id);
    setUName(u.fullName);
    setUUsername(u.username);
    setUPin(u.pin);
    setURole(u.role);
    // Scroll to the top if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add Floor State
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorBusiness, setNewFloorBusiness] = useState('');

  // General category State
  const [showAddGeneralCat, setShowAddGeneralCat] = useState(false);
  const [editGenCatId, setEditGenCatId] = useState<string | null>(null);
  const [newGenCatTitle, setNewGenCatTitle] = useState('');
  const [newGenCatLimit, setNewGenCatLimit] = useState<number>(0);
  const [newGenCatDiesel, setNewGenCatDiesel] = useState(false);
  const [newGenCatEnabled, setNewGenCatEnabled] = useState(true);
  const [newGenCatFloors, setNewGenCatFloors] = useState<string[]>([]); // empty means all floors

  // Lift category State
  const [showAddLiftCat, setShowAddLiftCat] = useState(false);
  const [editLiftCatId, setEditLiftCatId] = useState<string | null>(null);
  const [newLiftCatTitle, setNewLiftCatTitle] = useState('');
  const [newLiftCatLimit, setNewLiftCatLimit] = useState<number>(0);
  const [newLiftCatEnabled, setNewLiftCatEnabled] = useState(true);
  const [newLiftCatFloors, setNewLiftCatFloors] = useState<string[]>([]); // empty means all floors

  // Logs state
  const [logFilter, setLogFilter] = useState<'all' | 'edits'>('all');
  
  // Settings Tab State
  const [settingsTab, setSettingsTab] = useState<'globals' | 'categories' | 'floors'>('globals');

  useEffect(() => {
    let unmounted = false;
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setUsers(data.users);
        setSettings(data.settings);
        setOriginalSettings(data.settings);
        setPending(data.pendingExpenses);
        setLogs(data.logs);
      }
      setLoading(false);
    });

    const unsub = subscribeToChanges((data, collectionName) => {
      if (unmounted) return;
      if (collectionName === 'users') setUsers(data);
      if (collectionName === 'settings') {
        setSettings(data);
        setOriginalSettings(data);
      }
      if (collectionName === 'pendingExpenses') setPending(data);
      if (collectionName === 'logs') setLogs(data);
    });

    return () => {
      unmounted = true;
      unsub();
    };
  }, []);

  if (loading || !settings) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  // USER MANAGEMENT
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uPin.length !== 4) return toast.error('PIN must be exactly 4 digits');
    
    if (!editingUserId && users.find(u => u.username === uUsername)) {
      return toast.error('Username already exists');
    }

    try {
      const userData: User = {
        id: editingUserId || generateId(),
        fullName: uName,
        username: uUsername,
        pin: uPin,
        role: uRole
      };
      
      if (editingUserId) {
        await pushUser(userData);
        setUsers(users.map(u => u.id === editingUserId ? userData : u));
        toast.success('User updated successfully');
      } else {
        await pushNewUser(userData);
        setUsers([...users, userData]);
        toast.success('User added successfully');
      }
      
      setUName(''); setUUsername(''); setUPin(''); setURole('user'); setEditingUserId(null);
    } catch (err) {
      toast.error('Failed to save user');
    }
  };

  const handleCancelEdit = () => {
    setUName(''); setUUsername(''); setUPin(''); setURole('user'); setEditingUserId(null);
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user?.id) return toast.error('Cannot delete yourself');
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      await pushDeleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // EXPENSE APPROVALS
  const handleApproval = async (expId: string, status: 'approved' | 'rejected') => {
    try {
      await pushApproveExpense(expId, status, user!.id);
      setPending(pending.map(p => p.id === expId ? { ...p, status } : p));
      toast.success(`Expense ${status}`);
    } catch {
      toast.error('Action failed');
    }
  };

  // SETTINGS MANAGEMENT
  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await pushSettings(settings);

      const changes: string[] = [];
      if (originalSettings) {
        Object.keys(settings).forEach(k => {
          const key = k as keyof SystemSettings;
          if (JSON.stringify(settings[key]) !== JSON.stringify(originalSettings[key])) {
            changes.push(`${key} changed`);
          }
        });
      }

      if (changes.length > 0 && user) {
        const m = await import('../lib/firestoreSync');
        const { generateId } = await import('../lib/utils');
        await m.pushActivityLog({
          id: generateId(),
          userId: user.id,
          userName: user.fullName,
          username: user.username,
          action: 'SETTING_UPDATED',
          details: `Updated settings: ${changes.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        setOriginalSettings(settings);
      }

      toast.success('Settings updated successfully');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const MONTHS_MAP: Record<string, string> = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04', 
    'May': '05', 'June': '06', 'July': '07', 'August': '08', 
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };

  const handleExportData = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await pullAllFromFirestore();
      if (!data) return toast.error('Failed to pull data for export');
      
      let filteredBills = data.bills;
      
      if (exportFloor && exportFloor !== 'all') {
        filteredBills = filteredBills.filter(b => b.floor === exportFloor);
      }
      
      if (exportFrom || exportTo) {
        filteredBills = filteredBills.filter(b => {
          const mNum = MONTHS_MAP[b.month];
          if (!mNum) return true;
          const billYm = `${b.year}-${mNum}`;
          
          if (exportFrom && billYm < exportFrom) return false;
          if (exportTo && billYm > exportTo) return false;
          return true;
        });
      }
      
      exportDataPDF(filteredBills, '', '', exportFloor, exportFrom, exportTo);
      toast.success('Data exported successfully.');
    } catch (e) {
      toast.error('Failed to export data');
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32">
      <h1 className="text-3xl font-heading font-bold mb-6">Admin Panel</h1>
      
      <div className="w-full">
        {/* USERS TAB */}
          {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="glass-card p-6 border-l-4 border-l-primary">
              <h3 className="font-heading font-semibold text-lg mb-4">{editingUserId ? 'Edit User' : 'Add New User'}</h3>
              <form onSubmit={handleSaveUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div className="space-y-1.5"><label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label><input type="text" required className="input-field w-full" value={uName} onChange={e=>setUName(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-xs font-semibold uppercase text-muted-foreground">Username</label><input type="text" required className="input-field w-full" value={uUsername} onChange={e=>setUUsername(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-xs font-semibold uppercase text-muted-foreground">4-digit PIN</label><input type="password" pattern="[0-9]*" maxLength={4} required className="input-field w-full tracking-widest font-mono" value={uPin} onChange={e=>setUPin(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-xs font-semibold uppercase text-muted-foreground">Role</label>
                  <select className="input-field w-full" value={uRole} onChange={e=>setURole(e.target.value as any)}>
                    <option value="user">Resident (User)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 lg:col-span-2">
                  <button type="submit" className="btn-primary flex justify-center items-center h-10 flex-1 whitespace-nowrap"><Plus className="w-4 h-4 mr-2"/> {editingUserId ? 'Save User' : 'Add User'}</button>
                  {editingUserId && (
                    <button type="button" onClick={handleCancelEdit} className="btn-secondary flex justify-center items-center h-10 flex-1 whitespace-nowrap">Cancel</button>
                  )}
                </div>
              </form>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-border/50"><h3 className="font-heading font-semibold text-lg">System Users</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    <tr><th className="px-6 py-4">User</th><th className="px-6 py-4">Username & PIN</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Last Active</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">{u.fullName.charAt(0).toUpperCase()}</div>
                            <span className="font-medium text-foreground">{u.fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{u.username}</div>
                          <div className="text-xs font-mono text-muted-foreground tracking-widest">{u.pin}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${u.role==='admin'?'bg-primary/10 text-primary border-primary/20':'bg-secondary text-secondary-foreground border-border'}`}>{u.role}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{u.lastActive ? formatDateTimeDMY(u.lastActive) : 'Never'}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button onClick={() => handleEditClick(u)} className="p-2 text-muted-foreground hover:bg-secondary/50 rounded transition-colors mr-1"><Pencil className="w-4 h-4"/></button>
                          <button onClick={() => handleDeleteUser(u.id)} disabled={u.id===user?.id} className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setSettingsTab('globals')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${settingsTab === 'globals' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
              >
                Global Limits & General
              </button>
              <button 
                onClick={() => setSettingsTab('categories')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${settingsTab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
              >
                Expense Categories
              </button>
              <button 
                onClick={() => setSettingsTab('floors')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${settingsTab === 'floors' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
              >
                Floor Management
              </button>
            </div>

            {settingsTab === 'globals' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="glass-card p-6 space-y-4">
                  <h3 className="font-heading font-semibold text-lg border-b border-border/50 pb-2">Global Limits</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Max Bills / Month / Type</label>
                        <p className="text-xs text-muted-foreground">Limits bill generation per user per type.</p>
                      </div>
                      <input type="number" min="1" className="input-field w-24 text-right" value={settings.maxBillsPerMonth ?? 1} onChange={e=>updateSetting('maxBillsPerMonth', parseInt(e.target.value)||1)} />
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-border/50 pt-4">
                      <div>
                        <label className="text-sm font-medium">Allow User Downloads</label>
                        <p className="text-xs text-muted-foreground">Allow regular users to download receipts and export bills.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.allowUserDownloads ?? true} onChange={e=>updateSetting('allowUserDownloads', e.target.checked)} />
                        <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-4">
                      <div>
                        <label className="text-sm font-medium">Enable Refunds</label>
                        <p className="text-xs text-muted-foreground">Users can submit refund requests with screenshots.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.enableRefunds ?? false} onChange={e=>updateSetting('enableRefunds', e.target.checked)} />
                        <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <label className="text-sm font-medium">Dashboard Message</label>
                      <textarea className="input-field w-full min-h-[60px]" value={settings.dashboardMessage ?? ''} onChange={e=>updateSetting('dashboardMessage', e.target.value)} placeholder="Message shown on users' dashboard..." />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Payment Methods</label>
                        <span className="text-xs text-muted-foreground font-mono">1 per line</span>
                      </div>
                      <textarea 
                        className="input-field w-full min-h-[100px] font-mono text-sm leading-relaxed" 
                        value={settings.paymentMethods?.join('\n') || ''} 
                        onChange={e => updateSetting('paymentMethods', e.target.value.split('\n').filter(l => l.trim() !== ''))} 
                        placeholder="EasyPaisa: M. ZAFAR..."
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 space-y-4">
                  <h3 className="font-heading font-semibold text-lg border-b border-border/50 pb-2">Diesel Months</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => {
                          const newMonths = settings.dieselMonths.includes(m) 
                            ? settings.dieselMonths.filter(x => x !== m) 
                            : [...settings.dieselMonths, m];
                          updateSetting('dieselMonths', newMonths);
                        }}
                        className={`text-xs px-2 py-2 rounded-lg border transition-colors ${settings.dieselMonths.includes(m) ? 'bg-primary/20 text-primary border-primary/40 font-medium' : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'}`}
                      >
                        {m.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Select months when Diesel Category is visible in the system.</p>
                </div>
              </div>
            )}

            {settingsTab === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-heading font-semibold text-lg">General Expense Categories</h3>
                    {!showAddGeneralCat && (
                      <button onClick={() => setShowAddGeneralCat(true)} className="text-xs flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"><Plus className="w-3 h-3"/> Add</button>
                    )}
                  </div>
                  
                  {showAddGeneralCat && (
                    <div className="flex flex-col gap-3 mt-2 bg-secondary/50 p-4 rounded-xl border border-border/50">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input type="text" placeholder="Category Title" className="input-field text-sm flex-1" value={newGenCatTitle} onChange={e=>setNewGenCatTitle(e.target.value)} />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs</span>
                          <input type="number" placeholder="Limit (0=Unlim)" className="input-field text-sm w-full sm:w-32 pl-8" value={newGenCatLimit} onChange={e=>setNewGenCatLimit(parseInt(e.target.value)||0)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Applied Floors (Hold Ctrl/Cmd or select multiple)</label>
                        <select 
                          multiple 
                          className="input-field text-sm min-h-[80px]"
                          value={newGenCatFloors}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions, (option: any) => option.value);
                            setNewGenCatFloors(selected.includes('all') ? [] : selected);
                          }}
                        >
                          <option value="all">All Floors</option>
                          {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <p className="text-xs text-muted-foreground">Select 'All Floors' or leave unselected to apply to all floors.</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground transition-colors">
                            <input type="checkbox" className="rounded border-border bg-background text-primary" checked={newGenCatDiesel} onChange={e=>setNewGenCatDiesel(e.target.checked)} /> 
                            Diesel Controlled?
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground transition-colors">
                            <input type="checkbox" className="rounded border-border bg-background text-primary" checked={newGenCatEnabled} onChange={e=>setNewGenCatEnabled(e.target.checked)} /> 
                            Enabled
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {setShowAddGeneralCat(false); setEditGenCatId(null);}} className="text-xs px-3 py-1.5 text-muted-foreground hover:bg-background rounded">Cancel</button>
                          <button onClick={() => {
                            if (!newGenCatTitle) return;
                            const catData = {
                              id: editGenCatId || generateId(),
                              title: newGenCatTitle,
                              limit: newGenCatLimit,
                              dieselControlled: newGenCatDiesel,
                              enabled: newGenCatEnabled,
                              floors: newGenCatFloors
                            };
                            if (editGenCatId) {
                              updateSetting('generalCategories', settings.generalCategories.map(c => c.id === editGenCatId ? catData : c));
                            } else {
                              updateSetting('generalCategories', [...settings.generalCategories, catData]);
                            }
                            setShowAddGeneralCat(false);
                            setEditGenCatId(null);
                            setNewGenCatTitle('');
                            setNewGenCatLimit(0);
                            setNewGenCatDiesel(false);
                            setNewGenCatEnabled(true);
                            setNewGenCatFloors([]);
                          }} className="btn-primary px-4 py-1.5 text-xs">{editGenCatId ? 'Save Edits' : 'Add Category'}</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase">
                        <tr><th className="py-2 px-1">Title</th><th className="py-2 px-1">Limit</th><th className="py-2 px-1">Floors</th><th className="py-2 px-1">Diesel?</th><th className="py-2 px-1">Status</th><th className="py-2 px-1 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {settings.generalCategories.map(c => (
                          <tr key={c.id} className={`group ${c.enabled === false ? 'opacity-50' : ''}`}>
                            <td className="py-3 px-1 font-medium">{c.title}</td>
                            <td className="py-3 px-1">{c.limit > 0 ? <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">Rs {c.limit}</span> : <span className="text-muted-foreground text-xs italic">No Limit</span>}</td>
                            <td className="py-3 px-1">
                              {(!c.floors || c.floors.length === 0) ? <span className="text-muted-foreground text-xs">All Floors</span> : <span className="text-xs bg-secondary/50 px-2 py-0.5 rounded break-words max-w-[150px] inline-block">{c.floors.join(', ')}</span>}
                            </td>
                            <td className="py-3 px-1">{c.dieselControlled ? <span className="text-emerald-500 font-medium text-xs">Yes</span> : <span className="text-muted-foreground text-xs">No</span>}</td>
                            <td className="py-3 px-1">
                              <button
                                onClick={() => updateSetting('generalCategories', settings.generalCategories.map(cat => cat.id === c.id ? {...cat, enabled: c.enabled === false ? true : false} : cat))}
                                className={`text-xs px-2 py-1 rounded font-medium transition-colors ${c.enabled === false ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}`}
                              >
                                {c.enabled === false ? 'Disabled' : 'Enabled'}
                              </button>
                            </td>
                            <td className="py-3 px-1 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => {
                                  setEditGenCatId(c.id);
                                  setNewGenCatTitle(c.title);
                                  setNewGenCatLimit(c.limit);
                                  setNewGenCatDiesel(c.dieselControlled || false);
                                  setNewGenCatEnabled(c.enabled !== false);
                                  setNewGenCatFloors(c.floors || []);
                                  setShowAddGeneralCat(true);
                                }} className="text-primary hover:bg-primary/10 px-2 py-1 rounded text-xs font-semibold transition-colors">EDIT</button>
                                <button onClick={() => updateSetting('generalCategories', settings.generalCategories.filter(x => x.id !== c.id))} className="text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-heading font-semibold text-lg">Lift Expense Categories</h3>
                    {!showAddLiftCat && (
                      <button onClick={() => setShowAddLiftCat(true)} className="text-xs flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"><Plus className="w-3 h-3"/> Add</button>
                    )}
                  </div>
                  
                  {showAddLiftCat && (
                    <div className="flex flex-col gap-3 mt-2 bg-secondary/50 p-4 rounded-xl border border-border/50">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input type="text" placeholder="Category Title" className="input-field text-sm flex-1" value={newLiftCatTitle} onChange={e=>setNewLiftCatTitle(e.target.value)} />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs</span>
                          <input type="number" placeholder="Limit (0=Unlim)" className="input-field text-sm w-full sm:w-32 pl-8" value={newLiftCatLimit} onChange={e=>setNewLiftCatLimit(parseInt(e.target.value)||0)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Applied Floors (Hold Ctrl/Cmd or select multiple)</label>
                        <select 
                          multiple 
                          className="input-field text-sm min-h-[80px]"
                          value={newLiftCatFloors}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions, (option: any) => option.value);
                            setNewLiftCatFloors(selected.includes('all') ? [] : selected);
                          }}
                        >
                          <option value="all">All Floors</option>
                          {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <p className="text-xs text-muted-foreground">Select 'All Floors' or leave unselected to apply to all floors.</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground transition-colors">
                            <input type="checkbox" className="rounded border-border bg-background text-primary" checked={newLiftCatEnabled} onChange={e=>setNewLiftCatEnabled(e.target.checked)} /> 
                            Enabled
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {setShowAddLiftCat(false); setEditLiftCatId(null);}} className="text-xs px-3 py-1.5 text-muted-foreground hover:bg-background rounded">Cancel</button>
                          <button onClick={() => {
                            if (!newLiftCatTitle) return;
                            const catData = {
                              id: editLiftCatId || generateId(),
                              title: newLiftCatTitle,
                              limit: newLiftCatLimit,
                              enabled: newLiftCatEnabled,
                              floors: newLiftCatFloors
                            };
                            if (editLiftCatId) {
                              updateSetting('liftCategories', settings.liftCategories.map(c => c.id === editLiftCatId ? catData : c));
                            } else {
                              updateSetting('liftCategories', [...settings.liftCategories, catData]);
                            }
                            setShowAddLiftCat(false);
                            setEditLiftCatId(null);
                            setNewLiftCatTitle('');
                            setNewLiftCatLimit(0);
                            setNewLiftCatEnabled(true);
                            setNewLiftCatFloors([]);
                          }} className="btn-primary px-4 py-1.5 text-xs">{editLiftCatId ? 'Save Edits' : 'Add Category'}</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase">
                        <tr><th className="py-2 px-1">Title</th><th className="py-2 px-1">Limit</th><th className="py-2 px-1">Floors</th><th className="py-2 px-1">Status</th><th className="py-2 px-1 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {settings.liftCategories.map(c => (
                          <tr key={c.id} className={`group ${c.enabled === false ? 'opacity-50' : ''}`}>
                            <td className="py-3 px-1 font-medium">{c.title}</td>
                            <td className="py-3 px-1">{c.limit > 0 ? <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">Rs {c.limit}</span> : <span className="text-muted-foreground text-xs italic">No Limit</span>}</td>
                            <td className="py-3 px-1">
                              {(!c.floors || c.floors.length === 0) ? <span className="text-muted-foreground text-xs">All Floors</span> : <span className="text-xs bg-secondary/50 px-2 py-0.5 rounded break-words max-w-[150px] inline-block">{c.floors.join(', ')}</span>}
                            </td>
                            <td className="py-3 px-1">
                              <button
                                onClick={() => updateSetting('liftCategories', settings.liftCategories.map(cat => cat.id === c.id ? {...cat, enabled: c.enabled === false ? true : false} : cat))}
                                className={`text-xs px-2 py-1 rounded font-medium transition-colors ${c.enabled === false ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}`}
                              >
                                {c.enabled === false ? 'Disabled' : 'Enabled'}
                              </button>
                            </td>
                            <td className="py-3 px-1 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => {
                                  setEditLiftCatId(c.id);
                                  setNewLiftCatTitle(c.title);
                                  setNewLiftCatLimit(c.limit);
                                  setNewLiftCatEnabled(c.enabled !== false);
                                  setNewLiftCatFloors(c.floors || []);
                                  setShowAddLiftCat(true);
                                }} className="text-primary hover:bg-primary/10 px-2 py-1 rounded text-xs font-semibold transition-colors">EDIT</button>
                                <button onClick={() => updateSetting('liftCategories', settings.liftCategories.filter(x => x.id !== c.id))} className="text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'floors' && (
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-heading font-semibold text-lg hover:underline transition-all">Floor Management</h3>
                    {!showAddFloor && (
                      <button onClick={() => setShowAddFloor(true)} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium border border-primary/20 hover:bg-primary/20 transition-colors"><Plus className="w-3.5 h-3.5"/> Add New</button>
                    )}
                  </div>
                  
                  {showAddFloor && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2 bg-secondary/30 p-4 rounded-xl border border-border/50 border-l-4 border-l-primary">
                      <input type="text" placeholder="Floor No. (e.g. 1st Floor)" className="input-field text-sm w-full sm:w-1/3" value={newFloorName} onChange={e=>setNewFloorName(e.target.value)} />
                      <input type="text" placeholder="Business Name (Optional)" className="input-field text-sm flex-1 w-full" value={newFloorBusiness} onChange={e=>setNewFloorBusiness(e.target.value)} />
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => {
                          if (!newFloorName) return;
                          const f = newFloorBusiness ? `${newFloorName} (${newFloorBusiness})` : newFloorName;
                          if (!settings.floors.includes(f)) updateSetting('floors', [...settings.floors, f]);
                          setShowAddFloor(false);
                          setNewFloorName('');
                          setNewFloorBusiness('');
                        }} className="btn-primary px-4 py-2 text-sm flex-1 sm:flex-auto">Add</button>
                        <button onClick={() => setShowAddFloor(false)} className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {settings.floors.map(f => (
                      <div key={f} className="flex items-center justify-between bg-background p-3 rounded-xl border group hover:border-primary/30 transition-colors">
                        <span className="font-medium text-sm">{f}</span>
                        <button onClick={() => updateSetting('floors', settings.floors.filter(x=>x!==f))} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="sticky bottom-0 bg-background/80 backdrop-blur-md pt-4 pb-2 border-t border-border mt-8 flex flex-row justify-end items-center gap-4">
              <button onClick={handleSaveSettings} className="btn-primary w-full sm:w-auto px-8 mx-0 mb-4 sm:mb-0">Save All Settings</button>
            </div>
          </div>
        )}

        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-border/50"><h3 className="font-heading font-semibold text-lg">Pending Additional Expenses</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr><th className="px-6 py-4">User</th><th className="px-6 py-4">Expense Title</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Date Submited</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {pending.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).map(p => (
                    <tr key={p.id} className="hover:bg-secondary/20">
                      <td className="px-6 py-4 font-medium text-foreground">{p.userName}</td>
                      <td className="px-6 py-4">{p.title}</td>
                      <td className="px-6 py-4 font-mono font-medium">Rs {p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{formatDateTimeDMY(p.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${p.status==='pending'?'bg-amber-500/10 text-amber-600 border-amber-500/20':p.status==='approved'?'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':'bg-destructive/10 text-destructive border-destructive/20'}`}>{p.status.toUpperCase()}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={()=>handleApproval(p.id, 'approved')} className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded hover:bg-emerald-500/20 font-medium">Approve</button>
                            <button onClick={()=>handleApproval(p.id, 'rejected')} className="text-xs px-3 py-1.5 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 font-medium">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pending.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No pending expenses to review.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-lg">System Activity Logs</h3>
              <div className="flex bg-secondary/50 p-1 rounded-xl">
                <button 
                  onClick={() => setLogFilter('all')} 
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${logFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  All Logs
                </button>
                <button 
                  onClick={() => setLogFilter('edits')} 
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${logFilter === 'edits' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Edit History
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr><th className="px-6 py-4">Date & Time</th><th className="px-6 py-4">User</th><th className="px-6 py-4">Action Type</th><th className="px-6 py-4">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs
                    .filter(log => logFilter === 'all' || ['BILL_EDITED', 'SETTING_UPDATED'].includes(log.action))
                    .sort((a,b)=>new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 100).map(log => (
                    <tr key={log.id} className="hover:bg-secondary/20">
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">{formatDateTimeDMY(log.timestamp)}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{log.userName}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono bg-secondary px-2 py-1 rounded border text-muted-foreground tracking-wider">{log.action}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{log.details}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No activity logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* EXPORT DATA TAB */}
        {activeTab === 'export' && (
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-border/50">
              <h3 className="font-heading font-semibold text-lg">Export Financial Data</h3>
              <p className="text-sm text-muted-foreground mt-1">Generate a comprehensive PDF report of all bills across categories.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleExportData} className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Floor</label>
                  <select 
                    className="input-field w-full"
                    value={exportFloor}
                    onChange={e => setExportFloor(e.target.value)}
                  >
                    <option value="all">All Floors</option>
                    {settings?.floors.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Period <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <input 
                    type="month" 
                    className="input-field w-full"
                    value={exportFrom}
                    onChange={e => setExportFrom(e.target.value)}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To Period <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <input 
                    type="month" 
                    className="input-field w-full"
                    value={exportTo}
                    onChange={e => setExportTo(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-3 pt-4 border-t border-border/50">
                  <button type="submit" className="btn-primary w-full sm:w-auto px-8 flex items-center justify-center">
                    <Download className="w-4 h-4 mr-2" /> Download Report PDF
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
