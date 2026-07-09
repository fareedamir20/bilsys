import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { User, SystemSettings, Bill, PendingExpense, AdditionalExpense } from '../lib/store';
import { pullAllFromFirestore, pushBill, pushActivityLog, pushPendingExpense } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { generateBillPDF } from '../lib/pdfGenerator';
import { CalendarIcon, Loader2, FileCheck2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['2024', '2025', '2026', '2027', '2028'];

export function GenerateBillPage({ user }: { user: User | null }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allBills, setAllBills] = useState<Bill[]>([]);

  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [floor, setFloor] = useState('');
  
  const [expenses, setExpenses] = useState<Record<string, number>>({});
  const [additional, setAdditional] = useState<AdditionalExpense[]>([
    { title: '', amount: 0 },
    { title: '', amount: 0 },
    { title: '', amount: 0 },
  ]);

  useEffect(() => {
    pullAllFromFirestore().then(data => {
      if (data?.settings) {
        setSettings(data.settings);
        if (data.settings.floors.length > 0) {
          setFloor(data.settings.floors[0]);
        }
      }
      if (data?.bills) {
        setAllBills(data.bills);
      }
      setLoading(false);
    });
  }, []);

  if (loading || !settings || !user) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const validCategories = settings.generalCategories.filter(c => {
    if (c.enabled === false) return false;
    if (c.floors && c.floors.length > 0 && !c.floors.includes(floor)) return false;
    if (c.dieselControlled && !settings.dieselMonths.includes(month)) {
      return false;
    }
    return true;
  });

  const handleExpenseChange = (id: string, value: string) => {
    const val = parseInt(value, 10);
    setExpenses(prev => ({ ...prev, [id]: isNaN(val) ? 0 : val }));
  };

  const handleAdditionalChange = (index: number, field: 'title' | 'amount', value: string) => {
    const newAdd = [...additional];
    if (field === 'amount') {
      const val = parseInt(value, 10);
      newAdd[index].amount = isNaN(val) ? 0 : val;
    } else {
      newAdd[index].title = value;
    }
    setAdditional(newAdd);
  };

  const calculateTotal = () => {
    let sum = 0;
    validCategories.forEach(c => {
      sum += expenses[c.id] || 0;
    });
    additional.forEach(a => {
      if (a.title.trim() !== '' && a.amount > 0) {
        sum += a.amount;
      }
    });
    return sum;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) return toast.error('Please select a due date');
    if (!floor) return toast.error('Please select a floor');

    // Limit Validation
    for (const cat of validCategories) {
      if (cat.limit > 0 && (expenses[cat.id] || 0) > cat.limit) {
        return toast.error(`Limit exceeded for ${cat.title}. Max allowed: ${cat.limit}`);
      }
    }

    // Additional Validation
    const validAdditional: AdditionalExpense[] = [];
    for (let i = 0; i < additional.length; i++) {
        const a = additional[i];
        if (a.title.trim() !== '' || a.amount > 0) {
             if (a.title.trim() === '' || a.amount <= 0) {
                 return toast.error(`Additional Expense #${i + 1} must have both title and a valid amount.`);
             }
             validAdditional.push({ ...a });
        }
    }

    // Max bills check
    const userBillsThisMonthType = allBills.filter(b => b.userId === user.id && b.month === month && b.year === year && b.type === 'general');
    if (userBillsThisMonthType.length >= settings.maxBillsPerMonth) {
        return toast.error(`You have reached the maximum number of General bills (${settings.maxBillsPerMonth}) for ${month} ${year}.`);
    }

    setSubmitting(true);

    try {
      const billId = generateId();
      const finalExpenses = validCategories.map(c => ({ title: c.title, amount: expenses[c.id] || 0 })).filter(e => e.amount > 0);
      const totalAmt = calculateTotal();

      const newBill: Bill = {
        id: billId,
        type: 'general',
        userId: user.id,
        userName: user.fullName,
        month,
        year,
        floor,
        dueDate: dueDate.toISOString(),
        expenses: finalExpenses,
        additionalExpenses: validAdditional,
        totalAmount: totalAmt,
        generatedAt: new Date().toISOString(),
        generatedBy: user.username
      };

      await pushBill(newBill);

      for (const ae of validAdditional) {
        await pushPendingExpense({
          id: generateId(),
          billId,
          userId: user.id,
          userName: user.fullName,
          title: ae.title,
          amount: ae.amount,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      await pushActivityLog({
        id: generateId(),
        userId: user.id,
        userName: user.fullName,
        username: user.username,
        action: 'BILL_GENERATED',
        details: `Generated General Bill for ${month} ${year} (Total: Rs ${totalAmt})`,
        timestamp: new Date().toISOString()
      });

      generateBillPDF(newBill);
      toast.success('Bill generated and PDF downloaded successfully.');
      
      setMonth('');
      setYear('');
      setFloor('');
      setDueDate(undefined);
      setExpenses({});
      setAdditional([
        { title: '', amount: 0 },
        { title: '', amount: 0 },
        { title: '', amount: 0 },
      ]);
      
      // Update local allBills
      setAllBills(prev => [...prev, newBill]);

    } catch (e) {
      console.error(e);
      toast.error('Failed to generate bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Generate General Bill</h1>
        <p className="text-muted-foreground">Create a new general bill for the current month. The PDF will be automatically generated.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Config */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-heading font-semibold text-lg border-b border-border/50 pb-2">Billing Period</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Month</label>
                <select className="input-field w-full" value={month} onChange={e => setMonth(e.target.value)} required>
                  <option value="" disabled>Select Month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Year</label>
                <select className="input-field w-full" value={year} onChange={e => setYear(e.target.value)} required>
                  <option value="" disabled>Select Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Floor</label>
                <select className="input-field w-full" value={floor} onChange={e => setFloor(e.target.value)} required>
                  <option value="" disabled>Select Floor</option>
                  {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-sm font-medium">Due Date</label>
                <Popover>
                  <PopoverTrigger className={`input-field flex w-full text-left items-center justify-between ${!dueDate ? 'text-muted-foreground' : ''}`}>
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="w-4 h-4 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-border bg-card" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Expenses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="font-heading font-semibold text-lg border-b border-border/50 pb-2">Expense Details</h3>
            
            <div className="space-y-4">
              {validCategories.map(category => (
                <div key={category.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium">{category.title}</label>
                  </div>
                  <div className="relative w-full sm:w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs</span>
                    <input 
                      type="number" 
                      min="0"
                      className="input-field w-full pl-9" 
                      value={expenses[category.id] === undefined ? '' : expenses[category.id].toString()}
                      onChange={e => handleExpenseChange(category.id, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Additional Expenses</h4>
              </div>
              
              <div className="space-y-3">
                {additional.map((ae, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      placeholder="Expense Title" 
                      className="input-field w-full sm:flex-1"
                      value={ae.title}
                      onChange={e => handleAdditionalChange(i, 'title', e.target.value)}
                    />
                    <div className="relative w-full sm:w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs</span>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field w-full pl-9"
                        placeholder="0"
                        value={ae.amount === 0 ? '' : ae.amount.toString()}
                        onChange={e => handleAdditionalChange(i, 'amount', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Additional expenses will be marked as pending until approved by an administrator.</p>
            </div>

            <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount Payable</p>
                <p className="text-3xl font-heading font-bold text-primary">Rs {calculateTotal().toLocaleString()}</p>
              </div>
              
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-primary flex items-center gap-2 w-full sm:w-auto"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck2 className="w-5 h-5" />}
                {submitting ? 'Generating...' : 'Generate Bill'}
              </button>
            </div>
            
          </div>
        </div>

      </form>
    </div>
  );
}
