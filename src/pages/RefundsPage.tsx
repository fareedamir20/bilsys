import React, { useState, useEffect } from 'react';
import { User, SystemSettings, RefundRequest } from '../lib/store';
import { generateId, formatDateDMY } from '../lib/utils';
import { pullAllFromFirestore, pushRefundRequest, pushUpdateRefundStatus, subscribeToChanges } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileIcon, Eye, CheckCircle2, XCircle, Clock, Trash2, Check, X } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { parseWordsToNumber, extractOcrData } from '../lib/utils';

export function RefundsPage({ user }: { user: User | null }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [floor, setFloor] = useState('');
  const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [notes, setNotes] = useState('');

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setTransactionRef('');
    setAmount('');
    setDate('');
    setTime('');
    setFloor('');
    setMonth(new Date().toLocaleString('default', { month: 'long' }));
    setYear(new Date().getFullYear().toString());
    setNotes('');
  };

  useEffect(() => {
    let unmounted = false;
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setSettings(data.settings);
        setRefunds(data.refunds || []);
        if (data.settings?.floors.length) {
          setFloor(data.settings.floors[0]);
        }
      }
      setLoading(false);
    });

    const unsub = subscribeToChanges((data, collectionName) => {
      if (unmounted) return;
      if (collectionName === 'settings') setSettings(data);
      if (collectionName === 'refunds') setRefunds(data || []);
    });

    return () => {
      unmounted = true;
      unsub();
    };
  }, []);

  if (loading || !user || !settings) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!settings.enableRefunds && user.role !== 'admin') {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center text-center space-y-4 pt-20">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Refunds Disabled</h2>
        <p className="text-muted-foreground">The admin has disabled refund requests at this time.</p>
      </div>
    );
  }

  let visibleRefunds = user.role === 'admin' ? refunds : refunds.filter(r => r.userId === user.id);
  visibleRefunds.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      setPreviewUrl(base64Data);

      // Trigger OCR locally
      setExtracting(true);
      const loadingToast = toast.loading('Extracting data via OCR...');
      try {
        const result = await Tesseract.recognize(base64Data, 'eng');
        const text = result.data.text;
        
        const {
          extractedTransactionRef,
          extractedAmount,
          extractedDate,
          extractedTime
        } = extractOcrData(text);
        
        console.log("Extracted OCR Text:", text);

        if (extractedTransactionRef) setTransactionRef(extractedTransactionRef);
        if (extractedAmount) setAmount(extractedAmount);
        if (extractedDate) setDate(extractedDate);
        if (extractedTime) setTime(extractedTime);
        
        toast.success('Information extracted successfully!', { id: loadingToast });
      } catch (err) {
        console.error(err);
        toast.error('Could not extract data automatically. Please fill manually.', { id: loadingToast });
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!previewUrl || !selectedFile) return toast.error('Please upload a screenshot');
    if (!transactionRef || !amount || !date) return toast.error('Please fill all required extracted fields (Ref, Amount, Date)');
    
    setUploading(true);
    const newRefund: RefundRequest = {
      id: generateId(),
      userId: user.id,
      userName: user.fullName,
      floor,
      month,
      year,
      notes,
      transactionRef,
      amount: parseFloat(amount) || 0,
      date,
      time,
      screenshotData: previewUrl,
      status: 'Pending',
      uploadedAt: new Date().toISOString()
    };

    try {
      await pushRefundRequest(newRefund);
      toast.success('Refund request submitted');
      
      // Reset form
      resetForm();
    } catch (err) {
      toast.error('Failed to submit request');
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await pushUpdateRefundStatus(id, status);
      toast.success(`Refund request ${status}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Refunds</h1>
        <p className="text-muted-foreground">Manage and request refunds via payment screenshots</p>
      </div>

      {(settings.enableRefunds || user.role === 'admin') && user.role !== 'admin' && (
        <div className="glass-card p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold border-b border-border/50 pb-2">Submit Refund Request</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {!selectedFile ? (
                <div className="border-dashed border-2 border-primary/30 rounded-lg flex flex-col items-center justify-center p-8 space-y-4 min-h-[250px]">
                  <UploadCloud className="w-10 h-10 text-primary" />
                  <p className="text-sm font-medium">Upload Payment Screenshot</p>
                  <label className="btn-primary cursor-pointer px-6">
                    Select File
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                  </label>
                  <p className="text-xs text-muted-foreground">Max 2MB (JPG, PNG)</p>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden border border-border bg-secondary/30 relative flex items-center justify-center min-h-[250px]">
                  {previewUrl && (
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-[300px] object-contain rounded" />
                  )}
                  <button 
                    onClick={resetForm}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-black transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {extracting && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm gap-2">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm font-medium">Extracting OCR Data...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Ref No.</label>
                  <input type="text" className="input-field w-full text-sm font-medium h-[42px]" value={transactionRef} onChange={e => setTransactionRef(e.target.value)} disabled={extracting} />
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Amount</label>
                  <input type="number" className="input-field w-full text-sm font-medium h-[42px]" value={amount} onChange={e => setAmount(e.target.value)} disabled={extracting} />
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Date</label>
                  <input type="date" className="input-field w-full text-sm font-medium h-[42px]" value={date} onChange={e => setDate(e.target.value)} disabled={extracting} />
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Time</label>
                  <input type="time" className="input-field w-full text-sm font-medium h-[42px]" value={time} onChange={e => setTime(e.target.value)} disabled={extracting} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-t border-border/50 pt-4">
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Floor</label>
                  <select className="input-field w-full text-sm font-medium h-[42px]" value={floor} onChange={e => setFloor(e.target.value)}>
                    {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Month</label>
                  <select className="input-field w-full text-sm font-medium h-[42px]" value={month} onChange={e => setMonth(e.target.value)}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Year</label>
                  <select className="input-field w-full text-sm font-medium h-[42px]" value={year} onChange={e => setYear(e.target.value)}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Notes / Reason</label>
                  <textarea className="input-field w-full text-sm font-medium" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={handleSubmit} 
                  disabled={uploading || extracting || !previewUrl}
                  className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-heading font-bold flex items-center gap-2 border-b border-border/50 pb-2">
          Refund History
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleRefunds.map(refund => (
            <div key={refund.id} className="glass-card p-4 flex flex-col gap-3 group relative">
              {/* Status Badge */}
              <div className={`absolute top-4 right-4 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                refund.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                refund.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                'bg-destructive/10 text-destructive'
              }`}>
                {refund.status}
              </div>

              <div className="min-w-0 pr-20">
                <p className="text-sm font-bold truncate">Ref: {refund.transactionRef}</p>
                <p className="text-lg font-black text-primary my-1">Rs {refund.amount.toLocaleString()}</p>
              </div>

              <div className="h-32 bg-secondary/30 rounded-lg flex items-center justify-center overflow-hidden border border-border/50 relative group/img">
                <img src={refund.screenshotData} alt="Screenshot" className="w-full h-full object-cover opacity-80 group-hover/img:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white">
                  <button
                    onClick={() => {
                      const w = window.open('about:blank', '_blank');
                      if (w) w.document.write(`<body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0f172a;"><img src="${refund.screenshotData}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                    }}
                    className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-medium"
                  >
                    <Eye className="w-5 h-5" /> View Screenshot
                  </button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1.5 mt-2 bg-secondary/20 p-3 rounded-lg">
                <p className="flex justify-between"><span>Date/Time:</span> <span className="font-medium text-foreground">{refund.date} {refund.time}</span></p>
                <p className="flex justify-between"><span>Period:</span> <span className="font-medium text-foreground">{refund.floor} - {refund.month} {refund.year}</span></p>
                {user?.role === 'admin' && (
                  <p className="flex justify-between border-t border-border/50 pt-1.5 mt-1.5"><span>User:</span> <span className="font-medium text-foreground">{refund.userName}</span></p>
                )}
                {refund.notes && (
                  <p className="mt-2 text-foreground/80 italic line-clamp-2">"{refund.notes}"</p>
                )}
              </div>

              {user?.role === 'admin' && refund.status === 'Pending' && (
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <button 
                    onClick={() => handleStatusChange(refund.id, 'Approved')}
                    className="flex-1 btn-primary py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-transparent text-xs"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleStatusChange(refund.id, 'Rejected')}
                    className="flex-1 btn-primary py-1.5 bg-destructive hover:bg-destructive/90 text-white border-transparent text-xs"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {visibleRefunds.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground glass-card border-dashed">
              No refund requests found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
