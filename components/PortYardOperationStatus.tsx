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
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';

interface PortYardOperationStatusProps {
    shipments: Shipment[];
}

const ChartContainer: React.FC<{
    titleCN: string;
    titleEN: string;
    children: React.ReactNode;
    height?: number;
}> = ({ titleCN, titleEN, children, height = 300 }) => (
    <div className="glass p-8 rounded-[2.5rem] border-none shadow-glass transition-all duration-300 ring-1 ring-white/40 hover:bg-white/50">
        <div className="mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.25em]">{titleCN}</h3>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">{titleEN}</div>
        </div>
        <div className="chart-wrapper rounded-2xl overflow-hidden" style={{ width: '100%', height: height }}>
            <ResponsiveContainer width="100%" height={height}>
                {children as React.ReactElement}
            </ResponsiveContainer>
        </div>
    </div>
);

const KPICard: React.FC<{ labelCN: string; labelEN: string; value: string | number }> = ({ labelCN, labelEN, value }) => (
    <div className="glass p-6 rounded-[2.5rem] ring-1 ring-white/30">
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{labelCN}</div>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{labelEN}</div>
        <p className="text-2xl font-display font-black text-slate-800 mt-2">{value}</p>
    </div>
);

const PortYardOperationStatus: React.FC<PortYardOperationStatusProps> = ({ shipments }) => {
    const data = useMemo<PortYardDashboardData>(() => {
        return calculatePortYardOperationData(shipments);
    }, [shipments]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-10"
        >
            {/* Section 1 - Port Operation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <ChartContainer titleCN="今日港口作业量" titleEN="Daily Port Operation Volume" height={300}>
                    <BarChart layout="vertical" data={data.portOperationData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E0E0E0" />
                        <XAxis type="number" fontSize={11} stroke="#888" />
                        <YAxis dataKey="nameCN" type="category" fontSize={11} stroke="#555" width={80} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563EB" barSize={20} />
                    </BarChart>
                </ChartContainer>

                <ChartContainer titleCN="港口作业分布" titleEN="Port Operation Distribution" height={300}>
                    <PieChart>
                        <Pie data={data.portDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8">
                            {data.portDistData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ChartContainer>

                <div className="grid grid-cols-2 gap-4">
                    <KPICard labelCN="今日到港" labelEN="Daily Arrivals" value="124" />
                    <KPICard labelCN="今日离港" labelEN="Daily Departures" value="98" />
                    <KPICard labelCN="月度吞吐量" labelEN="Monthly Port Throughput" value="12,450" />
                    <KPICard labelCN="海关待处理" labelEN="Customs Pending" value="45" />
                </div>
            </div>

            {/* Section 2 - Yard Inventory */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <ChartContainer titleCN="堆场库位占比" titleEN="Yard Slot Utilization" height={300}>
                    <BarChart data={data.yardSlotData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Capacity" fill="#E2E8F0" name="容量 (Capacity)" />
                        <Bar dataKey="Occupied" fill="#2563EB" name="占用 (Occupied)" />
                    </BarChart>
                </ChartContainer>
                
                <ChartContainer titleCN="集装箱堆存周期" titleEN="Container Aging Monitoring" height={300}>
                    <BarChart data={data.containerAgingData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" />
                        <Tooltip />
                        <Bar dataKey="d1_7" stackId="a" name="1-7 天" fill="#3B82F6" />
                        <Bar dataKey="d8_15" stackId="a" name="8-15 天" fill="#10B981" />
                        <Bar dataKey="d16_30" stackId="a" name="16-30 天" fill="#F59E0B" />
                        <Bar dataKey="d30plus" stackId="a" name="30+ 天" fill="#EF4444" />
                    </BarChart>
                </ChartContainer>

                <ChartContainer titleCN="超期集装箱分析" titleEN="Overdue Container Analysis" height={300}>
                    <BarChart data={data.overdueAnalysisData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="quantity" name="数量 (Quantity)" fill="#EF4444" />
                    </BarChart>
                </ChartContainer>
            </div>
        </motion.div>
    );
};

export default React.memo(PortYardOperationStatus);
