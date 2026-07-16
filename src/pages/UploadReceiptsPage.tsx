import { generateId } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { User, Receipt, SystemSettings } from '../lib/store';
import { pullAllFromFirestore, pushReceipt } from '../lib/firestoreSync';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileIcon, Check, X } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString(), (currentYear - 3).toString()];

export function UploadReceiptsPage({ user }: { user: User | null }) {
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    pullAllFromFirestore().then(data => {
      if (unmounted) return;
      if (data) {
        setSettings(data.settings);
        if (data.settings?.floors.length) {
          setFloor(data.settings.floors[0]);
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading || !user || !settings) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const categories = [
    'Lift + General Bill (Water Bill)',
    'General Bill (Water Bill)',
    'Lift Bill'
  ];

  const statuses = ['Paid', 'Paid Late with Fine'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!paidDate) {
       toast.error('Please select a Paid Date first');
       e.target.value = '';
       return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !previewUrl) return;
    
    setUploading(true);
    
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
      fileName: selectedFile.name,
      fileData: previewUrl,
      uploadedAt: new Date().toISOString()
    };

    try {
      await pushReceipt(newReceipt);
      toast.success('Receipt uploaded successfully');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      toast.error('Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Upload Receipts</h1>
        <p className="text-muted-foreground">Upload your payment receipts securely</p>
      </div>

      <div className="glass-card p-6 border-dashed border-2 border-primary/30 flex flex-col items-center justify-center space-y-6 min-h-[300px]">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <UploadCloud className="w-8 h-8" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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

        {!selectedFile ? (
          <div className="pt-4 flex flex-col items-center">
            <label className="btn-primary inline-flex w-full sm:w-auto text-center cursor-pointer items-center justify-center whitespace-nowrap h-11 px-8">
              Select File
              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect} />
            </label>
            <p className="text-xs text-muted-foreground text-center mt-3">Max file size: 2MB. Supported formats: JPG, PNG, PDF</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center pt-4 space-y-4">
            <div className="w-full max-w-sm rounded-lg overflow-hidden border border-border bg-secondary/30 relative flex items-center justify-center p-2">
               {previewUrl?.startsWith('data:image') ? (
                 <img src={previewUrl} alt="Preview" className="max-w-full max-h-[300px] object-contain rounded" />
               ) : (
                 <div className="flex flex-col items-center gap-2 py-8">
                    <FileIcon className="w-12 h-12 text-muted-foreground" />
                    <span className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                 </div>
               )}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                disabled={uploading}
                className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 px-6"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={uploading}
                className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 shadow-lg shadow-primary/20"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
