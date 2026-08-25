import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import { CargoVolumeAnnualChart } from './CargoVolumeAnnualChart';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend,
    LineChart,
    Line,
    ReferenceLine
} from 'recharts';
import { Anchor, BarChart3, TrendingUp, Compass, Settings, AlertCircle, Filter, Calendar } from 'lucide-react';

interface PortYardOperationStatusProps {
    shipments: Shipment[];
    onMonthClick?: (monthData: { monthIndex: number; monthName: string; year: string; shipments: Shipment[] }) => void;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

export const PortYardOperationStatus: React.FC<PortYardOperationStatusProps> = ({ 
    shipments = [],
    onMonthClick
}) => {
    // 0. Set up Year, Month, Day Filter States
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedDay, setSelectedDay] = useState<string>('All');

    const MONTH_NAMES = useMemo(() => [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ], []);

    // Extract unique Years, Months, and Days dynamically from all shipments based on ETA/ATA of Vessel
    const filterOptions = useMemo(() => {
        const years = new Set<string>();
        const months = new Set<string>();
        const days = new Set<string>();

        shipments.forEach(s => {
            if (!s) return;
            const etaDate = s.ata || s.estimatedDelivery;
            if (etaDate && isValidDate(etaDate)) {
                years.add(String(etaDate.getFullYear()));
                months.add(String(etaDate.getMonth() + 1).padStart(2, '0'));
                days.add(String(etaDate.getDate()).padStart(2, '0'));
            }
        });

        return {
            years: Array.from(years).sort(),
            months: Array.from(months).sort(),
            days: Array.from(days).sort()
        };
    }, [shipments]);

    // Apply Year, Month, Day filter to all dataset operations
    const filteredShipments = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        return shipments.filter(s => {
            if (!s) return false;
            const etaDate = s.ata || s.estimatedDelivery;
            if (!etaDate || !isValidDate(etaDate)) {
                return selectedYear === 'All' && selectedMonth === 'All' && selectedDay === 'All';
            }
            
            const year = String(etaDate.getFullYear());
            const month = String(etaDate.getMonth() + 1).padStart(2, '0');
            const day = String(etaDate.getDate()).padStart(2, '0');

            if (selectedYear !== 'All' && year !== selectedYear) return false;
            if (selectedMonth !== 'All' && month !== selectedMonth) return false;
            if (selectedDay !== 'All' && day !== selectedDay) return false;

            return true;
        });
    }, [shipments, selectedYear, selectedMonth, selectedDay]);

    // 1. Calculate Daily Vessel Arrival Volume (based on vessel ETA, matching broker team data)
    const dailyPortArrivals = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return [];
        const counts: Record<string, number> = {};
        
        filteredShipments.forEach(s => {
            if (s) {
                const etaDate = s.ata || s.estimatedDelivery;
                if (etaDate && isValidDate(etaDate)) {
                    const yyyy = etaDate.getFullYear();
                    const mm = String(etaDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(etaDate.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`; // Year, Month, Day format (YYYY-MM-DD)
                    counts[dateStr] = (counts[dateStr] || 0) + 1;
                }
            }
        });
        
        return Object.entries(counts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-15); // Show latest 15 days of vessel arrivals
    }, [filteredShipments]);

    // 2. Real Daily Operation Delivery Trend (based on deliveryByd, matching dashboard)
    const dailyDeliveryTrend = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return [];
        const counts: Record<string, number> = {};
        
        filteredShipments.forEach(s => {
            if (s && s.deliveryByd && isValidDate(s.deliveryByd)) {
                const yyyy = s.deliveryByd.getFullYear();
                const mm = String(s.deliveryByd.getMonth() + 1).padStart(2, '0');
                const dd = String(s.deliveryByd.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`; // Year, Month, Day format (YYYY-MM-DD)
                counts[dateStr] = (counts[dateStr] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-15); // Show latest 15 days of deliveries
    }, [filteredShipments]);

    // Average delivered quantity of containers per day (for KPI indicator)
    const avgDeliveredCount = useMemo(() => {
        if (!dailyDeliveryTrend || dailyDeliveryTrend.length === 0) return 0;
        const total = dailyDeliveryTrend.reduce((acc, curr) => acc + (curr.count || 0), 0);
        return Math.round(total / dailyDeliveryTrend.length);
    }, [dailyDeliveryTrend]);

    // 3. Port Operation Distribution - Bonded vs General Warehouses used under current filter array
    const bondedDist = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return [];
        const counts: Record<string, number> = {};
        
        filteredShipments.forEach(s => {
            if (!s) return;
            const wh = s.bondedWarehouse || 'Cleared/Unassigned';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        
        const colors = ['#2563EB', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#64748B'];
        return Object.entries(counts)
            .map(([name, value], idx) => ({
                name,
                value,
                fill: colors[idx % colors.length]
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [filteredShipments]);

    const generalDist = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return [];
        const counts: Record<string, number> = {};
        
        filteredShipments.forEach(s => {
            if (!s) return;
            const wh = s.generalWarehouse || 'In Transit/Unassigned';
            counts[wh] = (counts[wh] || 0) + 1;
        });
        
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];
        return Object.entries(counts)
            .map(([name, value], idx) => ({
                name,
                value,
                fill: colors[idx % colors.length]
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [filteredShipments]);

    // Active port dwell counts (arrived but not delivered yet)
    const activePortDwell = useMemo(() => {
        if (!Array.isArray(filteredShipments)) return 0;
        return filteredShipments.filter(s => s && s.ata && isValidDate(s.ata) && !s.deliveryByd).length;
    }, [filteredShipments]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 pb-20 w-full"
        >
            {/* Broker Synchronization Filter Bar */}
            <div className="glass p-6 rounded-[2rem] border border-slate-200/80 bg-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Broker Synchronization Filters</h3>
                        <p className="text-[11px] text-slate-400 font-bold">Synchronize Port & Yard statistics with custom Year, Month, or Day selections</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Year Selector */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Year</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                setSelectedDay('All'); // reset day to avoid invalid combos
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <option value="All">All Years</option>
                            {filterOptions.years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selector */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Month</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => {
                                setSelectedMonth(e.target.value);
                                setSelectedDay('All'); // reset day to avoid invalid combos
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <option value="All">All Months</option>
                            {filterOptions.months.map(m => {
                                const idx = parseInt(m, 10) - 1;
                                const monthName = MONTH_NAMES[idx] || `Month ${m}`;
                                return <option key={m} value={m}>{m} - {monthName}</option>;
                            })}
                        </select>
                    </div>

                    {/* Day Selector */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Day</span>
                        <select
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <option value="All">All Days</option>
                            {filterOptions.days.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear Filter Button */}
                    {(selectedYear !== 'All' || selectedMonth !== 'All' || selectedDay !== 'All') && (
                        <button
                            onClick={() => {
                                setSelectedYear('All');
                                setSelectedMonth('All');
                                setSelectedDay('All');
                            }}
                            className="mt-4 lg:mt-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Header Bento Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-2 glass p-10 rounded-[3rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-50/50 to-transparent">
                  <div className="absolute -right-10 -bottom-10 opacity-5">
                     <span className="material-icons text-[15rem] font-black">anchor</span>
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                           <Anchor className="w-3.5 h-3.5 animate-spin" /> Port & Yard Operations
                        </span>
                     </div>
                     <h2 className="text-4xl font-display font-black text-slate-850 tracking-tight leading-tight">Terminal Capacity Flow</h2>
                     <p className="text-slate-500 font-bold mt-4 tracking-wide text-xs">
                        Precise tracking of arrived vessel volumes, daily gateway clearance performance, and distributed warehouse loads.
                     </p>
                  </div>
               </div>

               {/* Real daily average delivered KPI / Vessel Arrival Volume */}
               <div className="glass p-8 rounded-[3rem] flex flex-col justify-between bg-slate-900 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/25">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <span className="material-icons text-5xl">sailing</span>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-display">Vessel Arrival Volume</p>
                     <p className="text-[9px] text-indigo-305 uppercase font-semibold">Filtered Container Count</p>
                  </div>
                  <div className="mt-4">
                     <div className="text-5xl font-display font-black tracking-tight leading-none text-emerald-400">
                        {filteredShipments.length} <span className="text-xs text-white uppercase font-sans">CNTR</span>
                     </div>
                     <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                        Based on current Year, Month, Day selections
                     </p>
                  </div>
               </div>

               {/* Active dwell units at port gate */}
               <div className="glass p-8 rounded-[3rem] flex flex-col justify-between bg-white border border-slate-200 relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <span className="material-icons text-5xl text-indigo-505">sailing</span>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-display">Active Yard Dwell</p>
                     <p className="text-[9px] text-slate-450 uppercase font-semibold">Arrived Undelivered Status</p>
                  </div>
                  <div className="mt-4">
                     <div className="text-5xl font-display font-black tracking-tight leading-none text-slate-800">
                        {activePortDwell} <span className="text-xs text-slate-400 uppercase font-sans">CNTR</span>
                     </div>
                     <p className="text-[9.5px] text-indigo-600 mt-2 font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> High demurrage detention risk
                     </p>
                  </div>
               </div>
            </div>

            {/* Annual Cargo Volume by Bonded Area (ETA Arrivals) */}
            <CargoVolumeAnnualChart shipments={shipments} onMonthClick={onMonthClick} />

            {/* Daily Port Operation Volume */}
            <div className="glass p-10 rounded-[3.5rem] border-none shadow-glass ring-1 ring-white/40 bg-white">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-display font-black text-slate-850 tracking-tight flex items-center gap-2">
                           <BarChart3 className="w-6 h-6 text-indigo-600" />
                           Daily Vessel Arrival Volume (ETA of Vessel)
                        </h3>
                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">
                           Scheduled and actual vessel arrivals by ETA / ATA date (Year-Month-Day format)
                        </p>
                    </div>
                </div>

                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyPortArrivals} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10, fontWeight: 750, fill: '#64748b' }} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <YAxis tick={{ fontSize: 10, fontWeight: 750, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" name="Expected/Arrived (ETA/ATA)" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={32}>
                                {dailyPortArrivals.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill="#3B82F6" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Port Operation Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bonded Distribution */}
                <div className="glass p-10 rounded-[3.5rem] border-none shadow-glass ring-1 ring-white/40 bg-white/70">
                    <div className="mb-6">
                        <h3 className="text-xl font-display font-black text-slate-850 tracking-tight">Port Operation Distribution (Bonded Sector)</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Operational breakdown across designated bonded warehouses</p>
                    </div>
                    <div className="h-[280px] w-full flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1 h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={bondedDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                                        {bondedDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto w-full md:w-48 custom-scrollbar text-[10px]">
                            {bondedDist.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                                    <span className="font-bold truncate text-slate-650" title={item.name}>{item.name}:</span>
                                    <span className="font-mono font-black text-slate-800 ml-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* General Warehouses Used Distribution */}
                <div className="glass p-10 rounded-[3.5rem] border-none shadow-glass ring-1 ring-white/40 bg-white/70">
                    <div className="mb-6">
                        <h3 className="text-xl font-display font-black text-slate-850 tracking-tight">Port Operation Distribution (General Sector)</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Operational breakdown across general depots deployed during month</p>
                    </div>
                    <div className="h-[280px] w-full flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1 h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={generalDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                                        {generalDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto w-full md:w-48 custom-scrollbar text-[10px]">
                            {generalDist.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                                    <span className="font-bold truncate text-slate-650" title={item.name}>{item.name}:</span>
                                    <span className="font-mono font-black text-slate-800 ml-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Operation Trend */}
            <div className="glass p-10 rounded-[3.5rem] border-none shadow-glass ring-1 ring-white/40 bg-white">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-display font-black text-slate-850 tracking-tight flex items-center gap-2">
                           <TrendingUp className="w-6 h-6 text-emerald-600" />
                           Daily Operation Trend (Deliveries)
                        </h3>
                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">
                           Standard daily distribution of delivered and cleared containers (Delivery BYD Column AI)
                        </p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyDeliveryTrend} margin={{ top: 15, right: 30, left: 10, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10, fontWeight: 750, fill: '#64748b' }} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <YAxis tick={{ fontSize: 10, fontWeight: 750, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', shadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '10px' }} />
                            <ReferenceLine y={150} stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Daily Goal: 150', fill: '#EF4444', fontSize: 10, fontWeight: 'bold', position: 'top' }} />
                            <ReferenceLine y={300} stroke="#4F46E5" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Challenge Goal: 300', fill: '#4F46E5', fontSize: 10, fontWeight: 'bold', position: 'top' }} />
                            <Line type="monotone" dataKey="count" name="Delivered Containers (Daily)" stroke="#10B981" strokeWidth={3} dot={{ r: 5, fill: '#10B981' }} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(PortYardOperationStatus);