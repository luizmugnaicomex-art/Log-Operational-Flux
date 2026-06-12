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

    // Read manual data from localStorage to integrate into charts
    const manualData = useMemo(() => {
        const stored = localStorage.getItem('emptyContainersDataV3');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Flatten all sections into a single list for charting if needed
                const all = [...(parsed.bondedArea || []), ...(parsed.warehouse || []), ...(parsed.buffer || [])];
                return {
                    sections: parsed,
                    flattened: all.map((loc: any) => ({
                        name: loc.name,
                        Occupied: loc.fullCount,
                        Empty: loc.emptyCount,
                        Total: loc.fullCount + loc.emptyCount
                    }))
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }, []);

    const yardChartData = useMemo(() => {
        if (!manualData || manualData.flattened.length === 0) return data.yardSlotData;
        // Merge or replace? User said "get the information from..." 
        // Let's combine them for a comprehensive view
        return manualData.flattened;
    }, [data.yardSlotData, manualData]);

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
                    <KPICard labelCN="到港出货比" labelEN="Daily Drain/Arrivals" value="0.85" />
                    <KPICard labelCN="月度吞吐量" labelEN="Monthly Port Throughput" value="12,450" />
                    <KPICard labelCN="海关待处理" labelEN="Customs Pending" value="45" />
                    <KPICard labelCN="排队车辆" labelEN="Trucks in Queue" value="12" />
                    <KPICard labelCN="堆场利用率" labelEN="Yard Occupancy" value="78%" />
                </div>
            </div>

            {/* Section 2 - Yard Inventory */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <ChartContainer titleCN="堆场库位占比" titleEN="Yard Slot Utilization" height={300}>
                    <BarChart data={yardChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis />
                        <Tooltip />
                        {manualData ? (
                             <>
                                <Bar dataKey="Occupied" fill="#2563EB" name="重箱 (Full)" />
                                <Bar dataKey="Empty" fill="#94A3B8" name="空箱 (Empty)" />
                             </>
                        ) : (
                            <>
                                <Bar dataKey="Capacity" fill="#E2E8F0" name="容量 (Capacity)" />
                                <Bar dataKey="Occupied" fill="#2563EB" name="占用 (Occupied)" />
                            </>
                        )}
                    </BarChart>
                </ChartContainer>
                
                <ChartContainer titleCN="集装箱堆存周期" titleEN="Container Aging Monitoring" height={300}>
                    <BarChart data={data.containerAgingData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" fontSize={10} />
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
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="quantity" name="数量 (Quantity)" fill="#EF4444" />
                    </BarChart>
                </ChartContainer>
            </div>

            {/* Section 3 - Transport & Release */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <ChartContainer titleCN="提柜及放行状态" titleEN="Container Pickup and Release Status" height={300}>
                    <BarChart data={data.transportReleaseData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Transferred" fill="#94A3B8" name="待处理 (Transferred)" />
                        <Bar dataKey="Invoiced" fill="#F59E0B" name="已开票 (Invoiced)" />
                        <Bar dataKey="Released" fill="#10B981" name="已放行 (Released)" />
                    </BarChart>
                </ChartContainer>

                <ChartContainer titleCN="本月运输车型" titleEN="Monthly Transportation Type" height={300}>
                    <PieChart>
                        <Pie data={data.transportTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80}>
                            {data.transportTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ChartContainer>

                <div className="grid grid-cols-2 gap-4">
                    <KPICard labelCN="月度交付量" labelEN="Monthly Deliveries" value="3,637" />
                    <KPICard labelCN="平均周转天数" labelEN="Average Turnaround Time" value="34.11" />
                    <KPICard labelCN="待分派车辆" labelEN="Pending Dispatch" value="1,073" />
                    <KPICard labelCN="运输效率" labelEN="Transport Efficiency" value="92%" />
                    <KPICard labelCN="延误箱量" labelEN="Delayed Containers" value="18" />
                    <KPICard labelCN="今日发运进度" labelEN="Daily Shipment Progress" value="85%" />
                </div>
            </div>

            {/* Section 4 - Daily Operation Trend */}
            <ChartContainer titleCN="每日作业趋势" titleEN="Daily Operation Trend" height={300}>
                <BarChart data={data.dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="TEGMA" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="GABARDO" stackId="a" fill="#10B981" />
                    <Bar dataKey="BRAZUL" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="TRANSILVA" stackId="a" fill="#EF4444" />
                </BarChart>
            </ChartContainer>
        </motion.div>
    );
};

export default React.memo(PortYardOperationStatus);
