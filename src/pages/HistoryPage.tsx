import React, { useState, useEffect, useMemo } from 'react';
import { User, Bill, Receipt } from '../lib/store';
import { pullAllFromFirestore, pushDeleteBill, pushDeleteReceipt, subscribeToChanges } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, FileText, Download, Trash2, FileIcon, Edit2, X, BarChart2, Plus } from 'lucide-react';
import { formatDateTimeDMY, formatDateDMY } from '../lib/utils';
import { generateBillPDF } from '../lib/pdfGenerator';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const MONTHS = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['All', '2024', '2025', '2026', '2027', '2028', '2029', '2030'];

export function HistoryPage({ user }: { user: User | null }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'bills' | 'receipts' | 'charts'>('bills');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [chartFloorFilter, setChartFloorFilter] = useState('All');

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'bill' | 'receipt', id: string } | null>(null);
  const [editBill, setEditBill] = useState<Bill | null>(null);

  useEffect(() => {
    let unmounted = false;
    
    // Initial fetch to clear loading state
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setBills(user?.role === 'admin' ? data.bills : data.bills.filter(b => b.userId === user?.id));
        setReceipts(user?.role === 'admin' ? data.receipts : data.receipts.filter(r => r.userId === user?.id));
      }
      setLoading(false);
    });

    // Real-time updates
    const unsub = subscribeToChanges((data, collectionName) => {
      if (unmounted) return;
      if (collectionName === 'bills') {
        setBills(user?.role === 'admin' ? data : data.filter((b: Bill) => b.userId === user?.id));
      }
      if (collectionName === 'receipts') {
        setReceipts(user?.role === 'admin' ? data : data.filter((r: Receipt) => r.userId === user?.id));
      }
    });

    return () => {
      unmounted = true;
      unsub();
    };
  }, [user]);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    
    try {
      if (type === 'bill') {
        await pushDeleteBill(id);
        setBills(prev => prev.filter(b => b.id !== id));
        toast.success('Bill deleted successfully');
      } else {
        await pushDeleteReceipt(id);
        setReceipts(prev => prev.filter(r => r.id !== id));
        toast.success('Receipt deleted successfully');
      }
    } catch {
      toast.error(`Failed to delete ${type}`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBill) return;
    
    try {
      const oldBill = bills.find(b => b.id === editBill.id);

      let totalAmount = editBill.expenses.reduce((sum, e) => sum + e.amount, 0);
      if (editBill.additionalExpenses) {
        totalAmount += editBill.additionalExpenses.reduce((sum, e) => sum + e.amount, 0);
      }
      
      const updatedBill = { ...editBill, totalAmount };
      
      const m = await import('../lib/firestoreSync');
      await m.pushBill(updatedBill);
      
      if (oldBill && user) {
        const { generateId } = await import('../lib/utils');
        await m.pushActivityLog({
          id: generateId(),
          userId: user.id,
          userName: user.fullName,
          username: user.username,
          action: 'BILL_EDITED',
          details: `Edited bill ID ${updatedBill.id} (${updatedBill.month} ${updatedBill.year}). Amount changed from ${oldBill.totalAmount} to ${updatedBill.totalAmount}.`,
          timestamp: new Date().toISOString()
        });
      }
      
      setBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b));
      toast.success('Bill updated successfully');
      setEditBill(null);
    } catch {
      toast.error('Failed to update bill');
    }
  };

  const filteredBills = bills.filter(b => 
    (filterMonth === 'All' || b.month === filterMonth) &&
    (filterYear === 'All' || b.year === filterYear)
  ).sort((a, b) => {
    const da = new Date(a.generatedAt).getTime();
    const db = new Date(b.generatedAt).getTime();
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });

  // For receipts we don't have month/year explicitly, but we can filter by uploadedAt
  const filteredReceipts = receipts.filter(r => {
    if (filterMonth === 'All' && filterYear === 'All') return true;
    try {
      const rd = new Date(r.uploadedAt);
      if (isNaN(rd.getTime())) return true; // Keep invalid dates if we can't filter
      const rm = rd.toLocaleString('en-US', { month: 'long' });
      const ry = rd.getFullYear().toString();
      return (filterMonth === 'All' || rm === filterMonth) && (filterYear === 'All' || ry === filterYear);
    } catch {
      return true;
    }
  }).sort((a, b) => {
    const da = new Date(a.uploadedAt).getTime();
    const db = new Date(b.uploadedAt).getTime();
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });

  const monthlyRevenueData = useMemo(() => {
    if (activeTab !== 'charts') return [];
    const yearToTrack = filterYear !== 'All' ? filterYear : new Date().getFullYear().toString();
    const yearBills = bills.filter(b => b.year === yearToTrack && (chartFloorFilter === 'All' || b.floor === chartFloorFilter));
    
    return MONTHS.filter(m => m !== 'All').map(month => {
      const mbills = yearBills.filter(b => b.month === month);
      const total = mbills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      return {
        name: month.substring(0, 3),
        total,
        count: mbills.length,
        fullName: month
      };
    });
  }, [bills, filterYear, chartFloorFilter, activeTab]);

  const allFloors = useMemo(() => {
    const floorSet = new Set<string>();
    bills.forEach(b => { if (b.floor) floorSet.add(b.floor); });
    return Array.from(floorSet).sort();
  }, [bills]);


  if (loading || !user) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">History</h1>
          <p className="text-muted-foreground">View past bills and uploaded receipts</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="input-field min-w-[120px]" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input-field min-w-[100px]" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex bg-secondary/50 p-1 rounded-xl w-fit">
        <button 
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'bills' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('bills')}
        >
          Bills
        </button>
        <button 
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'receipts' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('receipts')}
        >
          Receipts
        </button>
        <button 
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'charts' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('charts')}
        >
          <BarChart2 className="w-4 h-4" /> Charts
        </button>
      </div>

      {activeTab === 'charts' && (
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading font-semibold text-lg">Revenue by Month for {filterYear !== 'All' ? filterYear : new Date().getFullYear()}</h3>
            <select className="input-field min-w-[200px]" value={chartFloorFilter} onChange={e => setChartFloorFilter(e.target.value)}>
              <option value="All">All Floors</option>
              {allFloors.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Rs ${value}`} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value: number) => [`Rs ${value.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(name) => {
                    const item = monthlyRevenueData.find(m => m.name === name);
                    return item ? item.fullName : name;
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {monthlyRevenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab !== 'charts' && (
      <div className="glass-card overflow-hidden">
        {activeTab === 'bills' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Month/Year</th>
                  <th className="px-6 py-4 font-medium">Floor</th>
                  {user?.role === 'admin' && <th className="px-6 py-4 font-medium">User</th>}
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Generated At</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredBills.map(bill => (
                  <tr key={bill.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                        bill.type === 'general' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {bill.type === 'general' ? 'General' : 'Lift'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{bill.month} {bill.year}</td>
                    <td className="px-6 py-4 text-muted-foreground">{bill.floor}</td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 font-medium">
                        {bill.userName}
                      </td>
                    )}
                    <td className="px-6 py-4 font-mono">Rs {(bill.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDateTimeDMY(bill.generatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => generateBillPDF(bill)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button 
                              onClick={() => setEditBill(bill)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                              title="Edit Bill"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm({ type: 'bill', id: bill.id })}
                              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">
                      No bills found matching the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">File Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Floor</th>
                  {user?.role === 'admin' && <th className="px-6 py-4 font-medium">Uploaded By</th>}
                  <th className="px-6 py-4 font-medium">Paid Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredReceipts.map(receipt => (
                  <tr key={receipt.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {receipt.fileData.startsWith('data:image') ? (
                          <img src={receipt.fileData} alt="" className="w-8 h-8 rounded object-cover ring-1 ring-border" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center ring-1 ring-border">
                            <FileIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-foreground truncate max-w-[200px]" title={receipt.fileName}>{receipt.fileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border">
                        {receipt.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {receipt.floor || 'N/A'}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 font-medium">{receipt.userName}</td>
                    )}
                    <td className="px-6 py-4 text-muted-foreground">
                      {receipt.paidDate ? (
                        (() => {
                          try {
                            return formatDateDMY(new Date(receipt.paidDate).toISOString());
                          } catch {
                            return 'Invalid Date';
                          }
                        })()
                      ) : 'N/A'}
                      <div className="text-[10px] opacity-70">Up: {formatDateDMY(receipt.uploadedAt)}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={receipt.fileData}
                          download={receipt.fileName}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20 flex items-center gap-2 text-xs font-medium"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                        {(user?.role === 'admin' || receipt.userId === user?.id) && (
                          <button 
                            onClick={() => setDeleteConfirm({ type: 'receipt', id: receipt.id })}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
                            title="Delete Receipt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-muted-foreground">
                      No receipts found matching the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl relative z-10 overflow-hidden p-6 text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-semibold text-lg">Confirm Deletion</h3>
              <p className="text-muted-foreground text-sm">
                Are you sure you want to permanently delete this {deleteConfirm.type}? This action cannot be undone.
              </p>
              <div className="pt-4 flex items-center gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={confirmDelete} className="btn-primary bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditBill(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-card w-full max-w-2xl rounded-2xl border border-border/50 shadow-2xl relative z-10 overflow-hidden my-auto px-6 py-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="font-heading font-semibold text-xl">Edit Bill ({editBill.month} {editBill.year})</h3>
                <button onClick={() => setEditBill(null)} className="p-2 hover:bg-secondary rounded-full transition-colors"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-widest font-bold">Regular Expenses</h4>
                  {editBill.expenses.map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input className="input-field flex-1" value={exp.title ?? ''} onChange={e => {
                        const newExp = [...editBill.expenses];
                        newExp[idx].title = e.target.value;
                        setEditBill({...editBill, expenses: newExp});
                      }} />
                      <input type="number" className="input-field w-32 text-right" value={exp.amount || ''} onChange={e => {
                        const newExp = [...editBill.expenses];
                        newExp[idx].amount = parseInt(e.target.value) || 0;
                        setEditBill({...editBill, expenses: newExp});
                      }} />
                      <button 
                        onClick={() => {
                          const newExp = editBill.expenses.filter((_, i) => i !== idx);
                          setEditBill({...editBill, expenses: newExp});
                        }}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-widest font-bold">Additional Expenses</h4>
                    <button 
                      onClick={() => {
                        const newAdd = [...(editBill.additionalExpenses || []), { title: '', amount: 0, approved: true }];
                        setEditBill({...editBill, additionalExpenses: newAdd});
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New
                    </button>
                  </div>
                  {(editBill.additionalExpenses || []).map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-dashed border-border">
                      <input 
                        placeholder="Title"
                        className="bg-transparent border-none focus:ring-0 flex-1 text-sm font-medium" 
                        value={exp.title ?? ''} 
                        onChange={e => {
                          const newExp = [...(editBill.additionalExpenses||[])];
                          newExp[idx].title = e.target.value;
                          setEditBill({...editBill, additionalExpenses: newExp});
                        }} 
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Rs</span>
                        <input 
                          type="number" 
                          placeholder="Amount"
                          className="bg-transparent border-none focus:ring-0 w-24 text-right text-sm font-mono" 
                          value={exp.amount || ''} 
                          onChange={e => {
                            const newExp = [...(editBill.additionalExpenses||[])];
                            newExp[idx].amount = parseInt(e.target.value) || 0;
                            setEditBill({...editBill, additionalExpenses: newExp});
                          }} 
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const newExp = (editBill.additionalExpenses || []).filter((_, i) => i !== idx);
                          setEditBill({...editBill, additionalExpenses: newExp});
                        }}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!editBill.additionalExpenses || editBill.additionalExpenses.length === 0) && (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No additional expenses added yet.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t flex flex-col sm:flex-row items-center sm:justify-between gap-4">
                <div className="text-xl font-heading font-bold text-foreground">
                  Total: <span className="text-primary">Rs {(editBill.expenses.reduce((s, e)=>s+e.amount, 0) + (editBill.additionalExpenses?.reduce((s, e)=>s+e.amount, 0)||0)).toLocaleString()}</span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={() => setEditBill(null)} className="btn-secondary flex-1 sm:flex-none">Cancel</button>
                  <button onClick={handleSaveEdit} className="btn-primary flex-1 sm:flex-none shadow-lg shadow-primary/20">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
