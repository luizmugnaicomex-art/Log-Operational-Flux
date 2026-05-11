import React, { useMemo } from 'react';
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

interface CurrentInventoryProps {
    shipments: Shipment[];
}

export const CurrentInventory: React.FC<CurrentInventoryProps> = ({ shipments }) => {
    // Inventory is only units that are NOT delivered.
    // The user mentioned "taking out the delivered goods"
    const activeInventory = useMemo(() => shipments.filter(s => !s.deliveryByd), [shipments]);

    // Group by General Warehouse
    const generalWarehouseData = useMemo(() => {
        const counts: Record<string, number> = {};
        activeInventory.forEach(s => {
            const wh = s.generalWarehouse || 'In Transit / At Port (No General Warehouse)';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [activeInventory]);

    // Group by Bonded Warehouse
    const bondedWarehouseData = useMemo(() => {
        const counts: Record<string, number> = {};
        activeInventory.forEach(s => {
            const wh = s.bondedWarehouse || 'Cleared / Other';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [activeInventory]);

    const totalContainers = activeInventory.length;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 pb-20"
        >
            {/* Header Bento Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 glass p-12 rounded-[3.5rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-50/50 to-transparent">
                  <div className="absolute -right-10 -bottom-10 opacity-5">
                     <span className="material-icons text-[15rem] font-black">warehouse</span>
                  </div>
                  <div className="relative z-10">
                     <h2 className="text-5xl font-display font-black text-slate-800 tracking-[-0.06em]">Current <span className="text-indigo-600">Stock</span> Inventory</h2>
                     <p className="text-slate-400 font-bold mt-6 tracking-widest text-[11px] uppercase opacity-60 flex items-center gap-2 font-display">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                        Real-Time Depot Units (Delivered Goods Filtered)
                     </p>
                  </div>
               </div>
               <div className="glass h-full p-10 rounded-[3.5rem] flex flex-col justify-center bg-slate-900 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/20">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <span className="material-icons text-6xl">inventory_2</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 font-display">Total Stock Units</p>
                  <div className="text-6xl font-display font-black tracking-tighter">
                     {totalContainers}
                  </div>
                  <p className="text-xs font-bold text-indigo-400 mt-4 uppercase tracking-widest">Active FCL Units</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bonded Warehouse Spread */}
                <div className="glass p-10 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass flex flex-col">
                    <div className="mb-10 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">Bonded Sector</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Fiscal Warehouse Load</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                            <span className="material-icons text-amber-500 text-xl">account_balance</span>
                        </div>
                    </div>
                    <div className="flex-1 h-[400px]">
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
                <div className="glass p-10 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass flex flex-col">
                    <div className="mb-10 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">General Logistics Sector</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Secondary Depot Distribution</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                            <span className="material-icons text-indigo-500 text-xl">corporate_fare</span>
                        </div>
                    </div>
                    <div className="flex-1 h-[400px]">
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

            <div className="glass rounded-[4rem] ring-1 ring-white/50 shadow-glass overflow-hidden">
                <div className="p-12 border-b border-slate-100 flex items-center justify-between">
                   <div>
                       <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">Active Stock Register</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Filtered Registry (Excluding Delivered Units)</p>
                   </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-900/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-12 py-8 font-black">Container ID</th>
                                <th className="px-8 py-8 font-black text-center">Process Number</th>
                                <th className="px-8 py-8 font-black">Bonded Sector</th>
                                <th className="px-8 py-8 font-black">General Logistics</th>
                                <th className="px-8 py-8 font-black text-center">Execution Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeInventory.slice(0, 100).map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-12 py-6">
                                        <span className="text-sm font-display font-black text-slate-800 tracking-tighter">
                                            {item.containerNumber}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">
                                            {item.processNumber || item.lotNumber || '-'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-xs font-bold text-slate-500">
                                            {item.bondedWarehouse || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-xs font-bold text-slate-500">
                                            {item.generalWarehouse || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
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
                            <span className="text-xs font-bold text-slate-400 italic">Showing 100 of {activeInventory.length} units in the registry view...</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
