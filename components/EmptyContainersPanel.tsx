import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LocationCount {
    id: string;
    name: string;
    emptyCount: number;
    fullCount: number;
}

interface StorageData {
    bondedArea: LocationCount[];
    warehouse: LocationCount[];
    buffer: LocationCount[];
}

interface EmptyContainersPanelProps {
    isMinimized: boolean;
    onToggleMinimize: () => void;
}

export const EmptyContainersPanel: React.FC<EmptyContainersPanelProps> = ({ isMinimized, onToggleMinimize }) => {
    const [data, setData] = useState<StorageData>({
        bondedArea: [],
        warehouse: [],
        buffer: [],
    });
    const [addingTo, setAddingTo] = useState<keyof StorageData | null>(null);
    const [newName, setNewName] = useState("");

    // Load from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem('emptyContainersDataV3');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                    setData({
                        bondedArea: Array.isArray(parsed.bondedArea) ? parsed.bondedArea : [],
                        warehouse: Array.isArray(parsed.warehouse) ? parsed.warehouse : [],
                        buffer: Array.isArray(parsed.buffer) ? parsed.buffer : [],
                    });
                }
            } catch (e) {
                console.error("Failed to parse stored containers data", e);
            }
        }
    }, []);

    // Save to local storage when data changes
    useEffect(() => {
        localStorage.setItem('emptyContainersDataV3', JSON.stringify(data));
    }, [data]);

    const handleAdd = (sectionId: keyof StorageData) => {
        if (!newName.trim()) return;
        setData(prev => ({
            ...prev,
            [sectionId]: [...(prev[sectionId] || []), { id: Date.now().toString() + Math.random().toString(), name: newName.trim(), emptyCount: 0, fullCount: 0 }]
        }));
        setNewName("");
        setAddingTo(null);
    };

    const handleRemove = (sectionId: keyof StorageData, locationId: string) => {
        setData(prev => ({
            ...prev,
            [sectionId]: (prev[sectionId] || []).filter(loc => loc.id !== locationId)
        }));
    };

    const handleUpdate = (sectionId: keyof StorageData, locationId: string, type: 'empty' | 'full', delta: number) => {
        setData(prev => ({
            ...prev,
            [sectionId]: (prev[sectionId] || []).map(loc => 
                loc.id === locationId ? { 
                    ...loc, 
                    [type === 'empty' ? 'emptyCount' : 'fullCount']: Math.max(0, (loc[type === 'empty' ? 'emptyCount' : 'fullCount'] || 0) + delta) 
                } : loc
            )
        }));
    };

    const handleManualChange = (sectionId: keyof StorageData, locationId: string, type: 'empty' | 'full', value: string) => {
        const parsed = parseInt(value, 10);
        const newCount = !isNaN(parsed) && parsed >= 0 ? parsed : (value === '' ? 0 : null);
        
        if (newCount !== null) {
            setData(prev => ({
                ...prev,
                [sectionId]: (prev[sectionId] || []).map(loc => 
                    loc.id === locationId ? { 
                        ...loc, 
                        [type === 'empty' ? 'emptyCount' : 'fullCount']: newCount 
                    } : loc
                )
            }));
        }
    };

    const sections: { id: keyof StorageData; label: string; icon: string; bgClass: string; textClass: string }[] = [
        { id: 'bondedArea', label: 'Bonded Area', icon: 'account_balance', bgClass: 'bg-amber-50', textClass: 'text-amber-500' },
        { id: 'warehouse', label: 'Warehouse', icon: 'corporate_fare', bgClass: 'bg-indigo-50', textClass: 'text-indigo-500' },
        { id: 'buffer', label: 'Buffer', icon: 'layers', bgClass: 'bg-emerald-50', textClass: 'text-emerald-500' },
    ];

    const totalEmptyUnits = (Object.values(data || {}) as LocationCount[][]).reduce((acc, list) => acc + (Array.isArray(list) ? list.reduce((sum, item) => sum + (item.emptyCount || 0), 0) : 0), 0);
    const totalFullUnits = (Object.values(data || {}) as LocationCount[][]).reduce((acc, list) => acc + (Array.isArray(list) ? list.reduce((sum, item) => sum + (item.fullCount || 0), 0) : 0), 0);

    if (isMinimized) {
        return (
            <aside 
                className="w-[80px] fixed right-0 top-0 bottom-0 bg-white border-l border-slate-200 shadow-2xl flex flex-col items-center py-6 z-[150] no-export cursor-pointer hover:bg-slate-50 transition-all border-b-0" 
                onClick={onToggleMinimize}
            >
                <div className="w-12 h-12 rounded-[1.25rem] bg-slate-900 shadow-lg shadow-slate-200 flex items-center justify-center mb-8">
                    <span className="material-icons text-white text-xl">inventory_2</span>
                </div>
                
                <div className="flex-1 flex flex-col items-center gap-8 w-full">
                    <div className="flex flex-col items-center w-full relative">
                        <div className="w-full flex justify-center mb-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none bg-slate-100 px-2 py-1 rounded-md">Empty</span>
                        </div>
                        <span className="text-2xl font-display font-black text-slate-800 leading-none tracking-tighter">{totalEmptyUnits}</span>
                    </div>
                    <div className="flex flex-col items-center w-full relative mt-4">
                        <div className="w-full flex justify-center mb-2">
                           <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none bg-indigo-50 px-2 py-1 rounded-md">Full</span>
                        </div>
                        <span className="text-2xl font-display font-black text-slate-800 leading-none tracking-tighter">{totalFullUnits}</span>
                    </div>
                </div>
                
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm mt-auto mb-2 group">
                    <span className="material-icons group-hover:text-indigo-600 transition-colors">chevron_left</span>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-[360px] fixed right-0 top-0 bottom-0 bg-slate-50 border-l border-slate-200 shadow-[0_0_40px_-15px_rgba(0,0,0,0.1)] flex flex-col z-[150] no-export overflow-y-auto custom-scrollbar">
            <div className="p-6 pb-6 border-b border-slate-200/50 bg-white/90 backdrop-blur-xl sticky top-0 z-10 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[1rem] bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                        <span className="material-icons text-white text-xl">inventory_2</span>
                    </div>
                    <div>
                        <h2 className="text-[13px] font-display font-black text-slate-800 tracking-tight leading-none mb-1">Storage Inventory</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Manual Control</p>
                    </div>
                </div>
                <button onClick={onToggleMinimize} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm cursor-pointer">
                    <span className="material-icons text-lg">chevron_right</span>
                </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
                {sections.map(section => (
                    <div key={section.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${section.bgClass}`}>
                                <span className={`material-icons text-base ${section.textClass}`}>{section.icon}</span>
                            </div>
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{section.label}</h3>
                        </div>
                        
                        <div className="space-y-3">
                            <AnimatePresence>
                                {(data[section.id] || []).map(loc => (
                                    <motion.div 
                                        key={loc.id} 
                                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                        className="flex flex-col gap-3 bg-slate-50 p-4 rounded-[1.25rem] border border-slate-100 relative group overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                                             <div className="text-xs font-black uppercase text-slate-700 truncate pr-6" title={loc.name}>{loc.name}</div>
                                             <button onClick={() => handleRemove(section.id, loc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 bg-white shadow-sm border border-slate-200 cursor-pointer">
                                                 <span className="material-icons text-[14px]">close</span>
                                             </button>
                                        </div>
                                        
                                        <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest w-12 text-center">Empty</div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdate(section.id, loc.id, 'empty', -1)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-200 shadow-sm transition-colors cursor-pointer">
                                                    <span className="material-icons text-lg">remove</span>
                                                </button>
                                                <input type="number" value={loc.emptyCount === 0 ? '' : loc.emptyCount} placeholder="0" onChange={(e) => handleManualChange(section.id, loc.id, 'empty', e.target.value)} className="w-12 text-center font-display font-bold text-lg text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 hide-arrows" />
                                                <button onClick={() => handleUpdate(section.id, loc.id, 'empty', 1)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-500 hover:border-emerald-200 shadow-sm transition-colors cursor-pointer">
                                                    <span className="material-icons text-lg">add</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[9px] font-black uppercase text-indigo-400 tracking-widest w-12 text-center">Full</div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdate(section.id, loc.id, 'full', -1)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-200 shadow-sm transition-colors cursor-pointer">
                                                    <span className="material-icons text-lg">remove</span>
                                                </button>
                                                <input type="number" value={loc.fullCount === 0 ? '' : loc.fullCount} placeholder="0" onChange={(e) => handleManualChange(section.id, loc.id, 'full', e.target.value)} className="w-12 text-center font-display font-bold text-lg text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 hide-arrows" />
                                                <button onClick={() => handleUpdate(section.id, loc.id, 'full', 1)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-500 hover:border-emerald-200 shadow-sm transition-colors cursor-pointer">
                                                    <span className="material-icons text-lg">add</span>
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            
                            {addingTo === section.id ? (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="flex items-center gap-2 mt-2"
                                >
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Name..."
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAdd(section.id);
                                            else if (e.key === 'Escape') setAddingTo(null);
                                        }}
                                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button onClick={() => handleAdd(section.id)} className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer">
                                        <span className="material-icons text-base">check</span>
                                    </button>
                                    <button onClick={() => setAddingTo(null)} className="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shadow-sm hover:bg-slate-300 transition-colors shrink-0 cursor-pointer">
                                        <span className="material-icons text-base">close</span>
                                    </button>
                                </motion.div>
                            ) : (
                                <button 
                                    onClick={() => { setAddingTo(section.id); setNewName(""); }}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                                >
                                    <span className="material-icons text-sm">add</span> Add Entry
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-8 bg-slate-900 border-t border-slate-800 sticky bottom-0 text-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-10 space-y-4">
               <div className="flex items-end justify-between border-b border-white/10 pb-4">
                  <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Empty</p>
                      <p className="text-3xl font-display font-black tracking-tighter text-slate-300">{totalEmptyUnits}</p>
                  </div>
                  <div>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 text-right">Total Full</p>
                      <p className="text-3xl font-display font-black tracking-tighter text-right">{totalFullUnits}</p>
                  </div>
               </div>
               
               <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Grand Total</p>
                   <p className="text-xl font-display font-black tracking-tighter text-emerald-400">{totalEmptyUnits + totalFullUnits}</p>
               </div>
            </div>
        </aside>
    );
};