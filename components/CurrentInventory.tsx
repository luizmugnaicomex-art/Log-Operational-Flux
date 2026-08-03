import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';
import { CheckCircle2, AlertTriangle, ShieldCheck, Database, FileText, ArrowRightLeft } from 'lucide-react';

interface CurrentInventoryProps {
    shipments: Shipment[];
}

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

export const CurrentInventory: React.FC<CurrentInventoryProps> = ({ shipments = [] }) => {
    // Inventory is only units that are NOT delivered.
    const activeInventory = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        return shipments.filter(s => s && !s.deliveryByd);
    }, [shipments]);

    // Group by General Warehouse (from System Excel upload)
    const generalWarehouseData = useMemo(() => {
        const counts: Record<string, number> = {};
        activeInventory.forEach(s => {
            if (!s) return;
            const wh = s.generalWarehouse || 'In Transit / At Port (Unassigned)';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [activeInventory]);

    // Group by Bonded Warehouse (from System Excel upload)
    const bondedWarehouseData = useMemo(() => {
        const counts: Record<string, number> = {};
        activeInventory.forEach(s => {
            if (!s) return;
            const wh = s.bondedWarehouse || 'Cleared / unassigned';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [activeInventory]);

    // State for manual storage inventory (loaded from localStorage)
    const [manualStorage, setManualStorage] = useState<StorageData>({
        bondedArea: [],
        warehouse: [],
        buffer: []
    });

    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchManualStorage = () => {
        const stored = localStorage.getItem('emptyContainersDataV3');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setManualStorage(prev => {
                    const strPrev = JSON.stringify(prev);
                    const strNew = JSON.stringify(parsed);
                    if (strPrev !== strNew) {
                        setLastUpdated(new Date().toLocaleTimeString());
                        return parsed;
                    }
                    return prev;
                });
            } catch (e) {
                console.error("Failed to parse stored manual containers data", e);
            }
        }
    };

    // Load from local storage on mount & establish a lightweight interval
    useEffect(() => {
        fetchManualStorage();
        const interval = setInterval(fetchManualStorage, 4000);
        return () => clearInterval(interval);
    }, []);

    // Aggregates for manual storage
    const manualBondedSum = useMemo(() => {
        if (!manualStorage?.bondedArea) return 0;
        return manualStorage.bondedArea.reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
    }, [manualStorage]);

    const manualGeneralSum = useMemo(() => {
        if (!manualStorage?.warehouse) return 0;
        return manualStorage.warehouse.reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
    }, [manualStorage]);

    const manualBufferSum = useMemo(() => {
        if (!manualStorage?.buffer) return 0;
        return manualStorage.buffer.reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
    }, [manualStorage]);

    const totalManualUnits = manualBondedSum + manualGeneralSum + manualBufferSum;

    // Aggregates for system excel
    const excelBondedSum = useMemo(() => {
        return activeInventory.filter(s => s && s.bondedWarehouse && !String(s.bondedWarehouse).toUpperCase().includes('CLEARED')).length;
    }, [activeInventory]);

    const excelGeneralSum = useMemo(() => {
        return activeInventory.filter(s => s && s.generalWarehouse && !String(s.generalWarehouse).toUpperCase().includes('TRANSIT')).length;
    }, [activeInventory]);

    // Cross check comparison map
    const crossCheckData = useMemo(() => {
        const matchResult: Array<{
            name: string;
            type: 'BONDED' | 'GENERAL' | 'BUFFER';
            excelCount: number;
            manualFull: number;
            manualEmpty: number;
            manualTotal: number;
            discrepancy: number;
            status: 'MATCHING' | 'DISCREPANCY';
        }> = [];

        const bondedAreaList = manualStorage?.bondedArea || [];
        const warehouseList = manualStorage?.warehouse || [];

        // 1. Gather Bonded
        bondedWarehouseData.forEach(item => {
            const upperName = (item.name || '').toUpperCase();
            if (upperName.includes('CLEARED') || upperName.includes('N/A')) return;
            
            const lowerItemName = item.name.toLowerCase();
            const manualMatch = bondedAreaList.find(loc => {
                const lowerLocName = (loc.name || '').toLowerCase();
                return lowerLocName.includes(lowerItemName) || lowerItemName.includes(lowerLocName);
            });

            const manualFull = manualMatch ? (manualMatch.fullCount || 0) : 0;
            const manualEmpty = manualMatch ? (manualMatch.emptyCount || 0) : 0;
            const manualTotal = manualFull + manualEmpty;
            const discrepancy = item.count - manualTotal;

            matchResult.push({
                name: item.name,
                type: 'BONDED',
                excelCount: item.count,
                manualFull,
                manualEmpty,
                manualTotal,
                discrepancy,
                status: discrepancy === 0 ? 'MATCHING' : 'DISCREPANCY'
            });
        });

        // 2. Gather General Warehouse
        generalWarehouseData.forEach(item => {
            const upperName = (item.name || '').toUpperCase();
            if (upperName.includes('TRANSIT') || upperName.includes('N/A') || upperName.includes('PORT')) return;

            const lowerItemName = item.name.toLowerCase();
            const manualMatch = warehouseList.find(loc => {
                const lowerLocName = (loc.name || '').toLowerCase();
                return lowerLocName.includes(lowerItemName) || lowerItemName.includes(lowerLocName);
            });

            const manualFull = manualMatch ? (manualMatch.fullCount || 0) : 0;
            const manualEmpty = manualMatch ? (manualMatch.emptyCount || 0) : 0;
            const manualTotal = manualFull + manualEmpty;
            const discrepancy = item.count - manualTotal;

            matchResult.push({
                name: item.name,
                type: 'GENERAL',
                excelCount: item.count,
                manualFull,
                manualEmpty,
                manualTotal,
                discrepancy,
                status: discrepancy === 0 ? 'MATCHING' : 'DISCREPANCY'
            });
        });

        // 3. Match any leftover manual rows that didn't appear in excel data
        bondedAreaList.forEach(loc => {
            const lowerLocName = (loc.name || '').toLowerCase();
            const alreadyMatched = matchResult.some(r => r.name.toLowerCase().includes(lowerLocName) || lowerLocName.includes(r.name.toLowerCase()));
            if (!alreadyMatched) {
                const total = (loc.fullCount || 0) + (loc.emptyCount || 0);
                matchResult.push({
                    name: loc.name,
                    type: 'BONDED',
                    excelCount: 0,
                    manualFull: loc.fullCount || 0,
                    manualEmpty: loc.emptyCount || 0,
                    manualTotal: total,
                    discrepancy: -total,
                    status: -total === 0 ? 'MATCHING' : 'DISCREPANCY'
                });
            }
        });

        warehouseList.forEach(loc => {
            const lowerLocName = (loc.name || '').toLowerCase();
            const alreadyMatched = matchResult.some(r => r.name.toLowerCase().includes(lowerLocName) || lowerLocName.includes(r.name.toLowerCase()));
            if (!alreadyMatched) {
                const total = (loc.fullCount || 0) + (loc.emptyCount || 0);
                matchResult.push({
                    name: loc.name,
                    type: 'GENERAL',
                    excelCount: 0,
                    manualFull: loc.fullCount || 0,
                    manualEmpty: loc.emptyCount || 0,
                    manualTotal: total,
                    discrepancy: -total,
                    status: -total === 0 ? 'MATCHING' : 'DISCREPANCY'
                });
            }
        });

        return matchResult;
    }, [bondedWarehouseData, generalWarehouseData, manualStorage]);

    const totalDiscrepanciesCount = useMemo(() => {
        return crossCheckData.filter(r => r.status === 'DISCREPANCY').length;
    }, [crossCheckData]);

    const totalContainers = activeInventory.length;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 pb-20 w-full"
        >
            {/* Header Bento Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-2 glass p-10 rounded-[3rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-50/50 to-transparent">
                  <div className="absolute -right-10 -bottom-10 opacity-5">
                     <span className="material-icons text-[15rem] font-black w-24 h-24">warehouse</span>
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                           <ShieldCheck className="w-3.5 h-3.5" /> CERTIFIED CROSS-CHECK
                        </span>
                     </div>
                     <h2 className="text-4xl font-display font-black text-slate-850 tracking-tight leading-tight">Stock & Storage Audit</h2>
                     <p className="text-slate-500 font-bold mt-4 tracking-wide text-xs">
                        Comparison of system-calculated FCL inventory with physical storage declarations. Useful for supplier declarations & procurement verification.
                     </p>
                  </div>
               </div>

               {/* System Excel Totals */}
               <div className="glass p-8 rounded-[3rem] flex flex-col justify-between bg-slate-900 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/25">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <span className="material-icons text-5xl">database</span>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-display">System Grid Inventory</p>
                     <p className="text-[9px] text-indigo-305 uppercase font-semibold">Active Undelivered Units</p>
                  </div>
                  <div className="mt-4">
                     <div className="text-5xl font-display font-black tracking-tight leading-none">
                        {totalContainers}
                     </div>
                     <div className="flex gap-4 mt-3 text-[10px] font-bold text-slate-400">
                        <span>Bonded: <strong className="text-white font-mono">{excelBondedSum}</strong></span>
                        <span>General: <strong className="text-white font-mono">{excelGeneralSum}</strong></span>
                     </div>
                  </div>
               </div>

               {/* Manual Declarations Totals */}
               <div className="glass p-8 rounded-[3rem] flex flex-col justify-between bg-white border border-slate-200 relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <span className="material-icons text-5xl text-indigo-500">inventory_2</span>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-display">Manual Yards Storage</p>
                     <p className="text-[9px] text-slate-450 uppercase font-semibold">Self-reported Declaration</p>
                  </div>
                  <div className="mt-4">
                     <div className="text-5xl font-display font-black tracking-tight leading-none text-slate-800">
                        {totalManualUnits}
                     </div>
                     <div className="flex gap-4 mt-3 text-[10px] font-bold text-slate-500">
                        <span>Full: <strong className="text-slate-800 font-mono">{((manualStorage?.bondedArea || []).reduce((a,c)=>a+(c.fullCount||0),0) + (manualStorage?.warehouse || []).reduce((a,c)=>a+(c.fullCount||0),0))}</strong></span>
                        <span>Empty: <strong className="text-slate-800 font-mono">{((manualStorage?.bondedArea || []).reduce((a,c)=>a+(c.emptyCount||0),0) + (manualStorage?.warehouse || []).reduce((a,c)=>a+(c.emptyCount||0),0))}</strong></span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Compliance alert warning */}
            {totalDiscrepanciesCount > 0 ? (
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200/60 rounded-3xl p-6 text-amber-900 shadow-sm relative overflow-hidden">
                    <div className="bg-amber-100 p-3 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="font-extrabold text-sm uppercase tracking-wider text-amber-800">Operational Reconciliation Required ({totalDiscrepanciesCount} Discrepancies)</h4>
                        <p className="text-xs text-amber-700 font-medium mt-1">
                            Discrepancies detected between manual yard declarations and Excel uploaded data. Cross-reference individual terminal listings below for procurement report audits.
                        </p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-450 bg-white border border-amber-200 px-3 py-1.5 rounded-full ml-auto">
                        REFRESH ACTIVE
                    </span>
                </div>
            ) : (
                <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200/60 rounded-3xl p-6 text-emerald-900 shadow-sm">
                    <div className="bg-emerald-100 p-3 rounded-2xl">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-extrabold text-sm uppercase tracking-wider text-emerald-800">Perfect Reconciliation Verified</h4>
                        <p className="text-xs text-emerald-700 font-medium mt-1">
                            All manual physical declarations exactly match the current active Excel upload dataset. Ready for procurement payment audits.
                        </p>
                    </div>
                </div>
            )}

            {/* Double Reconciliation Comparison Grid Table */}
            <div className="glass rounded-[3rem] ring-1 ring-white/50 shadow-glass overflow-hidden">
                <div className="p-8 border-b border-rose-100 bg-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-display font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                            Double Cross-Checking Ledger
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 font-display">System dataset vs Manual warehouse declarations</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white text-slate-500 py-1.5 px-3 rounded-xl border border-slate-100 uppercase">
                        Sync time: {lastUpdated || 'Loading'}
                    </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 border-b border-slate-200">
                                <th className="px-10 py-5">Terminal Facility</th>
                                <th className="px-8 py-5">Category / Sector</th>
                                <th className="px-8 py-5 text-right font-black">System Excel (A)</th>
                                <th className="px-8 py-5 text-right font-black">Manual Full (B.1)</th>
                                <th className="px-8 py-5 text-right font-black">Manual Empty (B.2)</th>
                                <th className="px-8 py-5 text-right font-black">Manual Total (B)</th>
                                <th className="px-8 py-5 text-right font-black">Variance (A - B)</th>
                                <th className="px-8 py-5 text-center">Status Badge</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {crossCheckData.length > 0 ? (
                                crossCheckData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-10 py-4.5">
                                            <span className="text-sm font-display font-black text-slate-805 tracking-tight group-hover:text-indigo-600">
                                                {row.name}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4.5">
                                            <span className={`inline-block text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${row.type === 'BONDED' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                {row.type} sector
                                            </span>
                                        </td>
                                        <td className="px-8 py-4.5 text-right font-mono font-bold text-sm text-slate-800">
                                            {row.excelCount}
                                        </td>
                                        <td className="px-8 py-4.5 text-right font-mono text-xs text-slate-500">
                                            {row.manualFull}
                                        </td>
                                        <td className="px-8 py-4.5 text-right font-mono text-xs text-slate-500">
                                            {row.manualEmpty}
                                        </td>
                                        <td className="px-8 py-4.5 text-right font-mono font-bold text-sm text-slate-800 bg-slate-50/40">
                                            {row.manualTotal}
                                        </td>
                                        <td className={`px-8 py-4.5 text-right font-mono font-black text-sm ${row.discrepancy === 0 ? 'text-emerald-600' : row.discrepancy > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {row.discrepancy > 0 ? `+${row.discrepancy}` : row.discrepancy}
                                        </td>
                                        <td className="px-8 py-4.5 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${row.status === 'MATCHING' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="text-center py-10">
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">No active sectors loaded in matching register</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sub-Charts Section for active distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bonded Warehouse Spread */}
                <div className="glass p-10 rounded-[3rem] ring-1 ring-white/40 shadow-glass flex flex-col">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">Bonded Warehouses</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 font-display">System Active Load by Bonded Warehouse</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                            <span className="material-icons text-amber-500 text-xl">account_balance</span>
                        </div>
                    </div>
                    <div className="flex-1 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bondedWarehouseData} layout="vertical" margin={{ left: 10, right: 30, top: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} vertical={true} />
                                <XAxis type="number" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                                    width={140}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 900 }}
                                    labelStyle={{ color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}
                                />
                                <Bar dataKey="count" name="Containers" radius={[0, 20, 20, 0]} barSize={24}>
                                    {bondedWarehouseData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={'#f59e0b'} />
                                    ))}
                                    <LabelList dataKey="count" position="right" fontSize={11} fill="#1e293b" fontWeight={900} offset={10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* General Warehouse Spread */}
                <div className="glass p-10 rounded-[3rem] ring-1 ring-white/40 shadow-glass flex flex-col">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">General Logistics</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 font-display">System Active Load by General Warehouse</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                            <span className="material-icons text-indigo-500 text-xl">corporate_fare</span>
                        </div>
                    </div>
                    <div className="flex-1 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={generalWarehouseData} layout="vertical" margin={{ left: 10, right: 30, top: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} vertical={true} />
                                <XAxis type="number" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                                    width={140}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 900 }}
                                    labelStyle={{ color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}
                                />
                                <Bar dataKey="count" name="Containers" radius={[0, 20, 20, 0]} barSize={24}>
                                    {generalWarehouseData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={'#4f46e5'} />
                                    ))}
                                    <LabelList dataKey="count" position="right" fontSize={11} fill="#1e293b" fontWeight={900} offset={10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Table layout register */}
            <div className="glass rounded-[3rem] ring-1 ring-white/50 shadow-glass overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-display font-black text-slate-850 tracking-tight">Detailed Active Register</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 font-display">Active Container Registry (Not Delivered Yet)</p>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1050px]">
                        <thead>
                            <tr className="bg-slate-900/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                                <th className="px-10 py-5">Container ID</th>
                                <th className="px-8 py-5 text-center">Process Number</th>
                                <th className="px-8 py-5">Is Bonded Warehouse Assigned?</th>
                                <th className="px-8 py-5">General Warehouse Assigned?</th>
                                <th className="px-8 py-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeInventory.slice(0, 100).map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-10 py-4.5">
                                        <span className="text-sm font-display font-black text-slate-800 tracking-tighter">
                                            {item.containerNumber}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4.5 text-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">
                                            {item.processNumber || item.lotNumber || '-'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4.5">
                                        <span className="text-xs font-bold text-slate-650">
                                            {item.bondedWarehouse || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4.5">
                                        <span className="text-xs font-bold text-slate-650">
                                            {item.generalWarehouse || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4.5 text-center">
                                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                            {item.statusComex || 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {activeInventory.length > 100 && (
                        <div className="p-6 text-center bg-slate-50 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400 italic">Showing 100 of {activeInventory.length} units in the active registry view...</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};