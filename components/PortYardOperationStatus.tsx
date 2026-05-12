import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Shipment, PortYardDashboardData } from '../types';
import { calculatePortYardOperationData } from '../utils/dataProcessor';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';

interface PortYardOperationStatusProps {
    shipments: Shipment[];
}

const ChartContainer: React.FC<{
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    height?: number;
}> = ({ title, subtitle, children, height = 300 }) => (
    <div className="glass p-8 rounded-[2.5rem] border-none shadow-glass transition-all duration-300 ring-1 ring-white/40 hover:bg-white/50">
        <div className="mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.25em]">{title}</h3>
            {subtitle && <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest opacity-80">{subtitle}</div>}
        </div>
        <div className="chart-wrapper rounded-2xl overflow-hidden" style={{ width: '100%', height: height }}>
            <ResponsiveContainer width="100%" height={height}>
                {children as React.ReactElement}
            </ResponsiveContainer>
        </div>
    </div>
);

const PortYardOperationStatus: React.FC<PortYardOperationStatusProps> = ({ shipments }) => {
    const data = useMemo<PortYardDashboardData>(() => {
        return calculatePortYardOperationData(shipments);
    }, [shipments]);

    // Calculate derived metrics
    const totalYardOccupied = useMemo(() => data.yardSlotData.reduce((acc, y) => acc + y.Occupied, 0), [data.yardSlotData]);
    const totalYardCapacity = useMemo(() => data.yardSlotData.reduce((acc, y) => acc + y.Capacity, 0), [data.yardSlotData]);
    const yardOccupancy = useMemo(() => totalYardCapacity > 0 ? ((totalYardOccupied / totalYardCapacity) * 100).toFixed(0) : 0, [totalYardOccupied, totalYardCapacity]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-10"
        >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass p-6 rounded-[2.5rem] ring-1 ring-white/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Received</p>
                    <p className="text-3xl font-display font-black text-slate-800 mt-2">{data.portOperationData[0]?.value || 0}</p>
                </div>
                <div className="glass p-6 rounded-[2.5rem] ring-1 ring-white/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Yard Occupancy</p>
                    <p className="text-3xl font-display font-black text-slate-800 mt-2">{yardOccupancy}%</p>
                </div>
                <div className="glass p-6 rounded-[2.5rem] ring-1 ring-white/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Released</p>
                    <p className="text-3xl font-display font-black text-slate-800 mt-2">{data.portOperationData[1]?.value || 0}</p>
                </div>
                <div className="glass p-6 rounded-[2.5rem] ring-1 ring-white/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Movements</p>
                    <p className="text-3xl font-display font-black text-slate-800 mt-2">{data.dailyTrendData.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartContainer title="Yard Inventory Breakdown" subtitle="By Terminal">
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.yardSlotData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                            <Tooltip />
                            <Bar dataKey="Occupied" fill="#2563EB" radius={[6, 6, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Daily Operation Trend" subtitle="Operations / Day">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.dailyTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                            <Tooltip />
                            <Bar dataKey="Total" fill="#10B981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
        </motion.div>
    );
};

export default React.memo(PortYardOperationStatus);
