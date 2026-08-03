import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import { Building2, Save, FileText, Trash2, Filter } from 'lucide-react';

interface GeneralWarehouseDistributionProps {
    shipments: Shipment[];
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

interface WarehouseConfig {
    key: string;
    name: string;
    match: string[];
    color: string;
    text: string;
    border: string;
    bg: string;
}

const GENERAL_WAREHOUSES: WarehouseConfig[] = [
    { key: 'cts_jw', name: 'AG - CTS J&W', match: ['J&W', 'J & W', 'JW'], color: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-t-indigo-500', bg: 'bg-indigo-50' },
    { key: 'cts_logic', name: 'AG - CTS LOGIC', match: ['LOGIC'], color: 'bg-violet-500', text: 'text-violet-400', border: 'border-t-violet-500', bg: 'bg-violet-50' },
    { key: 'cts_pontual', name: 'AG - CTS PONTUAL', match: ['PONTUAL'], color: 'bg-purple-500', text: 'text-purple-400', border: 'border-t-purple-500', bg: 'bg-purple-50' },
    { key: 'cts_uni', name: 'AG - CTS UNI', match: ['UNI'], color: 'bg-fuchsia-500', text: 'text-fuchsia-400', border: 'border-t-fuchsia-500', bg: 'bg-fuchsia-50' },
    { key: 'cts_vbr', name: 'AG - CTS VBR', match: ['VBR'], color: 'bg-pink-500', text: 'text-pink-400', border: 'border-t-pink-500', bg: 'bg-pink-50' },
    { key: 'inter_cdex', name: 'AG - INTER CDEX', match: ['CDEX', 'SEDEX', 'INTER CDEX'], color: 'bg-blue-500', text: 'text-blue-400', border: 'border-t-blue-500', bg: 'bg-blue-50' },
    { key: 'multilog', name: 'AG - MULTILOG', match: ['MULTILOG'], color: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-t-cyan-500', bg: 'bg-cyan-50' },
    { key: 'area_23', name: 'AREA 23', match: ['AREA 23', 'ÁREA 23', 'AREA23'], color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-t-emerald-500', bg: 'bg-emerald-50' },
    { key: 'buffer_tercam', name: 'BUFFER - TERCAM', match: ['TERCAM', 'BUFFER'], color: 'bg-amber-500', text: 'text-amber-400', border: 'border-t-amber-500', bg: 'bg-amber-50' },
    { key: 'other', name: 'OTHER GENERAL', match: [], color: 'bg-slate-500', text: 'text-slate-400', border: 'border-t-slate-500', bg: 'bg-slate-100' }
];

const getWarehouseKey = (gw: string): string => {
    const upper = gw.toUpperCase().trim();
    for (const wh of GENERAL_WAREHOUSES) {
        if (wh.key !== 'other' && wh.match.some(m => upper.includes(m))) {
            return wh.key;
        }
    }
    return 'other';
};

export const GeneralWarehouseDistribution: React.FC<GeneralWarehouseDistributionProps> = ({ shipments }) => {
    const [justifications, setJustifications] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('gen_wh_distribution_justifications');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Error reading general warehouse justifications', e);
            return {};
        }
    });

    const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>([]);

    const uniqueIncoterms = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        const set = new Set<string>();
        shipments.forEach(s => {
            if (s && typeof s.incoterm === 'string') {
                const trimmed = s.incoterm.trim().toUpperCase();
                if (trimmed) set.add(trimmed);
            }
        });
        return Array.from(set).sort();
    }, [shipments]);

    const toggleIncoterm = (incoterm: string) => {
        setSelectedIncoterms(prev => {
            if (prev.includes(incoterm)) {
                return prev.filter(item => item !== incoterm);
            } else {
                return [...prev, incoterm];
            }
        });
    };

    const filteredShipments = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        return shipments.filter(s => {
            if (!s) return false;
            // Only count if there is an assigned General Warehouse
            if (!s.generalWarehouse || !s.generalWarehouse.trim()) return false;
            if (selectedIncoterms.length === 0) return true;
            return s.incoterm && selectedIncoterms.includes(s.incoterm.toUpperCase().trim());
        });
    }, [shipments, selectedIncoterms]);

    const updateJustification = (key: string, value: string) => {
        const updated = { ...justifications, [key]: value };
        setJustifications(updated);
        try {
            localStorage.setItem('gen_wh_distribution_justifications', JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving general warehouse justifications', e);
        }
    };

    const clearAllNotes = () => {
        if (window.confirm("Are you sure you want to clear all general warehouse justification notes?")) {
            setJustifications({});
            localStorage.removeItem('gen_wh_distribution_justifications');
        }
    };

    const dataByMonth = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return [];
        const map = new Map<string, { total: number; counts: Record<string, number>; dateObj: Date }>();
        
        filteredShipments.forEach(s => {
            if (!s) return;
            const date = s.ata || s.estimatedDelivery;
            if (!date || !isValidDate(date)) return;
            
            const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
            
            if (!map.has(monthKey)) {
                const initialCounts: Record<string, number> = {};
                GENERAL_WAREHOUSES.forEach(wh => {
                    initialCounts[wh.key] = 0;
                });
                map.set(monthKey, { 
                    total: 0, 
                    counts: initialCounts,
                    dateObj: new Date(date.getFullYear(), date.getMonth(), 1) 
                });
            }
            
            const entry = map.get(monthKey)!;
            const whKey = getWarehouseKey(s.generalWarehouse || '');
            entry.counts[whKey]++;
            entry.total++;
        });
        
        return Array.from(map.values())
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(m => {
                const label = m.dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                const key = `${m.dateObj.getFullYear()}_${m.dateObj.getMonth()}`;
                
                const whBreakdown = GENERAL_WAREHOUSES.map(wh => {
                    const count = m.counts[wh.key] || 0;
                    return {
                        ...wh,
                        count,
                        pct: m.total > 0 ? (count / m.total) * 150 : 0 // Normalized or just actual percentage:
                    };
                });

                // Calculate actual percentages
                const finalBreakdown = GENERAL_WAREHOUSES.map(wh => {
                    const count = m.counts[wh.key] || 0;
                    return {
                        ...wh,
                        count,
                        pct: m.total > 0 ? (count / m.total) * 100 : 0
                    };
                });

                return {
                    label,
                    key,
                    total: m.total,
                    breakdown: finalBreakdown
                };
            });
    }, [filteredShipments]);

    // Totals for executive banner
    const totals = useMemo(() => {
        const t: Record<string, number> = {};
        let all = 0;
        GENERAL_WAREHOUSES.forEach(wh => {
            t[wh.key] = 0;
        });

        dataByMonth.forEach(m => {
            m.breakdown.forEach(item => {
                t[item.key] += item.count;
            });
            all += m.total;
        });

        return {
            all,
            breakdown: GENERAL_WAREHOUSES.map(wh => ({
                ...wh,
                count: t[wh.key] || 0,
                pct: all > 0 ? ((t[wh.key] || 0) / all) * 100 : 0
            }))
        };
    }, [dataByMonth]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8 flex-1 min-h-[500px]"
        >
            {/* Header Banner */}
            <div className="glass p-8 md:p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30">
                                <Building2 className="w-6 h-6 text-indigo-400" />
                            </div>
                            <span className="text-[10px] font-black tracking-[0.25em] text-indigo-400 uppercase">Strategic Storage</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none mt-2">
                            General Warehouse Distribution
                        </h2>
                        <p className="text-sm text-slate-400 max-w-2xl font-medium">
                            Monthly allocation of cleared containers across general warehouses (armazéns gerais) with custom strategic justifications.
                        </p>
                    </div>

                    <div className="flex shrink-0">
                        <button
                            onClick={clearAllNotes}
                            className="inline-flex items-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer shadow-lg"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Clear All Notes
                        </button>
                    </div>
                </div>

                {/* Executive Totals */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-8 pt-8 border-t border-slate-800/60 relative z-10">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm col-span-2 sm:col-span-1 flex flex-col justify-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Volume</span>
                        <div className="text-3xl font-display font-black">{totals.all} <span className="text-xs text-slate-500 font-bold">CNTR</span></div>
                    </div>
                    {totals.breakdown.map((wh) => (
                        <div key={wh.key} className={`bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm border-t-2 ${wh.border}`}>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wide block mb-1 truncate">{wh.name}</span>
                            <div className="text-xl font-display font-black text-white">
                                {wh.count} <span className="text-[10px] text-slate-500 font-bold">({wh.pct.toFixed(1)}%)</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Incoterm Agreement Filter Card */}
            <div className="glass p-6 md:p-8 rounded-[2.5rem] bg-white ring-1 ring-white/50 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
                        <Filter className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-display font-black text-slate-800 tracking-tight">Incoterm Agreement Filter</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Select one or multiple Incoterms to slice the general warehouse distribution analysis</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedIncoterms([])}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            selectedIncoterms.length === 0
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                    >
                        All Agreements
                    </button>
                    {uniqueIncoterms.map((incoterm) => {
                        const isSelected = selectedIncoterms.includes(incoterm);
                        return (
                            <button
                                key={incoterm}
                                onClick={() => toggleIncoterm(incoterm)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                            >
                                {incoterm}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Grid of Months */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {dataByMonth.length === 0 ? (
                    <div className="col-span-full glass p-12 rounded-[3rem] text-center bg-white">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No general warehouse allocations found for the active selection.</p>
                    </div>
                ) : (
                    dataByMonth.map((month) => (
                        <div key={month.key} className="glass p-6 md:p-8 rounded-[2.5rem] bg-white ring-1 ring-white/50 shadow-glass flex flex-col h-full hover:shadow-xl transition-shadow duration-300">
                            
                            {/* Month Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                                <div>
                                    <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">{month.label}</h3>
                                </div>
                                <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-center">
                                    <div className="text-xs font-black text-slate-800">{month.total}</div>
                                    <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total CNTR</div>
                                </div>
                            </div>

                            {/* Bar Charts */}
                            <div className="space-y-3.5 mb-8 flex-1">
                                {month.breakdown.map((wh) => (
                                    <div key={wh.key} className="relative">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                            <span className="truncate max-w-[130px]">{wh.name}</span>
                                            <span className="text-slate-700">{wh.count} cont. ({wh.pct.toFixed(1)}%)</span>
                                        </div>
                                        <div className={`w-full h-2.5 rounded-full ${wh.bg} overflow-hidden flex`}>
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${wh.pct}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`h-full ${wh.color} rounded-full`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Justification Box */}
                            <div className="mt-auto pt-4 border-t border-slate-100">
                                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                    <FileText className="w-3.5 h-3.5" /> Motivo da Utilização / Justificativa Diretoria
                                </label>
                                <textarea
                                    value={justifications[month.key] || ''}
                                    onChange={(e) => updateJustification(month.key, e.target.value)}
                                    placeholder="Enter strategic justification or board notes here..."
                                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 rounded-2xl p-4 text-xs text-slate-700 font-medium leading-relaxed outline-none transition-all resize-none shadow-inner"
                                    rows={4}
                                />
                                <div className="flex justify-end mt-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Save className="w-3 h-3" /> Auto-saved locally
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
};

export default React.memo(GeneralWarehouseDistribution);
