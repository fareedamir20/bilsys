import React, { useState, useEffect } from 'react';
import { User, SystemSettings, RefundRequest } from '../lib/store';
import { generateId, formatDateDMY } from '../lib/utils';
import { pullAllFromFirestore, pushRefundRequest, pushUpdateRefundStatus, subscribeToChanges } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileIcon, Eye, CheckCircle2, XCircle, Clock, Trash2, Check, X, Download, Maximize2, Minimize2, Banknote, ExternalLink, FileText, User as UserIcon } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { parseWordsToNumber, extractOcrData } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function RefundsPage({ user }: { user: User | null }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Selected Refund Modal State
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [imageZoomed, setImageZoomed] = useState(false);

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
        <h2 className="text-xl font-heading font-bold flex items-center justify-between border-b border-border/50 pb-2">
          <span>Refund History</span>
          <span className="text-xs font-normal text-muted-foreground">{visibleRefunds.length} requests</span>
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {visibleRefunds.map(refund => (
            <div 
              key={refund.id} 
              onClick={() => { setSelectedRefund(refund); setImageZoomed(false); }}
              className="glass-card p-4 flex flex-col gap-3 group relative cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
            >
              {/* Status Badge */}
              <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider z-10 ${
                refund.status === 'Pending' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                refund.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                'bg-destructive/15 text-destructive border border-destructive/30'
              }`}>
                {refund.status}
              </div>

              <div className="min-w-0 pr-20">
                <p className="text-sm font-bold truncate text-foreground">Ref: {refund.transactionRef || 'N/A'}</p>
                <p className="text-xl font-black text-primary font-mono my-0.5">Rs {refund.amount.toLocaleString()}</p>
              </div>

              <div className="h-36 bg-secondary/30 rounded-xl flex items-center justify-center overflow-hidden border border-border/50 relative group/img">
                <img 
                  src={refund.screenshotData} 
                  alt="Payment Screenshot" 
                  className="w-full h-full object-cover opacity-85 group-hover/img:opacity-100 transition-opacity" 
                />
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white gap-1 backdrop-blur-[2px]">
                  <Eye className="w-6 h-6 text-primary animate-pulse" />
                  <span className="text-xs font-semibold tracking-wide">Open Request Details</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1.5 mt-1 bg-secondary/20 p-3 rounded-xl border border-border/40">
                <p className="flex justify-between items-center">
                  <span>Date/Time:</span> 
                  <span className="font-semibold text-foreground font-mono">{refund.date} {refund.time}</span>
                </p>
                <p className="flex justify-between items-center">
                  <span>Period:</span> 
                  <span className="font-semibold text-foreground">{refund.floor} • {refund.month} {refund.year}</span>
                </p>
                {user?.role === 'admin' && (
                  <p className="flex justify-between items-center border-t border-border/50 pt-1.5 mt-1.5">
                    <span>Submitted by:</span> 
                    <span className="font-semibold text-foreground">{refund.userName}</span>
                  </p>
                )}
                {refund.notes && (
                  <p className="mt-1.5 text-foreground/80 italic line-clamp-1 border-t border-border/40 pt-1.5">
                    "{refund.notes}"
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRefund(refund);
                    setImageZoomed(false);
                  }}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Details
                </button>

                {user?.role === 'admin' && refund.status === 'Pending' && (
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handleStatusChange(refund.id, 'Approved')}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleStatusChange(refund.id, 'Rejected')}
                      className="px-2.5 py-1 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {visibleRefunds.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground glass-card border-dashed flex flex-col items-center justify-center gap-2">
              <Banknote className="w-10 h-10 text-muted-foreground/50" />
              <p className="font-medium text-base">No refund requests found.</p>
              <p className="text-xs text-muted-foreground">Upload a payment screenshot above to request a refund.</p>
            </div>
          )}
        </div>
      </div>

      {/* Openable Refund Details Modal */}
      <AnimatePresence>
        {selectedRefund && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] text-foreground"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-secondary/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-base sm:text-lg text-foreground">
                        Refund Request
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        selectedRefund.status === 'Pending' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                        selectedRefund.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                        'bg-destructive/15 text-destructive border border-destructive/30'
                      }`}>
                        {selectedRefund.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      Ref: {selectedRefund.transactionRef || selectedRefund.id}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedRefund(null); setImageZoomed(false); }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors shrink-0"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Screenshot View */}
                  <div className="lg:col-span-7 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                      <span>Payment Screenshot</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setImageZoomed(!imageZoomed)}
                          className="hover:text-foreground text-xs flex items-center gap-1 transition-colors bg-secondary/60 hover:bg-secondary px-2.5 py-1 rounded-lg border border-border/50"
                        >
                          {imageZoomed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                          {imageZoomed ? 'Fit Screen' : 'Expand View'}
                        </button>
                        <a
                          href={selectedRefund.screenshotData}
                          download={`Refund_${selectedRefund.transactionRef || selectedRefund.id}.png`}
                          className="hover:text-primary text-xs flex items-center gap-1 transition-colors bg-secondary/60 hover:bg-secondary px-2.5 py-1 rounded-lg border border-border/50"
                        >
                          <Download className="w-3.5 h-3.5" /> Save Image
                        </a>
                      </div>
                    </div>

                    <div className={`rounded-2xl border border-border/80 bg-black/60 overflow-hidden relative flex items-center justify-center p-2 transition-all ${
                      imageZoomed ? 'min-h-[420px] max-h-[70vh]' : 'min-h-[250px] max-h-[380px]'
                    }`}>
                      <img 
                        src={selectedRefund.screenshotData} 
                        alt="Refund Screenshot" 
                        className={`max-w-full rounded-xl transition-all ${
                          imageZoomed ? 'max-h-[70vh] object-contain' : 'max-h-[360px] object-contain'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Information Panel */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col justify-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Claimed Amount</span>
                      <span className="text-2xl sm:text-3xl font-black text-primary font-mono mt-0.5">
                        Rs {selectedRefund.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-secondary/30 rounded-2xl p-4 border border-border/60 space-y-3 text-xs sm:text-sm">
                      <div className="flex justify-between items-center pb-2.5 border-b border-border/40">
                        <span className="text-muted-foreground font-medium">Transaction Reference:</span>
                        <span className="font-bold text-foreground font-mono">{selectedRefund.transactionRef || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-border/40">
                        <span className="text-muted-foreground font-medium">Payment Date & Time:</span>
                        <span className="font-semibold text-foreground">{selectedRefund.date || 'N/A'} {selectedRefund.time || ''}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-border/40">
                        <span className="text-muted-foreground font-medium">Building Floor:</span>
                        <span className="font-semibold text-foreground">{selectedRefund.floor}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-border/40">
                        <span className="text-muted-foreground font-medium">Billing Period:</span>
                        <span className="font-semibold text-foreground">{selectedRefund.month} {selectedRefund.year}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-border/40">
                        <span className="text-muted-foreground font-medium">Submitted By:</span>
                        <span className="font-semibold text-foreground">{selectedRefund.userName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Submitted Timestamp:</span>
                        <span className="text-foreground text-xs">{formatDateDMY(selectedRefund.uploadedAt)}</span>
                      </div>
                    </div>

                    {selectedRefund.notes && (
                      <div className="bg-secondary/20 rounded-2xl p-4 border border-border/40 text-xs sm:text-sm">
                        <span className="text-muted-foreground font-bold block mb-1 uppercase text-[10px] tracking-wider">Notes / Reason:</span>
                        <p className="text-foreground/90 italic whitespace-pre-wrap">"{selectedRefund.notes}"</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-border/60 bg-secondary/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-bold text-foreground">{selectedRefund.status}</span>
                </div>

                <div className="flex items-center gap-2">
                  {user?.role === 'admin' && selectedRefund.status === 'Pending' && (
                    <>
                      <button
                        onClick={async () => {
                          await handleStatusChange(selectedRefund.id, 'Approved');
                          setSelectedRefund(prev => prev ? { ...prev, status: 'Approved' } : null);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors uppercase tracking-wider flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={async () => {
                          await handleStatusChange(selectedRefund.id, 'Rejected');
                          setSelectedRefund(prev => prev ? { ...prev, status: 'Rejected' } : null);
                        }}
                        className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold transition-colors uppercase tracking-wider flex items-center gap-1.5 min-h-[40px]"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedRefund(null); setImageZoomed(false); }}
                    className="px-5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-bold transition-colors min-h-[40px]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

