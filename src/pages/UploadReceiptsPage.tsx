import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { User, Receipt, SystemSettings } from '../lib/store';
import { pullAllFromFirestore, pushReceipt, pushDeleteReceipt, subscribeToChanges } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Trash2, Download, FileIcon, Eye, Filter, Archive } from 'lucide-react';
import { formatDateDMY } from '../lib/utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString(), (currentYear - 3).toString()];

export function UploadReceiptsPage({ user }: { user: User | null }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Upload States
  const [category, setCategory] = useState('Lift + General Bill (Water Bill)');
  const [floor, setFloor] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [status, setStatus] = useState('Paid');

  // Filter States
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterFloor, setFilterFloor] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    let unmounted = false;
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setReceipts(data.receipts);
        setSettings(data.settings);
        if (data.settings?.floors.length) {
          setFloor(data.settings.floors[0]);
        }
      }
      setLoading(false);
    });

    const unsub = subscribeToChanges((data, collectionName) => {
      if (unmounted) return;
      if (collectionName === 'receipts') setReceipts(data);
      if (collectionName === 'settings') setSettings(data);
    });

    return () => {
      unmounted = true;
      unsub();
    };
  }, []);

  if (loading || !user || !settings) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const categories = [
    'Lift + General Bill (Water Bill)',
    'General Bill (Water Bill)',
    'Lift Bill'
  ];

  const statuses = ['Paid', 'Paid Late with Fine'];

  let visibleReceipts = user.role === 'admin' ? receipts : receipts.filter(r => r.userId === user.id);
  visibleReceipts.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  if (filterCategory !== 'All') visibleReceipts = visibleReceipts.filter(r => r.category === filterCategory);
  if (filterFloor !== 'All') visibleReceipts = visibleReceipts.filter(r => r.floor === filterFloor);
  if (filterMonth !== 'All') visibleReceipts = visibleReceipts.filter(r => r.month === filterMonth);
  if (filterYear !== 'All') visibleReceipts = visibleReceipts.filter(r => r.year === filterYear);
  if (filterStatus !== 'All') visibleReceipts = visibleReceipts.filter(r => r.status === filterStatus);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!paidDate) {
       toast.error('Please select a Paid Date first');
       e.target.value = '';
       return;
    }

    if (file.size > 2 * 1024 * 1024) {
      return toast.error('File size must be less than 2MB');
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      const newReceipt: Receipt = {
        id: generateId(),
        userId: user.id,
        userName: user.fullName,
        category,
        floor,
        paidDate,
        month,
        year,
        status,
        fileName: file.name,
        fileData: base64,
        uploadedAt: new Date().toISOString()
      };

      try {
        await pushReceipt(newReceipt);
        setReceipts(prev => [newReceipt, ...prev]);
        toast.success('Receipt uploaded successfully');
      } catch (err) {
        toast.error('Failed to upload receipt');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };


  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) return;
    try {
      await pushDeleteReceipt(id);
      setReceipts(prev => prev.filter(r => r.id !== id));
      toast.success('Receipt deleted');
    } catch (err) {
      toast.error('Failed to delete receipt');
    }
  };

  const handleDownloadAll = async () => {
    if (visibleReceipts.length === 0) {
      return toast.error('No receipts to download');
    }
    
    const loadingToast = toast.loading('Preparing download (this may take a moment)...');
    
    try {
      const zip = new JSZip();
      
      visibleReceipts.forEach((receipt, index) => {
        const base64Data = receipt.fileData.split(',')[1];
        if (base64Data) {
          zip.file(`${receipt.floor || 'Unknown'}_${receipt.month || 'Unknown'}_${receipt.year || 'Unknown'}_${index + 1}_${receipt.fileName}`, base64Data, { base64: true });
        }
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `receipts_${formatDateDMY(new Date().toISOString())}.zip`);
      
      toast.dismiss(loadingToast);
      toast.success('Download complete');
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Failed to generate zip file');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Upload Receipts</h1>
        <p className="text-muted-foreground">Upload and manage payment receipts</p>
      </div>

      <div className="glass-card p-6 border-dashed border-2 border-primary/30 flex flex-col items-center justify-center space-y-4 min-h-[200px]">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Category</label>
            <select className="input-field w-full text-sm font-medium h-[42px]" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Floor</label>
            <select className="input-field w-full text-sm font-medium h-[42px]" value={floor} onChange={e => setFloor(e.target.value)}>
              {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
              {settings.floors.length === 0 && <option value="N/A">N/A</option>}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Paid Date</label>
            <input type="date" className="input-field w-full text-sm font-medium h-[42px]" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
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
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold mb-1 block">Status</label>
            <select className="input-field w-full text-sm font-medium h-[42px]" value={status} onChange={e => setStatus(e.target.value)}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="pt-2">
          <label className="btn-primary inline-flex w-full sm:w-auto text-center cursor-pointer items-center justify-center whitespace-nowrap h-11 px-8">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Select File & Upload'}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground text-center">Max file size: 2MB. Supported formats: JPG, PNG, PDF</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" /> Filter Receipts
          </h2>
          {(user?.role === 'admin' || settings.allowUserDownloads !== false) && (
            <button 
              onClick={handleDownloadAll}
              className="btn-primary py-2 h-10 px-4 text-sm flex items-center gap-2"
            >
              <Archive className="w-4 h-4" /> Download All Filtered
            </button>
          )}
        </div>
        
        <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 block">Category</label>
            <select className="input-field text-xs py-1.5 h-auto w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 block">Floor</label>
            <select className="input-field text-xs py-1.5 h-auto w-full" value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
              <option value="All">All Floors</option>
              {settings.floors.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 block">Month</label>
            <select className="input-field text-xs py-1.5 h-auto w-full" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="All">All Months</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 block">Year</label>
            <select className="input-field text-xs py-1.5 h-auto w-full" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="All">All Years</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 block">Status</label>
            <select className="input-field text-xs py-1.5 h-auto w-full" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleReceipts.map(receipt => (
          <div key={receipt.id} className="glass-card p-4 flex flex-col gap-3 group">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground mb-1">
                  {receipt.category}
                </span>
                <p className="text-sm font-medium truncate" title={receipt.fileName}>{receipt.fileName}</p>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <p className="flex justify-between"><span>Floor:</span> <span className="font-medium text-foreground">{receipt.floor || 'N/A'}</span></p>
                  <p className="flex justify-between"><span>Paid:</span> <span className="font-medium text-foreground">{receipt.paidDate ? formatDateDMY(new Date(receipt.paidDate).toISOString()) : 'N/A'}</span></p>
                  <p className="flex justify-between"><span>Period:</span> <span className="font-medium text-foreground">{receipt.month && receipt.year ? `${receipt.month} ${receipt.year}` : 'N/A'}</span></p>
                  <p className="flex justify-between"><span>Status:</span> <span className={`font-medium ${receipt.status?.includes('Late') ? 'text-destructive' : 'text-emerald-500'}`}>{receipt.status || 'Paid'}</span></p>
                  {user?.role === 'admin' && <p className="pt-1 border-t border-border/50 mt-1">By: {receipt.userName}</p>}
                </div>
              </div>
              {(user?.role === 'admin' || receipt.userId === user?.id) && (
                <button 
                  onClick={() => handleDelete(receipt.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="h-32 bg-secondary/30 rounded-lg flex items-center justify-center overflow-hidden border border-border/50 relative group/img">
              {receipt.fileData.startsWith('data:image') ? (
                <img src={receipt.fileData} alt={receipt.fileName} className="w-full h-full object-cover" />
              ) : (
                <FileIcon className="w-10 h-10 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white gap-4 text-sm font-medium backdrop-blur-sm">
                {(user?.role === 'admin' || settings.allowUserDownloads !== false) && (
                  <a 
                    href={receipt.fileData} 
                    download={receipt.fileName}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                )}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      const w = window.open('about:blank', '_blank');
                      if (w) {
                        if (receipt.fileData.startsWith('data:image')) {
                          w.document.write(`<body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0f172a;"><img src="${receipt.fileData}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                        } else if (receipt.fileData.startsWith('data:application/pdf')) {
                          w.document.write(`<body style="margin:0;"><iframe src="${receipt.fileData}" width="100%" height="100%" style="border:none;"></iframe></body>`);
                        } else {
                          w.location.href = receipt.fileData;
                        }
                      }
                    }}
                    className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {visibleReceipts.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground glass-card border-dashed">
            No receipts found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
