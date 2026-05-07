
import React, { useMemo, useState } from 'react';
import { Shipment } from '../types';

interface OperationalLotGridProps {
    shipments: Shipment[];
    onLotClick: (model: string, dateStr: string, batchNumber: string) => void;
}

const OperationalLotGrid: React.FC<OperationalLotGridProps> = ({ shipments, onLotClick }) => {
    const [isMaximized, setIsMaximized] = useState(false);

    const { dates, models, grid } = useMemo(() => {
        const dateSet = new Set<string>();
        const modelSet = new Set<string>();
        
        // Use last operational days
        const deliveredOnly = shipments.filter(s => s.deliveryByd).sort((a, b) => a.deliveryByd!.getTime() - b.deliveryByd!.getTime());
        
        deliveredOnly.forEach(s => {
            const dateStr = s.deliveryByd!.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            dateSet.add(dateStr);
            modelSet.add(s.cargoModel);
        });

        const sortedDates = Array.from(dateSet).slice(-12); // Last 12 days
        const sortedModels = Array.from(modelSet).sort();
        
        const gridData: Record<string, Record<string, Array<{ batch: string; count: number }>>> = {};

        sortedModels.forEach(m => {
            gridData[m] = {};
            sortedDates.forEach(d => {
                gridData[m][d] = [];
            });
        });

        shipments.forEach(s => {
            if (!s.deliveryByd) return;
            const dateStr = s.deliveryByd.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            if (!sortedDates.includes(dateStr)) return;

            const existingBatch = gridData[s.cargoModel][dateStr].find(b => b.batch === s.batchNumber);
            if (existingBatch) {
                existingBatch.count++;
            } else {
                gridData[s.cargoModel][dateStr].push({ batch: s.batchNumber, count: 1 });
            }
        });

        return { dates: sortedDates, models: sortedModels, grid: gridData };
    }, [shipments]);

    if (dates.length === 0) return null;

    const isWeekend = (dateStr: string) => {
        const sample = shipments.find(s => s.deliveryByd?.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) === dateStr);
        if (!sample || !sample.deliveryByd) return false;
        const day = sample.deliveryByd.getDay();
        return day === 0 || day === 6;
    };

    const renderGridTable = (maximized: boolean = false) => (
        <div className={`overflow-x-auto ${maximized ? 'h-full' : ''}`}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="sticky left-0 z-20 glass-dark backdrop-blur-xl px-8 py-6 text-left text-[11px] font-black text-white/70 uppercase tracking-[0.2em] border-r border-white/10 min-w-[180px]">
                            MODEL ARCHITECTURE
                        </th>
                        {dates.map(date => {
                            const weekend = isWeekend(date);
                            return (
                                <th 
                                    key={date} 
                                    className={`px-4 py-6 text-center text-sm font-black border-r border-white/10 min-w-[130px] ${
                                        weekend 
                                            ? 'bg-indigo-600/90 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]' 
                                            : 'bg-emerald-600/90 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]'
                                    }`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] opacity-60 font-black uppercase tracking-widest">{weekend ? 'WKND' : 'WDAY'}</span>
                                        {date}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                    {models.map(model => (
                        <tr key={model} className="group hover:bg-white/40 transition-all duration-300">
                            <td className={`sticky left-0 z-10 glass-dark group-hover:bg-indigo-950/40 px-8 py-8 font-black text-slate-800 border-r border-white/10 text-sm tracking-tight transition-colors`}>
                                {model}
                            </td>
                            {dates.map(date => {
                                const lots = grid[model][date];
                                return (
                                    <td key={`${model}-${date}`} className="p-4 border-r border-white/10 align-top">
                                        <div className={`flex flex-col gap-3 ${maximized ? 'min-h-[90px]' : 'min-h-[70px]'}`}>
                                            {lots.length > 0 ? (
                                                lots.map((lot, idx) => (
                                                    <button 
                                                        key={idx} 
                                                        onClick={() => onLotClick(model, date, lot.batch)}
                                                        className="flex items-center justify-between glass-dark border-none text-slate-800 rounded-2xl px-4 py-3 shadow-glass ring-1 ring-white/50 animate-in zoom-in-95 duration-500 hover:bg-white/80 hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer text-left w-full group/lot"
                                                    >
                                                        <span className="text-[10px] font-black tracking-widest truncate mr-3 text-slate-500">BATCH {lot.batch}</span>
                                                        <span className="bg-indigo-600 text-white text-[10px] font-black min-w-[22px] h-[22px] flex items-center justify-center rounded-lg px-1.5 shadow-lg shadow-indigo-200">
                                                            {lot.count}
                                                        </span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity">
                                                    <span className="material-icons text-slate-300 text-lg">blur_on</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="no-export">
            <div className="glass rounded-[2.5rem] border-none shadow-glass overflow-hidden mt-8 ring-1 ring-white/40 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <div className="p-10 border-b border-white/20 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <span className="material-icons text-emerald-600">grid_on</span>
                            </div>
                            Operational Deployment Matrix
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-3 pl-1 opacity-80">
                            Batch orchestration vs temporal throughput
                        </p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200 ring-2 ring-white"></div>
                                <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Weekday Flux</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-lg shadow-indigo-200 ring-2 ring-white"></div>
                                <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Weekend Shift</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsMaximized(true)}
                            className="text-slate-400 hover:text-indigo-600 focus:outline-none p-3 hover:bg-white/60 rounded-2xl transition-all no-export ring-1 ring-transparent hover:ring-white/50"
                            title="Maximize Intelligence Grid"
                        >
                            <span className="material-icons text-2xl">fullscreen</span>
                        </button>
                    </div>
                </div>

                {renderGridTable()}
                
                <div className="p-6 glass-dark text-center border-t border-white/20">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-60">
                        Interactive Matrix • Horizontal Scroll Enabled
                     </p>
                </div>
            </div>

            {/* Maximized Modal */}
            {isMaximized && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 sm:p-10 animate-in fade-in duration-500">
                    <div className="glass w-full max-w-[1600px] h-full max-h-[92vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden relative border-none ring-1 ring-white/50">
                        <div className="p-10 border-b border-white/20 flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-4">
                                    <div className="p-2.5 bg-indigo-500/10 rounded-2xl">
                                        <span className="material-icons text-indigo-600 text-2xl">analytics</span>
                                    </div>
                                    Strategic Deployment Intelligence
                                </h2>
                                <p className="text-[11px] font-black text-slate-400 mt-2 uppercase tracking-[0.3em] pl-1 opacity-80">
                                    Historical Operational Cycles • 12 Day Deep-Dive Matrix
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsMaximized(false)}
                                className="glass-dark hover:bg-white/80 text-slate-400 hover:text-red-500 p-4 rounded-3xl transition-all shadow-glass ring-1 ring-white/50"
                            >
                                <span className="material-icons text-2xl">close</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-white/10">
                            {renderGridTable(true)}
                        </div>

                        <div className="p-10 glass-dark border-t border-white/20 flex justify-between items-center px-12">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/20"></div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operational Status: Optimized</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsMaximized(false)}
                                className="px-10 py-4 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.25em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
                            >
                                Revert to Brief View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(OperationalLotGrid);
