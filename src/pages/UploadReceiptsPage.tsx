import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { User, Receipt, SystemSettings } from '../lib/store';
import { pullAllFromFirestore, pushReceipt, pushDeleteReceipt, subscribeToChanges } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Trash2, Download, FileIcon } from 'lucide-react';
import { formatDateDMY } from '../lib/utils';

export function UploadReceiptsPage({ user }: { user: User | null }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('General Bill');
  const [floor, setFloor] = useState('');
  const [paidDate, setPaidDate] = useState('');

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
    ...settings.generalCategories.map(c => c.title),
    ...settings.liftCategories.map(c => c.title),
    'General Bill', 'Other'
  ].filter((v, i, a) => a.indexOf(v) === i); // Unique categories

  const visibleReceipts = user.role === 'admin' ? receipts : receipts.filter(r => r.userId === user.id);
  visibleReceipts.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
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
        </div>
        <div className="pt-2">
          <label className="btn-primary inline-flex w-full sm:w-auto text-center cursor-pointer items-center justify-center whitespace-nowrap h-11 px-8">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Select File & Upload'}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground text-center">Max file size: 2MB. Supported formats: JPG, PNG, PDF</p>
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
              <a 
                href={receipt.fileData} 
                download={receipt.fileName}
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white gap-2 text-sm font-medium backdrop-blur-sm"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          </div>
        ))}
        {visibleReceipts.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground glass-card border-dashed">
            No receipts uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}
