import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import { Truck, Save, FileText, Trash2, Filter, Layers, CheckCircle } from 'lucide-react';

interface DeliveriesViewProps {
    shipments: Shipment[];
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

interface WarehouseConfig {
    key: string;
    name: string;
    color: string;
    text: string;
    border: string;
    bg: string;
    type: 'bonded' | 'general' | 'other';
}

const WAREHOUSE_CONFIGS: WarehouseConfig[] = [
    // Bonded
    { key: 'tecon', name: 'Tecon S.A.', color: 'bg-rose-500', text: 'text-rose-600', border: 'border-t-rose-500', bg: 'bg-rose-50/80', type: 'bonded' },
    { key: 'intermaritima', name: 'Intermaritima', color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-t-emerald-500', bg: 'bg-emerald-50/80', type: 'bonded' },
    { key: 'tpc', name: 'TPC', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-t-blue-500', bg: 'bg-blue-50/80', type: 'bonded' },
    { key: 'clia', name: 'Clia Emporio', color: 'bg-orange-500', text: 'text-orange-600', border: 'border-t-orange-500', bg: 'bg-orange-50/80', type: 'bonded' },
    
    // General
    { key: 'cts_jw', name: 'AG - CTS J&W', color: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-t-indigo-500', bg: 'bg-indigo-50/80', type: 'general' },
    { key: 'cts_logic', name: 'AG - CTS LOGIC', color: 'bg-violet-500', text: 'text-violet-600', border: 'border-t-violet-500', bg: 'bg-violet-50/80', type: 'general' },
    { key: 'cts_pontual', name: 'AG - CTS PONTUAL', color: 'bg-purple-500', text: 'text-purple-600', border: 'border-t-purple-500', bg: 'bg-purple-50/80', type: 'general' },
    { key: 'cts_uni', name: 'AG - CTS UNI', color: 'bg-fuchsia-500', text: 'text-fuchsia-600', border: 'border-t-fuchsia-500', bg: 'bg-fuchsia-50/80', type: 'general' },
    { key: 'cts_vbr', name: 'AG - CTS VBR', color: 'bg-pink-500', text: 'text-pink-600', border: 'border-t-pink-500', bg: 'bg-pink-50/80', type: 'general' },
    { key: 'inter_cdex', name: 'AG - INTER CDEX', color: 'bg-sky-500', text: 'text-sky-600', border: 'border-t-sky-500', bg: 'bg-sky-50/80', type: 'general' },
    { key: 'multilog', name: 'AG - MULTILOG', color: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-t-cyan-500', bg: 'bg-cyan-50/80', type: 'general' },
    { key: 'area_23', name: 'AREA 23', color: 'bg-teal-500', text: 'text-teal-600', border: 'border-t-teal-500', bg: 'bg-teal-50/80', type: 'general' },
    { key: 'buffer_tercam', name: 'BUFFER - TERCAM', color: 'bg-amber-500', text: 'text-amber-600', border: 'border-t-amber-500', bg: 'bg-amber-50/80', type: 'general' },
    
    // Other
    { key: 'other', name: 'Other / Direct', color: 'bg-slate-500', text: 'text-slate-600', border: 'border-t-slate-500', bg: 'bg-slate-100/80', type: 'other' }
];

const getWarehouseKey = (s: Shipment): string => {
    // Check General Warehouse field first
    if (s.generalWarehouse && s.generalWarehouse.trim()) {
        const gw = s.generalWarehouse.toUpperCase();
        if (gw.includes('J&W') || gw.includes('J & W') || gw.includes('JW')) return 'cts_jw';
        if (gw.includes('LOGIC')) return 'cts_logic';
        if (gw.includes('PONTUAL')) return 'cts_pontual';
        if (gw.includes('UNI')) return 'cts_uni';
        if (gw.includes('VBR')) return 'cts_vbr';
        if (gw.includes('CDEX') || gw.includes('SEDEX') || gw.includes('INTER CDEX')) return 'inter_cdex';
        if (gw.includes('MULTILOG')) return 'multilog';
        if (gw.includes('AREA 23') || gw.includes('ÁREA 23') || gw.includes('AREA23')) return 'area_23';
        if (gw.includes('TERCAM') || gw.includes('BUFFER')) return 'buffer_tercam';
    }
    // Check Bonded Warehouse field second
    if (s.bondedWarehouse && s.bondedWarehouse.trim()) {
        const bw = s.bondedWarehouse.toUpperCase();
        if (bw.includes('TECON')) return 'tecon';
        if (bw.includes('INTERMARITIMA') || bw.includes('INTER')) return 'intermaritima';
        if (bw.includes('TPC')) return 'tpc';
        if (bw.includes('CLIA') || bw.includes('EMPORIO') || bw.includes('EMPÓRIO')) return 'clia';
    }
    return 'other';
};

export const DeliveriesView: React.FC<DeliveriesViewProps> = ({ shipments = [] }) => {
    const [justifications, setJustifications] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('deliveries_distribution_justifications');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Error reading deliveries justifications', e);
            return {};
        }
    });

    const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>([]);
    const [warehouseTypeFilter, setWarehouseTypeFilter] = useState<'all' | 'bonded' | 'general'>('all');

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

    // Filter shipments: must have deliveryByd (completed delivery)
    const deliveredShipments = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        return shipments.filter(s => {
            if (!s || !s.deliveryByd || !isValidDate(s.deliveryByd)) return false;
            if (selectedIncoterms.length === 0) return true;
            return s.incoterm && selectedIncoterms.includes(s.incoterm.toUpperCase().trim());
        });
    }, [shipments, selectedIncoterms]);

    const updateJustification = (key: string, value: string) => {
        const updated = { ...justifications, [key]: value };
        setJustifications(updated);
        try {
            localStorage.setItem('deliveries_distribution_justifications', JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving deliveries justifications', e);
        }
    };

    const clearAllNotes = () => {
        if (window.confirm("Are you sure you want to clear all monthly delivery justification notes?")) {
            setJustifications({});
            localStorage.removeItem('deliveries_distribution_justifications');
        }
    };

    // Group delivered shipments by their actual delivery date's month
    const dataByMonth = useMemo(() => {
        if (!Array.isArray(deliveredShipments)) return [];
        const map = new Map<string, { total: number; counts: Record<string, number>; dateObj: Date }>();
        
        deliveredShipments.forEach(s => {
            const date = s.deliveryByd;
            if (!date || !isValidDate(date)) return;
            
            const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
            
            if (!map.has(monthKey)) {
                const initialCounts: Record<string, number> = {};
                WAREHOUSE_CONFIGS.forEach(wh => {
                    initialCounts[wh.key] = 0;
                });
                map.set(monthKey, { 
                    total: 0, 
                    counts: initialCounts,
                    dateObj: new Date(date.getFullYear(), date.getMonth(), 1) 
                });
            }
            
            const entry = map.get(monthKey)!;
            const whKey = getWarehouseKey(s);
            entry.counts[whKey]++;
            entry.total++;
        });
        
        return Array.from(map.values())
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(m => {
                const label = m.dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                const key = `${m.dateObj.getFullYear()}_${m.dateObj.getMonth()}`;
                
                // Filter the breakdown list based on the active warehouse category filter
                const fullBreakdown = WAREHOUSE_CONFIGS.map(wh => {
                    const count = m.counts[wh.key] || 0;
                    return {
                        ...wh,
                        count,
                        pct: m.total > 0 ? (count / m.total) * 100 : 0
                    };
                });

                // Recalculate total according to active filter if needed, but we keep actual raw total
                const filteredBreakdown = fullBreakdown.filter(wh => {
                    if (warehouseTypeFilter === 'all') return true;
                    return wh.type === warehouseTypeFilter;
                });

                const filteredTotal = filteredBreakdown.reduce((sum, item) => sum + item.count, 0);

                return {
                    label,
                    key,
                    rawTotal: m.total,
                    filteredTotal,
                    breakdown: filteredBreakdown.map(item => ({
                        ...item,
                        // recalculate percentages relative to the shown subset total
                        subsetPct: filteredTotal > 0 ? (item.count / filteredTotal) * 100 : 0
                    })).sort((a, b) => b.count - a.count) // sort by highest delivery count
                };
            });
    }, [deliveredShipments, warehouseTypeFilter]);

    // Totals for executive banner
    const totals = useMemo(() => {
        const t: Record<string, number> = {};
        let all = 0;
        let bondedTotal = 0;
        let generalTotal = 0;
        
        WAREHOUSE_CONFIGS.forEach(wh => {
            t[wh.key] = 0;
        });

        dataByMonth.forEach(m => {
            m.breakdown.forEach(item => {
                t[item.key] += item.count;
                if (item.type === 'bonded') bondedTotal += item.count;
                else if (item.type === 'general') generalTotal += item.count;
            });
            all += m.filteredTotal;
        });

        return {
            all,
            bondedTotal,
            generalTotal,
            breakdown: WAREHOUSE_CONFIGS.map(wh => ({
                ...wh,
                count: t[wh.key] || 0,
                pct: all > 0 ? ((t[wh.key] || 0) / all) * 100 : 0
            })).filter(wh => {
                if (warehouseTypeFilter === 'all') return true;
                return wh.type === warehouseTypeFilter;
            }).sort((a, b) => b.count - a.count)
        };
    }, [dataByMonth, warehouseTypeFilter]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8 flex-1 min-h-[500px]"
        >
            {/* Header Banner */}
            <div className="p-8 md:p-10 rounded-[3rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white relative overflow-hidden ring-1 ring-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/30">
                                <Truck className="w-6 h-6 text-emerald-400" />
                            </div>
                            <span className="text-[10px] font-black tracking-[0.25em] text-emerald-400 uppercase">Delivery Logistics</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none mt-2">
                            Monthly Deliveries Distribution
                        </h2>
                        <p className="text-sm text-slate-400 max-w-2xl font-medium">
                            Monthly overview of successfully delivered containers grouped by their actual completion date and final warehouse destinations.
                        </p>
                    </div>

                    <div className="flex shrink-0 gap-3">
                        <button
                            onClick={clearAllNotes}
                            className="inline-flex items-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer shadow-lg"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Clear All Notes
                        </button>
                    </div>
                </div>

                {/* Segment Selector for Warehouse Categories */}
                <div className="relative z-10 flex flex-wrap items-center gap-2 mt-8 bg-slate-900/50 p-2 rounded-2xl border border-slate-800/80 max-w-md">
                    <button
                        onClick={() => setWarehouseTypeFilter('all')}
                        className={`flex-1 text-center py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            warehouseTypeFilter === 'all' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        All ({totals.bondedTotal + totals.generalTotal})
                    </button>
                    <button
                        onClick={() => setWarehouseTypeFilter('bonded')}
                        className={`flex-1 text-center py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            warehouseTypeFilter === 'bonded' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Bonded ({totals.bondedTotal})
                    </button>
                    <button
                        onClick={() => setWarehouseTypeFilter('general')}
                        className={`flex-1 text-center py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            warehouseTypeFilter === 'general' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        General ({totals.generalTotal})
                    </button>
                </div>

                {/* Executive Totals */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6 pt-6 border-t border-slate-800/60 relative z-10">
                    <div className="bg-slate-850 border border-slate-700/40 rounded-2xl p-5 flex flex-col justify-center col-span-2 sm:col-span-1 shadow-inner">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Delivered</span>
                        <div className="text-3xl font-display font-black text-white">
                            {totals.all} <span className="text-xs text-slate-500 font-bold">CNTR</span>
                        </div>
                    </div>
                    {totals.breakdown.slice(0, 5).map((wh) => (
                        <div key={wh.key} className={`bg-slate-850 border border-slate-700/40 rounded-2xl p-4 border-t-2 ${wh.border} shadow-inner`}>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wide block mb-1 truncate">{wh.name}</span>
                            <div className="text-xl font-display font-black text-white">
                                {wh.count} <span className="text-[10px] text-slate-500 font-bold">({wh.pct.toFixed(1)}%)</span>
                            </div>
                        </div>
                    ))}
                    {totals.breakdown.length > 5 && (
                        <div className="bg-slate-850 border border-slate-700/40 rounded-2xl p-4 flex flex-col justify-center text-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Other Locations</span>
                            <div className="text-sm font-bold text-slate-300 mt-1">
                                {totals.breakdown.slice(5).reduce((sum, item) => sum + item.count, 0)} CNTR ({totals.breakdown.slice(5).reduce((sum, item) => sum + item.pct, 0).toFixed(1)}%)
                            </div>
                        </div>
                    )}
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Select one or multiple Incoterms to slice the monthly completed deliveries distribution</p>
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
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No completed deliveries found for the active selection.</p>
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
                                    <div className="text-xs font-black text-slate-800">{month.filteredTotal}</div>
                                    <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">CNTR DELIVERED</div>
                                </div>
                            </div>

                            {/* Bar Charts */}
                            <div className="space-y-3.5 mb-8 flex-1">
                                {month.breakdown.filter(wh => wh.count > 0).map((wh) => (
                                    <div key={wh.key} className="relative">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                            <span className="truncate max-w-[150px]">{wh.name}</span>
                                            <span className="text-slate-700 font-bold">{wh.count} cont. ({wh.subsetPct.toFixed(1)}%)</span>
                                        </div>
                                        <div className={`w-full h-2.5 rounded-full ${wh.bg} overflow-hidden flex`}>
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${wh.subsetPct}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`h-full ${wh.color} rounded-full`}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {month.breakdown.filter(wh => wh.count > 0).length === 0 && (
                                    <p className="text-slate-400 text-xs italic py-4 text-center">No matching active allocations.</p>
                                )}
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

export default React.memo(DeliveriesView);
