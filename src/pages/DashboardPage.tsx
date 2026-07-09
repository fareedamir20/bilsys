import React, { useEffect, useState } from 'react';
import { pullAllFromFirestore, subscribeToChanges } from '../lib/firestoreSync';
import { Bill, SystemSettings, User } from '../lib/store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDateTimeDMY } from '../lib/utils';
import { AlertCircle, FileText, TrendingDown, TrendingUp, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export function DashboardPage({ user }: { user: User | null }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    pullAllFromFirestore().then(data => {
      if (data) {
        setBills(user?.role === 'admin' ? data.bills : data.bills.filter(b => b.userId === user?.id));
        setSettings(data.settings);
      }
      setLoading(false);
    });

    // Real-time updates
    const unsub = subscribeToChanges((data, collectionName) => {
      if (collectionName === 'bills') {
        setBills(user?.role === 'admin' ? data : data.filter((b: Bill) => b.userId === user?.id));
      }
      if (collectionName === 'settings') {
        setSettings(data);
      }
    });

    return () => unsub();
  }, [user]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading dashboard...</div>;

  // Calculate stats
  const totalBills = bills.length;
  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYearName = new Date().getFullYear().toString();
  
  const thisMonthBills = bills.filter(b => b.month === currentMonthName && b.year === currentYearName);
  const thisMonthSum = thisMonthBills.reduce((sum, b) => sum + b.totalAmount, 0);

  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthName = lastMonthDate.toLocaleString('en-US', { month: 'long' });
  const lastMonthYear = lastMonthDate.getFullYear().toString();

  const lastMonthBills = bills.filter(b => b.month === lastMonthName && b.year === lastMonthYear);
  const lastMonthSum = lastMonthBills.reduce((sum, b) => sum + b.totalAmount, 0);

  const trendPercent = lastMonthSum === 0 
    ? (thisMonthSum > 0 ? 100 : 0)
    : ((thisMonthSum - lastMonthSum) / lastMonthSum) * 100;

  const getRecentActivity = () => bills.slice().sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()).slice(0, 5);

  const barChartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mName = d.toLocaleString('en-US', { month: 'short' });
    const yName = d.getFullYear().toString();
    const lName = d.toLocaleString('en-US', { month: 'long' });
    
    const monthBills = bills.filter(b => b.month === lName && b.year === yName);
    barChartData.push({
      name: `${mName} ${yName}`,
      amount: monthBills.reduce((sum, b) => sum + b.totalAmount, 0)
    });
  }

  const generalCount = bills.filter(b => b.type === 'general').length;
  const liftCount = bills.filter(b => b.type === 'lift').length;
  const pieData = [
    { name: 'General', value: generalCount, color: '#3b82f6' },
    { name: 'Lift', value: liftCount, color: '#10b981' }
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h2 className="text-3xl font-heading font-bold">
            Welcome back, <span className="gradient-text">{user?.fullName.split(' ')[0]}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          System Active
        </div>
      </div>

      {/* Admin Message */}
      {user?.role === 'user' && settings?.dashboardMessage && (
        <div className="glass-card p-4 border-l-4 border-l-primary flex gap-3 text-sm flex-col sm:flex-row shadow-sm">
          <AlertCircle className="w-5 h-5 text-primary shrink-0" />
          <p className="text-foreground leading-relaxed">{settings.dashboardMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FileText className="w-4 h-4" />
            <h3 className="section-label">Total Bills</h3>
          </div>
          <p className="text-3xl font-light font-heading">{totalBills}</p>
        </div>
        
        <div className="glass-card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CreditCard className="w-4 h-4" />
            <h3 className="section-label">Total Billed</h3>
          </div>
          <p className="text-3xl font-light font-heading">Rs {totalBilled.toLocaleString()}</p>
        </div>

        <div className="glass-card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <h3 className="section-label">This Month</h3>
          </div>
          <p className="text-3xl font-light font-heading text-primary">Rs {thisMonthSum.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{thisMonthBills.length} bills generated</p>
        </div>

        <div className="glass-card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="w-4 h-4" />
            <h3 className="section-label">Trend v Last M</h3>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-light font-heading tracking-tight">
              {trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%
            </p>
            {trendPercent > 0 ? (
              <TrendingUp className="w-5 h-5 text-destructive mb-1.5" />
            ) : trendPercent < 0 ? (
              <TrendingDown className="w-5 h-5 text-emerald-500 mb-1.5" />
            ) : null}
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2 flex flex-col">
          <h3 className="font-heading font-semibold text-lg mb-6 tracking-tight">Billing Over Time</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `Rs ${value.toLocaleString()}`}
                  width={80}
                />
                <Tooltip 
                  cursor={{fill: 'var(--color-secondary)'}}
                  contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  formatter={(value: number) => [`Rs ${value.toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col">
          <h3 className="font-heading font-semibold text-lg mb-6 tracking-tight">Bill Types</h3>
          <div className="flex-1 min-h-[250px] flex items-center justify-center">
            {bills.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data available yet</p>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Bills</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-widest bg-secondary/30">
              <tr>
                <th className="px-4 py-3 font-bold">Month/Year</th>
                {user?.role === 'admin' && <th className="px-4 py-3 font-bold">User / Floor</th>}
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold text-right">Amount</th>
                <th className="px-4 py-3 font-bold">Date Generated</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {getRecentActivity().map(bill => (
                <tr key={bill.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{bill.month} {bill.year}</td>
                  {user?.role === 'admin' && (
                    <td className="px-4 py-3">
                      <div className="font-medium">{bill.userName}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{bill.floor}</div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${
                      bill.type === 'general' 
                        ? 'bg-primary/10 text-primary border-primary/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      {bill.type === 'general' ? 'General' : 'Lift'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-right">Rs {bill.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTimeDMY(bill.generatedAt)}</td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                    No bills generated yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Need to import Activity since I used it.
import { Activity } from 'lucide-react';
