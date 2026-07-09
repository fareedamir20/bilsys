import React, { useState, useEffect, useMemo } from 'react';
import { User, Bill, Receipt } from '../lib/store';
import { pullAllFromFirestore, subscribeToChanges } from '../lib/firestoreSync';
import { Loader2, TrendingUp, TrendingDown, DollarSign, FileText, Layers, BarChart2 } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function AnalyticsPage({ user }: { user: User | null }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('All');

  useEffect(() => {
    let unmounted = false;
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setBills(user?.role === 'admin' ? data.bills : data.bills.filter(b => b.userId === user?.id));
        setReceipts(user?.role === 'admin' ? data.receipts : data.receipts.filter(r => r.userId === user?.id));
      }
      setLoading(false);
    });

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

  const filteredBills = useMemo(() => {
    if (selectedYear === 'All') return bills;
    return bills.filter(b => b.year === selectedYear);
  }, [bills, selectedYear]);

  const yearsAvailable = useMemo(() => {
    const years = new Set(bills.map(b => b.year));
    return ['All', ...Array.from(years).sort()];
  }, [bills]);

  const metrics = useMemo(() => {
    const totalRevenue = filteredBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const avgBill = filteredBills.length > 0 ? totalRevenue / filteredBills.length : 0;
    
    const generalBills = filteredBills.filter(b => b.type === 'general');
    const liftBills = filteredBills.filter(b => b.type === 'lift');
    
    const avgGeneral = generalBills.length > 0 ? generalBills.reduce((acc, b) => acc + b.totalAmount, 0) / generalBills.length : 0;
    const avgLift = liftBills.length > 0 ? liftBills.reduce((acc, b) => acc + b.totalAmount, 0) / liftBills.length : 0;

    // Additional Expenses
    const totalAdditionalFees = filteredBills.reduce((acc, b) => acc + (b.additionalExpenses?.reduce((s, e) => s + e.amount, 0) || 0), 0);

    const largestBill = filteredBills.reduce((max, b) => b.totalAmount > (max?.totalAmount || 0) ? b : max, null as Bill | null);

    // Busiest day
    const dayCounts = [0,0,0,0,0,0,0];
    filteredBills.forEach(b => {
      dayCounts[new Date(b.generatedAt).getDay()]++;
    });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const busiestDay = Math.max(...dayCounts) > 0 ? days[maxDayIdx] : 'None';

    // Sort bills by date
    const sorted = [...filteredBills].sort((a,b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime());
    let monthOverMonth = 0;
    if (sorted.length >= 2) {
      const half = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, half).reduce((acc, b) => acc + b.totalAmount, 0);
      const secondHalf = sorted.slice(half).reduce((acc, b) => acc + b.totalAmount, 0);
      if (firstHalf > 0) {
        monthOverMonth = ((secondHalf - firstHalf) / firstHalf) * 100;
      }
    }

    return {
      totalRevenue,
      avgBill,
      avgGeneral,
      avgLift,
      totalBills: filteredBills.length,
      receiptsCount: receipts.length,
      collectionRatio: filteredBills.length > 0 ? ((receipts.length / filteredBills.length) * 100).toFixed(1) : '0',
      totalAdditionalFees,
      largestBillAmount: largestBill?.totalAmount || 0,
      largestBillFloor: largestBill?.floor || 'N/A',
      busiestDay,
      momStr: monthOverMonth.toFixed(1)
    };
  }, [filteredBills, receipts]);

  const revenueByMonthData = useMemo(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const data = months.map(m => ({ name: m.substring(0, 3), general: 0, lift: 0, total: 0 }));
    
    filteredBills.forEach(b => {
      const mIndex = months.indexOf(b.month);
      if (mIndex !== -1) {
        if (b.type === 'general') data[mIndex].general += b.totalAmount;
        if (b.type === 'lift') data[mIndex].lift += b.totalAmount;
        data[mIndex].total += b.totalAmount;
      }
    });
    
    // Filter out future months if they are completely empty (optional, keeping all 12 for timeline)
    return data;
  }, [filteredBills]);

  const floorData = useMemo(() => {
    const fMap = new Map<string, number>();
    filteredBills.forEach(b => {
      fMap.set(b.floor, (fMap.get(b.floor) || 0) + b.totalAmount);
    });
    return Array.from(fMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredBills]);

  const typeData = useMemo(() => {
    let general = 0;
    let lift = 0;
    filteredBills.forEach(b => {
      if (b.type === 'general') general += b.totalAmount;
      if (b.type === 'lift') lift += b.totalAmount;
    });
    return [
      { name: 'General', value: general },
      { name: 'Lift', value: lift }
    ];
  }, [filteredBills]);

  const categoryBreakdown = useMemo(() => {
    const cMap = new Map<string, { value: number, count: number }>();
    filteredBills.forEach(b => {
      b.expenses.forEach(e => {
        const current = cMap.get(e.title) || { value: 0, count: 0 };
        cMap.set(e.title, { value: current.value + e.amount, count: current.count + 1 });
      });
      b.additionalExpenses?.forEach(e => {
        const current = cMap.get(e.title) || { value: 0, count: 0 };
        cMap.set(e.title, { value: current.value + e.amount, count: current.count + 1 });
      });
    });
    return Array.from(cMap.entries())
      .map(([name, data]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        value: data.value,
        count: data.count,
        fullName: name
      }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 20); // Top 20
  }, [filteredBills]);

  if (loading || !user) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Advanced Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights into your billing data</p>
        </div>
        <div>
          <select 
            className="input-field min-w-[120px]" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {yearsAvailable.map(y => <option key={y} value={y}>{y === 'All' ? 'All Time' : y}</option>)}
          </select>
        </div>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Total Revenue</h3>
          </div>
          <div className="text-3xl font-bold font-mono">Rs {metrics.totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" /> 
            from selected period
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Total Bills</h3>
          </div>
          <div className="text-3xl font-bold font-mono">{metrics.totalBills}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Generated in {selectedYear === 'All' ? 'total' : selectedYear}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Avg Bill Amount</h3>
          </div>
          <div className="text-3xl font-bold font-mono">Rs {Math.round(metrics.avgBill).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Per generated bill
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Layers className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Growth Indicator</h3>
          </div>
          <div className="text-3xl font-bold font-mono group flex items-center gap-2">
             {parseFloat(metrics.momStr) > 0 ? '+' : ''}{metrics.momStr}%
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Based on chronological split
          </div>
        </div>
        
        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FileText className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Total Receipts</h3>
          </div>
          <div className="text-3xl font-bold font-mono">{metrics.receiptsCount}</div>
          <div className="text-xs text-muted-foreground mt-2">
             ~{metrics.collectionRatio}% Collection Rate
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <TrendingDown className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Largest Bill</h3>
          </div>
          <div className="text-3xl font-bold font-mono">Rs {metrics.largestBillAmount.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Floor: {metrics.largestBillFloor}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <DollarSign className="w-5 h-5 text-teal-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Avg Splitting</h3>
          </div>
          <div className="text-sm font-bold font-mono">Gen: Rs {Math.round(metrics.avgGeneral).toLocaleString()}</div>
          <div className="text-sm font-bold font-mono">Lift: Rs {Math.round(metrics.avgLift).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Average per category
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <BarChart2 className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Additional Fees</h3>
          </div>
          <div className="text-3xl font-bold font-mono">Rs {metrics.totalAdditionalFees.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Busiest day: {metrics.busiestDay}
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Over Time */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-6">Revenue Trend (Monthly)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByMonthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Rs ${value}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number) => `Rs ${value.toLocaleString()}`}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* General vs Lift */}
        <div className="glass-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-6">Bill Types</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => `Rs ${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-6">Top 20 Expense Categories</h3>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" opacity={0.2} />
                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={140} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  formatter={(value: number, name: string, props: any) => {
                    if (name === 'value') return [`Rs ${value.toLocaleString()}`, 'Total Revenue'];
                    if (name === 'count') return [value, 'Frequency'];
                    return [value, name];
                  }}
                  labelFormatter={(name) => {
                    const item = categoryBreakdown.find(c => c.name === name);
                    return item ? item.fullName : name;
                  }}
                />
                <Bar dataKey="value" name="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                  {categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Floors Revenue */}
        <div className="glass-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-6">Revenue by Floor</h3>
          <div className="h-80 w-full overflow-y-auto pr-2">
            {floorData.map((floor, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-foreground">{floor.name}</span>
                  <span className="font-mono text-muted-foreground">Rs {floor.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${Math.max(5, (floor.value / (floorData[0]?.value || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {floorData.length === 0 && <div className="text-center text-muted-foreground text-sm mt-10">No data</div>}
          </div>
        </div>

      </div>

    </div>
  );
}
