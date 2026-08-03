import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import { Building2, Save, FileText, Trash2, Network } from 'lucide-react';

interface WarehouseDistributionProps {
    shipments: Shipment[];
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

export const WarehouseDistribution: React.FC<WarehouseDistributionProps> = ({ shipments = [] }) => {
    const [justifications, setJustifications] = useState<Record<string, string>>(() => {
        try {
            const stored = localStorage.getItem('wh_distribution_justifications');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Error loading justifications', e);
            return {};
        }
    });

    const updateJustification = (key: string, value: string) => {
        const updated = { ...justifications, [key]: value };
        setJustifications(updated);
        try {
            localStorage.setItem('wh_distribution_justifications', JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving justifications', e);
        }
    };

    const clearAllNotes = () => {
        if (window.confirm("Are you sure you want to clear all justification notes?")) {
            setJustifications({});
            localStorage.removeItem('wh_distribution_justifications');
        }
    };

    const dataByMonth = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        const map = new Map<string, { total: number, tecon: number, intermaritima: number, tpc: number, clia: number, dateObj: Date }>();
        
        shipments.forEach(s => {
            if (!s) return;
            const date = s.ata || s.estimatedDelivery;
            if (!date || !isValidDate(date)) return;
            
            const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
            
            if (!map.has(monthKey)) {
                map.set(monthKey, { 
                    total: 0, 
                    tecon: 0, 
                    intermaritima: 0, 
                    tpc: 0, 
                    clia: 0, 
                    dateObj: new Date(date.getFullYear(), date.getMonth(), 1) 
                });
            }
            
            const entry = map.get(monthKey)!;
            
            const bw = String(s.bondedWarehouse || '').toUpperCase();
            if (bw.includes('TECON')) entry.tecon++;
            else if (bw.includes('INTERMARITIMA') || bw.includes('INTER')) entry.intermaritima++;
            else if (bw.includes('TPC')) entry.tpc++;
            else if (bw.includes('CLIA') || bw.includes('EMPORIO') || bw.includes('EMPÓRIO')) entry.clia++;
            
            entry.total++;
        });
        
        return Array.from(map.values())
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(m => {
                const label = m.dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                const key = `${m.dateObj.getFullYear()}_${m.dateObj.getMonth()}`;
                return {
                    label,
                    key,
                    total: m.total,
                    tecon: m.tecon,
                    intermaritima: m.intermaritima,
                    tpc: m.tpc,
                    clia: m.clia,
                    teconPct: m.total > 0 ? (m.tecon / m.total) * 100 : 0,
                    intermaritimaPct: m.total > 0 ? (m.intermaritima / m.total) * 100 : 0,
                    tpcPct: m.total > 0 ? (m.tpc / m.total) * 100 : 0,
                    cliaPct: m.total > 0 ? (m.clia / m.total) * 100 : 0,
                };
            });
    }, [shipments]);

    // Totals for executive banner
    const totals = useMemo(() => {
        const t = { tecon: 0, intermaritima: 0, tpc: 0, clia: 0, all: 0 };
        dataByMonth.forEach(m => {
            t.tecon += m.tecon;
            t.intermaritima += m.intermaritima;
            t.tpc += m.tpc;
            t.clia += m.clia;
            t.all += m.total;
        });
        return t;
    }, [dataByMonth]);

    const colors = {
        tecon: 'bg-blue-500',
        intermaritima: 'bg-emerald-500',
        tpc: 'bg-amber-500',
        clia: 'bg-purple-500'
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-24 w-full"
        >
            {/* Executive Banner */}
            <div className="glass p-8 md:p-10 rounded-[3rem] ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-10">
                    <span className="material-icons text-[15rem] font-black w-24 h-24">domain</span>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-black uppercase text-indigo-200 bg-indigo-900/50 px-3 py-1 rounded-full border border-indigo-500/30 flex items-center gap-1.5 shadow-inner">
                                <Network className="w-3.5 h-3.5" /> MONTHLY DISTRIBUTION
                            </span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-display font-black tracking-tight leading-tight">
                            Warehouse Distribution
                        </h2>
                        <p className="text-slate-400 font-bold mt-4 tracking-wide text-xs max-w-2xl leading-relaxed">
                            Executive analysis of bonded warehouse allocations over time. Use this dashboard to justify proportional distribution between key terminals for board reporting.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={clearAllNotes}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800/50 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" /> Clear All Notes
                        </button>
                    </div>
                </div>

                {/* Overall Stats summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Volume</span>
                        <div className="text-3xl font-display font-black">{totals.all}</div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm border-t-2 border-t-blue-500">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tecon S.A.</span>
                        <div className="text-2xl font-display font-black">{totals.tecon} <span className="text-xs text-slate-500">({totals.all > 0 ? (totals.tecon/totals.all*100).toFixed(1) : 0}%)</span></div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm border-t-2 border-t-emerald-500">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Intermaritima</span>
                        <div className="text-2xl font-display font-black">{totals.intermaritima} <span className="text-xs text-slate-500">({totals.all > 0 ? (totals.intermaritima/totals.all*100).toFixed(1) : 0}%)</span></div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm border-t-2 border-t-amber-500">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">TPC</span>
                        <div className="text-2xl font-display font-black">{totals.tpc} <span className="text-xs text-slate-500">({totals.all > 0 ? (totals.tpc/totals.all*100).toFixed(1) : 0}%)</span></div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm border-t-2 border-t-purple-500">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Clia Emporio</span>
                        <div className="text-2xl font-display font-black">{totals.clia} <span className="text-xs text-slate-500">({totals.all > 0 ? (totals.clia/totals.all*100).toFixed(1) : 0}%)</span></div>
                    </div>
                </div>
            </div>

            {/* Grid of Months */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {dataByMonth.length === 0 ? (
                    <div className="col-span-full glass p-12 rounded-[3rem] text-center">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No arrived shipments found in this view to analyze distribution.</p>
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
                            <div className="space-y-4 mb-8 flex-1">
                                {[
                                    { name: 'Tecon S.A.', count: month.tecon, pct: month.teconPct, color: colors.tecon, bg: 'bg-blue-50' },
                                    { name: 'Intermaritima', count: month.intermaritima, pct: month.intermaritimaPct, color: colors.intermaritima, bg: 'bg-emerald-50' },
                                    { name: 'TPC', count: month.tpc, pct: month.tpcPct, color: colors.tpc, bg: 'bg-amber-50' },
                                    { name: 'Clia Emporio', count: month.clia, pct: month.cliaPct, color: colors.clia, bg: 'bg-purple-50' }
                                ].map((wh) => (
                                    <div key={wh.name} className="relative">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                            <span>{wh.name}</span>
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

export default React.memo(WarehouseDistribution);