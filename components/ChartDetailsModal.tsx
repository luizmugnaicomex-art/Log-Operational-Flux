import React, { useState, useMemo } from 'react';
import { Shipment } from '../types';
import { currencyFormatter } from '../utils/formatters';
import { getContractForWarehouse, calculateWarehouseCost, DEFAULT_CARGO_VALUE } from '../utils/financials';
import { exportShipmentsToExcel } from '../utils/export';

interface ChartDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    weekLabel: string;
    shipments: Shipment[];
    avgDrainRate?: number;
    groupedData?: Record<string, Record<string, string[]>>;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const ChartDetailsModal: React.FC<ChartDetailsModalProps> = ({ 
    isOpen, 
    onClose, 
    weekLabel = '', 
    shipments = [], 
    avgDrainRate = 1, 
    groupedData 
}) => {
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showOnlyPicked, setShowOnlyPicked] = useState(false);
    const [expandedVessels, setExpandedVessels] = useState<Record<string, boolean>>({});
    const [expandedBLs, setExpandedBLs] = useState<Record<string, boolean>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const toggleVessel = (vessel: string) => {
        setExpandedVessels(prev => ({ ...prev, [vessel]: !prev[vessel] }));
    };

    const toggleBL = (bl: string) => {
        setExpandedBLs(prev => ({ ...prev, [bl]: !prev[bl] }));
    };

    // Filter displayed shipments safely
    const displayedShipments = useMemo(() => {
        if (!isOpen || !Array.isArray(shipments)) return [];
        let filtered = shipments;
        if (showOnlyPending) {
            filtered = filtered.filter(s => s && !isValidDate(s.deliveryByd));
        } else if (showOnlyPicked) {
            filtered = filtered.filter(s => s && isValidDate(s.deliveryByd));
        }
        return filtered;
    }, [isOpen, shipments, showOnlyPending, showOnlyPicked]);

    const isDemurrageView = (weekLabel || '').toLowerCase().includes('demurrage') || (weekLabel || '').toLowerCase().includes('risk');
    const isClearanceView = (weekLabel || '').toLowerCase().includes('clearance') || (weekLabel || '').toLowerCase().includes('customs');
    const isCargoReadyView = (weekLabel || '').toLowerCase().includes('cargo ready');
    const isInventoryView = (weekLabel || '').toLowerCase().includes('inventory');                
    const isAtaView = (weekLabel || '').toLowerCase().includes('vessel arrivals');
    const isProjectedView = (weekLabel || '').toLowerCase().includes('projected');
    const isPipelineView = (weekLabel || '').toLowerCase().includes('pipeline') || (weekLabel || '').toLowerCase().includes('week drilldown') || (weekLabel || '').toLowerCase().includes('drilldown') || isInventoryView;

    const pipelineSummary = useMemo(() => {
        if (!isOpen || !isPipelineView || !Array.isArray(shipments) || shipments.length === 0) return null;
        
        const dates = shipments
            .map(s => s ? (s.ata || s.estimatedDelivery) : null)
            .filter(isValidDate);
            
        const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
        
        const vessels = new Set(shipments.map(s => s?.vesselName).filter(Boolean));
        
        const drainDaysFactory = Math.ceil(shipments.length / 150);
        const status = drainDaysFactory > 10 ? 'TIME COLLISION (150/D)' : 'SAFE';

        return {
            range: isValidDate(minDate) && isValidDate(maxDate) 
                ? `${minDate.toLocaleDateString('pt-BR')} → ${maxDate.toLocaleDateString('pt-BR')}` 
                : 'N/A',
            vesselsCount: vessels.size,
            total: shipments.length,
            status
        };
    }, [isOpen, isPipelineView, shipments]);

    const pipelineDailyBreakdown = useMemo(() => {
        if (!isOpen || !isPipelineView || !Array.isArray(shipments) || shipments.length === 0) return [];
        const dailyMap: Record<string, { date: Date; qty: number; vessels: Set<string> }> = {};
        
        shipments.forEach(s => {
            if (!s) return;
            const date = s.ata || s.estimatedDelivery;
            if (!isValidDate(date)) return;
            
            try {
                const key = date.toISOString().split('T')[0];
                if (!dailyMap[key]) {
                    dailyMap[key] = { date, qty: 0, vessels: new Set() };
                }
                dailyMap[key].qty++;
                if (s.vesselName) dailyMap[key].vessels.add(s.vesselName);
            } catch (e) {
                console.error("Error processing date in pipeline breakdown", e);
            }
        });

        return Object.values(dailyMap).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 30);
    }, [isOpen, isPipelineView, shipments]);

    const pipelineVesselBreakdown = useMemo(() => {
        if (!isOpen || !isPipelineView || !Array.isArray(shipments) || shipments.length === 0) return [];
        const vesselMap: Record<string, { name: string; qty: number; minEta: Date | null; maxEta: Date | null; terminals: Record<string, number> }> = {};

        shipments.forEach(s => {
            if (!s) return;
            const name = s.vesselName || 'A DEFINIR';
            if (!vesselMap[name]) {
                vesselMap[name] = { name, qty: 0, minEta: null, maxEta: null, terminals: {} };
            }
            vesselMap[name].qty++;
            
            const eta = s.ata || s.estimatedDelivery;
            if (isValidDate(eta)) {
                if (!vesselMap[name].minEta || eta < vesselMap[name].minEta) vesselMap[name].minEta = eta;
                if (!vesselMap[name].maxEta || eta > vesselMap[name].maxEta) vesselMap[name].maxEta = eta;
            }

            const terminal = s.bondedWarehouse || 'OUTROS';
            vesselMap[name].terminals[terminal] = (vesselMap[name].terminals[terminal] || 0) + 1;
        });

        return Object.values(vesselMap).sort((a, b) => b.qty - a.qty).slice(0, 20);
    }, [isOpen, isPipelineView, shipments]);

    const totalCostInView = useMemo(() => {
        if (!isOpen || !Array.isArray(shipments) || shipments.length === 0) return 0;
        if (isProjectedView) {
            const todayUTC = new Date();
            todayUTC.setHours(0,0,0,0);
            return shipments.reduce((sum, s, index) => {
                if (!s) return sum;
                const startDate = s.cargoReadyDate || s.ata;
                if (!isValidDate(startDate)) return sum;
                
                try {
                    const daysAlreadyInBacklog = (todayUTC.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                    const safeRate = Math.max(0.1, avgDrainRate);
                    const estimatedDaysToDrain = index / safeRate;
                    const projectedDays = Math.ceil(daysAlreadyInBacklog + estimatedDaysToDrain);
                    const contract = getContractForWarehouse(s.bondedWarehouse);
                    const cost = calculateWarehouseCost(contract, DEFAULT_CARGO_VALUE, projectedDays, 1);
                    return sum + (cost?.total || 0);
                } catch (e) {
                    return sum;
                }
            }, 0);
        }
        return shipments.reduce((sum, s) => sum + (s ? (isDemurrageView ? (s.demurrageCost || 0) : (s.totalCost || 0)) : 0), 0);
    }, [isOpen, shipments, isDemurrageView, isProjectedView, avgDrainRate]);

    const { pendingCount, lateShipments, pickedCount } = useMemo(() => {
        if (!isOpen || !Array.isArray(shipments)) return { pendingCount: 0, lateShipments: 0, pickedCount: 0 };
        return {
            pendingCount: shipments.filter(s => s && !s.deliveryByd).length,
            pickedCount: shipments.filter(s => s && s.deliveryByd).length,
            lateShipments: shipments.filter(s => s && s.clientDeliveryVariance !== null && (s.clientDeliveryVariance || 0) > 0).length
        };
    }, [isOpen, shipments]);

    const tableData = useMemo(() => {
        if (!isOpen || !Array.isArray(displayedShipments)) return [];
        const todayUTC = new Date();
        todayUTC.setHours(0,0,0,0);

        const result = displayedShipments.map((s, idx) => {
            if (!s) return null;
            let projectedCost = '-';
            let currentAge = '-';
            
            if (isProjectedView) {
                const start = s.cargoReadyDate || s.ata;
                if (isValidDate(start)) {
                    try {
                        const daysAlreadyInBacklog = (todayUTC.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                        const safeRate = Math.max(0.1, avgDrainRate);
                        const estimatedDaysToDrain = idx / safeRate;
                        const projectedDays = Math.ceil(daysAlreadyInBacklog + estimatedDaysToDrain);
                        const contract = getContractForWarehouse(s.bondedWarehouse);
                        const cost = calculateWarehouseCost(contract, DEFAULT_CARGO_VALUE, projectedDays, 1);
                        projectedCost = currencyFormatter.format(cost.total).replace('.00','');
                        currentAge = `${Math.floor(daysAlreadyInBacklog)} Days`;
                    } catch (e) {
                        // Keep defaults
                    }
                }
            }
            
            return {
                ...s,
                projectedCost,
                currentAge
            };
        }).filter(Boolean);
        
        return result as any[];
    }, [isOpen, displayedShipments, isProjectedView, avgDrainRate]);

    if (!isOpen) return null;

    const count = shipments?.length || 0;

    const getStatusBadge = (s: Shipment) => {
        const isDelivered = !!s.deliveryByd;
        const isReturned = !!s.actualDepotReturnDate;
        const hasDemurrage = (s.demurrageCost || 0) > 0;

        if (!isDelivered) {
            return (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border-none glass-dark text-amber-600 shadow-sm animate-pulse flex items-center gap-2 w-fit ring-1 ring-white/50">
                    <span className="material-icons text-[12px]">pending_actions</span>
                    Pending
                </span>
            );
        }

        if (isDelivered && !isReturned) {
            return (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border-none glass-dark text-indigo-600 shadow-sm flex items-center gap-2 w-fit ring-1 ring-white/50">
                    <span className="material-icons text-[12px]">local_shipping</span>
                    Operational
                </span>
            );
        }

        if (isReturned && !hasDemurrage) {
            return (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border-none glass-dark text-emerald-600 shadow-sm flex items-center gap-2 w-fit ring-1 ring-white/50">
                    <span className="material-icons text-[12px]">task_alt</span>
                    Archived
                </span>
            );
        }

        return (
            <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border-none glass-dark text-rose-600 shadow-sm flex items-center gap-2 w-fit ring-1 ring-white/50">
                <span className="material-icons text-[12px]">history_toggle_off</span>
                Late Return
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl transition-all duration-500" aria-hidden="true" onClick={onClose}></div>

                <div className="relative transform overflow-hidden rounded-[3.5rem] glass text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-6xl border-none ring-1 ring-white/50">
                    <div className="px-8 pt-10 pb-4 sm:p-12 sm:pb-6">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                 <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter" id="modal-title">
                                        {weekLabel}
                                    </h3>
                                    <button onClick={onClose} className="glass-dark hover:bg-white/80 p-3 rounded-2xl text-slate-400 hover:text-red-500 transition-all shadow-glass ring-1 ring-white/50">
                                        <span className="material-icons text-3xl">close</span>
                                    </button>
                                </div>

                                {isPipelineView && pipelineSummary && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            RANGE: <span className="text-slate-600">{pipelineSummary.range}</span>
                                        </span>
                                        <span className="text-slate-200">|</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            VESSELS: <span className="text-slate-600">{pipelineSummary.vesselsCount}</span>
                                        </span>
                                        <span className="text-slate-200">|</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            TOTAL: <span className="text-slate-600">{pipelineSummary.total} FCL</span>
                                        </span>
                                        <span className={`ml-2 px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                                            pipelineSummary.status.includes('COLLISION') 
                                            ? 'bg-red-50 text-red-600 border-red-100' 
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        }`}>
                                            {pipelineSummary.status}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Calculation Summary Panel */}
                                <div className="mt-6 glass-dark p-8 rounded-[2.5rem] border-none ring-1 ring-white/20">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-5 tracking-[0.3em] pl-1 opacity-80">Live Process Architecture Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-gray-700">
                                        <div className="glass p-6 rounded-2xl border-none shadow-glass hover:bg-white/80 transition-all group">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest opacity-70">Total units</p>
                                            <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{count} <span className="text-[10px] text-slate-400 ml-1">FCL</span></p>
                                        </div>
                                        <div className="glass p-6 rounded-2xl border-none shadow-glass hover:bg-white/80 transition-all group">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest opacity-70">Financial Depth</p>
                                            <p className="text-3xl font-black text-red-600">{currencyFormatter.format(totalCostInView).replace('.00','')}</p>
                                        </div>
                                        <div className="glass p-6 rounded-2xl border-none shadow-glass hover:bg-white/80 transition-all group">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest opacity-70">SLA Deviation</p>
                                            <p className="text-3xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">{lateShipments}</p>
                                            <p className="text-[9px] text-red-400 font-bold uppercase mt-2 transform group-hover:translate-x-1 transition-transform tracking-tight">* Dynamic estimate missed</p>
                                        </div>
                                        <div className="glass p-6 rounded-2xl border-none shadow-glass hover:bg-white/80 transition-all group">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest opacity-70">Flux Purity</p>
                                            <p className="text-3xl font-black text-emerald-600">
                                                {count > 0 ? (((count - lateShipments) / count) * 100).toFixed(1) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                 {/* Pipeline Specific Analytics */}
                                {isPipelineView && (
                                    <div className="mt-8 space-y-8">
                                        {/* Arrival by Day */}
                                        <div className="glass rounded-3xl border-none ring-1 ring-white/30 overflow-hidden shadow-glass">
                                            <div className="px-10 py-5 glass-dark border-b border-white/20 flex justify-between items-center">
                                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.25em] opacity-80">Cycle Arrival Map</h4>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Vessel Stream</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 glass-dark">
                                                            <th className="px-10 py-4">Timeline</th>
                                                            <th className="px-6 py-4">Flux</th>
                                                            <th className="px-10 py-4">Orchestrated Vessels</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/10">
                                                        {pipelineDailyBreakdown.map((day, idx) => (
                                                            <tr key={idx} className="hover:bg-white/40 transition-colors group">
                                                                <td className="px-10 py-5 text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{isValidDate(day.date) ? day.date.toLocaleDateString('pt-BR') : '-'}</td>
                                                                <td className={`px-6 py-5 text-sm font-black ${day.qty > 100 ? 'text-orange-600' : 'text-slate-900 group-hover:text-indigo-900'}`}>{day.qty} <span className="text-[10px] font-bold opacity-40">U</span></td>
                                                                <td className="px-10 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                                                    {Array.from(day.vessels).join(' • ') || 'N/A'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Vessels Arriving */}
                                        <div className="glass rounded-3xl border-none ring-1 ring-white/30 overflow-hidden shadow-glass">
                                            <div className="px-10 py-5 glass-dark border-b border-white/20 flex justify-between items-center">
                                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.25em] opacity-80">Strategic Vessel Pipeline</h4>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Load Density Hierarchy</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 glass-dark">
                                                            <th className="px-10 py-4">Vessel Designation</th>
                                                            <th className="px-6 py-4">Cargo</th>
                                                            <th className="px-6 py-4">Window Start</th>
                                                            <th className="px-6 py-4">Window End</th>
                                                            <th className="px-10 py-4">Terminal Distribution</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/10">
                                                        {pipelineVesselBreakdown.map((v, idx) => (
                                                            <tr key={idx} className="hover:bg-white/40 transition-colors group">
                                                                <td className="px-10 py-5 text-sm font-black text-indigo-600 uppercase tracking-tighter group-hover:translate-x-1 transition-transform">{v.name}</td>
                                                                <td className="px-6 py-5 text-sm font-black text-slate-900 group-hover:text-indigo-900">{v.qty}</td>
                                                                <td className="px-6 py-5 text-[11px] font-bold text-slate-500">{isValidDate(v.minEta) ? v.minEta.toLocaleDateString('pt-BR') : '-'}</td>
                                                                <td className="px-6 py-5 text-[11px] font-bold text-slate-500">{isValidDate(v.maxEta) ? v.maxEta.toLocaleDateString('pt-BR') : '-'}</td>
                                                                <td className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                                    {Object.entries(v.terminals)
                                                                        .map(([term, count]) => `${term}: ${count}`)
                                                                        .join(' | ')}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Detailed Process Table */}
                                <div className="mt-12">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                                        <div>
                                            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.25em] opacity-80 decoration-indigo-600/30 underline decoration-2 underline-offset-4">Considered Process Log</h4>
                                            <p className="text-[10px] text-slate-400 font-bold mt-2 tracking-widest uppercase opacity-60">High-Fidelity performance records</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4">
                                            <button 
                                                onClick={() => exportShipmentsToExcel(displayedShipments, `${(weekLabel || 'Data').replace(/\s+/g, '_')}_Export.xlsx`)}
                                                className="flex items-center gap-3 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-lg bg-emerald-600 text-white shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-105 active:scale-95"
                                            >
                                                <span className="material-icons text-base">download</span>
                                                Export System
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setShowOnlyPending(!showOnlyPending);
                                                    if (!showOnlyPending) setShowOnlyPicked(false);
                                                }}
                                                className={`flex items-center gap-3 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-glass ring-1 ${
                                                    showOnlyPending 
                                                    ? 'bg-amber-600 text-white ring-amber-500 shadow-amber-200' 
                                                    : 'glass text-slate-600 ring-white/50 hover:bg-white/80'
                                                }`}
                                            >
                                                <span className="material-icons text-base">pending_actions</span>
                                                Pending Layer ({pendingCount})
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setShowOnlyPicked(!showOnlyPicked);
                                                    if (!showOnlyPicked) setShowOnlyPending(false);
                                                }}
                                                className={`flex items-center gap-3 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-glass ring-1 ${
                                                    showOnlyPicked 
                                                    ? 'bg-indigo-600 text-white ring-indigo-500 shadow-indigo-200' 
                                                    : 'glass text-slate-600 ring-white/50 hover:bg-white/80'
                                                }`}
                                            >
                                                <span className="material-icons text-base">local_shipping</span>
                                                Picked Layer ({pickedCount})
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto max-h-[600px] glass-dark rounded-[2.5rem] shadow-inner ring-1 ring-white/20 bg-white/5">
                                        {groupedData ? (
                                            <div className="p-8 space-y-6">
                                                {Object.entries(groupedData).map(([vessel, bls]) => (
                                                    <div key={vessel} className="glass border-none rounded-[2rem] overflow-hidden transition-all shadow-glass ring-1 ring-white/40">
                                                        <button 
                                                            onClick={() => toggleVessel(vessel)}
                                                            className="w-full flex items-center justify-between p-6 glass-dark hover:bg-white/60 transition-all text-left group"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <span className="material-icons text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                                    {expandedVessels[vessel] ? 'expand_more' : 'chevron_right'}
                                                                </span>
                                                                <span className="font-black text-slate-800 uppercase tracking-[0.15em] group-hover:translate-x-1 transition-transform">{vessel}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-500 glass px-4 py-2 rounded-xl ring-1 ring-white/50 shadow-sm uppercase tracking-widest">
                                                                {Object.keys(bls || {}).length} BL UNITS
                                                            </span>
                                                        </button>
                                                        
                                                        {expandedVessels[vessel] && (
                                                            <div className="p-6 space-y-4 bg-white/10">
                                                                {Object.entries(bls || {}).map(([bl, containers]) => (
                                                                    <div key={bl} className="glass-dark border-none rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-sm">
                                                                        <button 
                                                                            onClick={() => toggleBL(bl)}
                                                                            className="w-full flex items-center justify-between p-5 hover:bg-white/20 transition-all text-left"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="material-icons text-indigo-400 text-base">
                                                                                    {expandedBLs[bl] ? 'expand_more' : 'chevron_right'}
                                                                                </span>
                                                                                <span className="font-black text-indigo-700 text-sm tracking-tight">{bl}</span>
                                                                            </div>
                                                                            <span className="text-[10px] font-black text-indigo-500 glass px-3 py-1.5 rounded-lg ring-1 ring-indigo-200/50 shadow-sm">
                                                                                {containers.length} FCL
                                                                            </span>
                                                                        </button>
                                                                        
                                                                        {expandedBLs[bl] && (
                                                                            <div className="p-5 glass border-t border-indigo-100 shadow-inner">
                                                                                <div className="flex flex-wrap gap-3">
                                                                                    {containers.map((container, i) => (
                                                                                        <span key={i} className="px-4 py-2 glass-dark text-slate-700 text-xs font-mono font-bold rounded-xl ring-1 ring-white/40 shadow-sm hover:scale-105 transition-transform cursor-default">
                                                                                            {container}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                        <>
                                        <table className="min-w-full divide-y divide-white/10">
                                            <thead className="glass-dark sticky top-0 z-10 border-b border-white/20">
                                                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-80 backdrop-blur-3xl">
                                                    <th className="px-8 py-5 text-left">Unit Identifier</th>
                                                    <th className="px-6 py-5 text-left">BL Document</th>
                                                    <th className="px-6 py-5 text-left">Vessel Designation</th>
                                                    <th className="px-6 py-5 text-left">Carrier</th>
                                                    <th className="px-6 py-5 text-left min-w-[150px]">Active Status</th>
                                                    
                                                    {isDemurrageView ? (
                                                        <>
                                                            <th className="px-6 py-5 text-left">Free Time Limit</th>
                                                            <th className="px-6 py-5 text-left">Actual Return</th>
                                                            <th className="px-8 py-5 text-right">Exposure (USD)</th>
                                                        </>
                                                    ) : isClearanceView ? (
                                                        <>
                                                            <th className="px-6 py-5 text-left">ATA Terminal</th>
                                                            <th className="px-6 py-5 text-left">Customs Ch.</th>
                                                            <th className="px-8 py-5 text-right">Fiscal Date (NF)</th>
                                                        </>
                                                    ) : isCargoReadyView || isAtaView || isInventoryView ? (
                                                        <>
                                                            <th className="px-6 py-5 text-left">ATA Terminal</th>
                                                            <th className="px-6 py-5 text-left">Cargo Ready</th>
                                                            <th className="px-8 py-5 text-right">Est. Deployment</th>
                                                        </>
                                                    ) : isProjectedView ? (
                                                        <>
                                                            <th className="px-6 py-5 text-left">Flux Entry</th>
                                                            <th className="px-6 py-5 text-left">Cycle Duration</th>
                                                            <th className="px-8 py-5 text-right">Projected Impact</th>
                                                        </>
                                                    ) : isPipelineView ? (
                                                        <>
                                                            <th className="px-6 py-5 text-left">ETA Terminal</th>
                                                            <th className="px-6 py-5 text-left">Warehouse Cluster</th>
                                                            <th className="px-8 py-5 text-right">Current Layer</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th className="px-6 py-5 text-left">Target Estimation</th>
                                                            <th className="px-6 py-5 text-left">Actual Fulfillment</th>
                                                            <th className="px-8 py-5 text-right">Delta Shift</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10 text-slate-800">
                                                {tableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((s, idx) => {
                                                    const isDelivered = !!s.deliveryByd;
                                                    return (
                                                        <tr key={idx} className={`hover:bg-white/40 transition-all group ${!isDelivered ? 'bg-amber-500/5' : ''}`}>
                                                            <td className="px-8 py-5 text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{s.containerNumber}</td>
                                                            <td className="px-6 py-5 text-[11px] font-black text-indigo-600 tracking-tight">{s.billOfLading || 'N/A'}</td>
                                                            <td className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-tight">{s.vesselName || 'N/A'}</td>
                                                            <td className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase">{s.carrier}</td>
                                                            <td className="px-6 py-5">
                                                                {getStatusBadge(s)}
                                                            </td>
                                                            
                                                            {isDemurrageView ? (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">{isValidDate(s.freeTimeDate) ? s.freeTimeDate.toLocaleDateString() : 'N/A'}</td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800">{isValidDate(s.actualDepotReturnDate) ? s.actualDepotReturnDate.toLocaleDateString() : 'Pending'}</td>
                                                                    <td className="px-8 py-5 text-sm font-black text-right text-red-600">
                                                                        {(s.demurrageCost || 0) > 0 ? currencyFormatter.format(s.demurrageCost) : '-'}
                                                                    </td>
                                                                </>
                                                            ) : isClearanceView ? (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">{isValidDate(s.ata) ? s.ata.toLocaleDateString() : '-'}</td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800">{isValidDate(s.channelDate) ? s.channelDate.toLocaleDateString() : '-'}</td>
                                                                    <td className="px-8 py-5 text-[11px] font-black text-right text-slate-900">
                                                                        {isValidDate(s.dateNF) ? s.dateNF.toLocaleDateString() : 'In Process'}
                                                                    </td>
                                                                </>
                                                            ) : isCargoReadyView || isAtaView || isInventoryView ? (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">{isValidDate(s.ata) ? s.ata.toLocaleDateString() : '-'}</td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800">{isValidDate(s.cargoReadyDate) ? s.cargoReadyDate.toLocaleDateString() : '-'}</td>
                                                                    <td className="px-8 py-5 text-[11px] font-black text-right text-slate-900">
                                                                        {isValidDate(s.estimatedDelivery) ? s.estimatedDelivery.toLocaleDateString() : '-'}
                                                                    </td>
                                                                </>
                                                            ) : isProjectedView ? (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">
                                                                        {isValidDate(s.cargoReadyDate || s.ata) ? (s.cargoReadyDate || s.ata)!.toLocaleDateString() : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800">
                                                                        {s.currentAge}
                                                                    </td>
                                                                    <td className="px-8 py-5 text-sm font-black text-right text-orange-600">
                                                                        {s.projectedCost}
                                                                    </td>
                                                                </>
                                                            ) : isPipelineView ? (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">{isValidDate(s.ata || s.estimatedDelivery) ? (s.ata || s.estimatedDelivery)!.toLocaleDateString('pt-BR') : '-'}</td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800 tracking-tight uppercase">{s.bondedWarehouse}</td>
                                                                    <td className="px-8 py-5 text-[11px] font-black text-right uppercase">
                                                                        {isValidDate(s.deliveryByd) ? (
                                                                            <span className="text-emerald-600">Dispatched</span>
                                                                        ) : (
                                                                            <span className="text-amber-600">In Flux</span>
                                                                        )}
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-6 py-5 text-[11px] font-medium text-slate-400">{isValidDate(s.estimatedDelivery) ? s.estimatedDelivery.toLocaleDateString() : '-'}</td>
                                                                    <td className="px-6 py-5 text-[11px] font-black text-slate-800">{isValidDate(s.deliveryByd) ? s.deliveryByd.toLocaleDateString() : '-'}</td>
                                                                    <td className={`px-8 py-5 text-sm font-black text-right ${ (s.clientDeliveryVariance || 0) > 0 ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}`}>
                                                                        {s.clientDeliveryVariance !== null ? (s.clientDeliveryVariance > 0 ? `+${s.clientDeliveryVariance}` : s.clientDeliveryVariance) : '-'}
                                                                    </td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                                {tableData.length === 0 && (
                                                    <tr>
                                                        <td colSpan={8} className="px-8 py-48 text-center bg-white/5">
                                                            <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-700">
                                                                <div className="w-20 h-20 rounded-full glass flex items-center justify-center text-slate-200">
                                                                    <span className="material-icons text-4xl">
                                                                        {showOnlyPending ? 'task_alt' : (showOnlyPicked ? 'hourglass_empty' : 'inventory_2')}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-2xl font-black text-slate-300 uppercase tracking-tighter">
                                                                        {showOnlyPending ? 'Zero Latency Detected' : (showOnlyPicked ? 'No Picked Containers Yet' : 'Strategic Data Void')}
                                                                    </h4>
                                                                    <p className="text-slate-400 text-[11px] mt-2 font-bold uppercase tracking-widest opacity-60">
                                                                        {showOnlyPending ? 'Everything has been delivered in this segment.' : (showOnlyPicked ? 'Awaiting operational fulfillment for this layer.' : 'No data records match current filters.')}
                                                                    </p>
                                                                    {(showOnlyPending || showOnlyPicked) && (
                                                                        <button 
                                                                            onClick={() => {
                                                                                setShowOnlyPending(false);
                                                                                setShowOnlyPicked(false);
                                                                            }}
                                                                            className="mt-8 px-10 py-3 glass-dark text-slate-800 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/80 transition-all shadow-glass ring-1 ring-white/50"
                                                                        >
                                                                            Full Stack Visualization
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        {Math.ceil(tableData.length / itemsPerPage) > 1 && (
                                            <div className="px-10 py-5 glass-dark flex items-center justify-between border-t border-white/20">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-80">
                                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, tableData.length)} of {tableData.length} records
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="px-4 py-2 glass rounded-xl text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/80 transition-all font-black"
                                                    >
                                                        Prev
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(tableData.length / itemsPerPage), p + 1))}
                                                        disabled={currentPage === Math.ceil(tableData.length / itemsPerPage)}
                                                        className="px-4 py-2 glass rounded-xl text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/80 transition-all font-black"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="glass-dark px-12 py-8 sm:flex sm:flex-row-reverse border-t border-white/20">
                        <button 
                            type="button" 
                            className="w-full inline-flex justify-center rounded-[2rem] shadow-xl px-12 py-4 bg-indigo-600 text-xs font-black uppercase tracking-[0.3em] text-white hover:bg-indigo-700 focus:outline-none transition-all sm:ml-4 sm:w-auto shadow-indigo-200/50"
                            onClick={onClose}
                        >
                            Terminate Analysis
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChartDetailsModal;