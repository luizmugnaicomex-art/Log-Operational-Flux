
import React, { useState, useMemo } from 'react';
import { ChartData, Shipment } from '../types';
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
    ComposedChart,
    Line,
    ReferenceLine,
    Label,
    LabelList
} from 'recharts';
import { currencyFormatter } from '../utils/formatters';

interface ChartsGridProps {
    data: ChartData;
    shipments: Shipment[];
    onLeadTimeClick?: (data: any) => void;
    onCargoReadyClick?: (data: any) => void;
    onAtaClick?: (data: any) => void;
    onRampUpClick?: (data: any) => void;
    onBondedInventoryClick?: (data: any, type?: 'arrivedNotPicked' | 'futureArrivals') => void;
    onInventoryClick?: (data: any) => void;
    onCargoReadyInflowClick?: (data: any) => void;
    onDrainLineClick?: (data: any) => void;
    onVesselArrivalClick?: (data: any) => void;
}

const chartColors = [
    '#16A34A', '#2563EB', '#DC2626', '#F59E0B', '#7C3AED', 
    '#DB2777', '#0891B2', '#4B5563', '#9333EA', '#EA580C', 
    '#65A30D', '#059669', '#D97706', '#EF4444', '#3B82F6', 
    '#6366F1', '#8B5CF6', '#EC4899'
];

const CARRIER_COLOR_MAP: Record<string, string> = {
    'INTERMARÍTIMA': '#16A34A',
    'INTERMARITIMA': '#16A34A',
    'TRANSPARANÁ': '#2563EB',
    'TRANSPARANA': '#2563EB',
    'UNKNOWN': '#DC2626',
    'Unknown': '#DC2626',
    'CARRIER NOT IDENTIFIED': '#DC2626'
};

const WAREHOUSE_COLOR_MAP: Record<string, string> = {
    'INTERMARÍTIMA': '#16A34A',
    'INTERMARITIMA': '#16A34A',
    'TECON': '#DC2626',
    'CLIA EMPÓRIO': '#F59E0B',
    'CLIA EMPORIO': '#F59E0B',
    'TPC': '#2563EB',
    'TECA': '#EC4899'
};

const getCarrierColor = (name: string, index: number) => {
    const upperName = name.toUpperCase();
    if (CARRIER_COLOR_MAP[upperName]) return CARRIER_COLOR_MAP[upperName];
    if (upperName.includes('INTERMAR')) return '#16A34A';
    if (upperName.includes('TRANSPARAN')) return '#2563EB';
    return chartColors[index % chartColors.length];
};

const getWarehouseColor = (name: string, index: number) => {
    const upperName = name.toUpperCase();
    if (WAREHOUSE_COLOR_MAP[upperName]) return WAREHOUSE_COLOR_MAP[upperName];
    if (upperName.includes('INTERMAR')) return '#16A34A';
    if (upperName.includes('TECON')) return '#DC2626';
    if (upperName.includes('CLIA')) return '#F59E0B';
    if (upperName.includes('TPC')) return '#2563EB';
    if (upperName.includes('TECA')) return '#EC4899';
    return chartColors[index % chartColors.length];
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const hasInventory = payload.some((p: any) => String(p.name).includes("Remaining Balance"));

        return (
            <div className="glass-dark p-5 border-none rounded-3xl shadow-2xl backdrop-blur-xl text-xs min-w-[240px] z-[100] ring-1 ring-white/20">
                <p className="label font-black text-white mb-3 border-b border-white/10 pb-2 tracking-tight text-sm">{`${label}`}</p>
                {payload.map((p: any, i: number) => {
                    const isWarehouseChart = p.payload.capacity !== undefined;
                    const isGoalChart = p.payload.isWeekend !== undefined;
                    const isCarrierChart = p.payload.latePct !== undefined;
                    const isFlowChart = p.payload.placed !== undefined;
                    const utilization = isWarehouseChart && p.payload.capacity > 0 
                        ? ((p.payload.value / p.payload.capacity) * 100).toFixed(1) 
                        : null;

                    return (
                        <div key={i} className="mb-3 last:mb-0">
                            <p className="flex justify-between items-center gap-6">
                                <span className="font-extrabold border-l-4 pl-3 tracking-tight" style={{ borderColor: p.color, color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
                                <span className="font-black text-sm" style={{ color: p.color }}>{p.formatter ? p.formatter(p.value) : p.value}</span>
                            </p>
                            {isGoalChart && p.name === "Arrivals (Delivered)" && (
                                <div className="mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                                   {p.payload.isWeekend ? 'Weekend Cycle' : p.payload.goalReached ? 'Performance Target Hit' : 'Under Target Capacity'}
                                </div>
                            )}
                            {isCarrierChart && (
                                <div className="mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                                   {p.payload.volume} Units | {p.payload.latePct}% Delay | {p.payload.volumePct}% Impact
                                </div>
                            )}
                            {isWarehouseChart && p.name.includes('Containers') && p.payload.capacity > 0 && (
                                <p className="text-[10px] text-white/50 font-medium mt-1.5 italic">
                                    Total Capacity: {p.payload.capacity} | Utilized: {utilization}%
                                </p>
                            )}
                            {isFlowChart && (
                                <div className="mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                                    {((p.payload.picked / p.payload.placed) * 100).toFixed(1)}% Operational Conversion
                                </div>
                            )}
                        </div>
                    );
                })}
                {hasInventory && (
                    <div className="mt-4 bg-indigo-600 border-none text-white py-2.5 px-3 rounded-2xl text-center font-black text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 animate-pulse cursor-pointer">
                        <span className="material-icons text-xs">analytics</span>
                        Interact For Granular Data
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const ChartContainer: React.FC<{
    title: string;
    subtitle?: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    height?: number;
    onMaximize?: () => void;
}> = ({ title, subtitle, headerRight, children, className = '', height = 300, onMaximize }) => {
    const [isMinimized, setIsMinimized] = useState(false);

    return (
        <div className={`glass p-8 rounded-[2.5rem] border-none shadow-glass ${className} transition-all duration-300 ring-1 ring-white/40 hover:bg-white/50 group`}>
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.25em] flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full group-hover:scale-y-125 transition-transform origin-bottom" />
                        {title}
                    </h3>
                    {subtitle && (
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-widest opacity-80 pl-4">
                            {subtitle}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    {headerRight}
                    {onMaximize && (
                        <button 
                            onClick={onMaximize}
                            className="text-slate-300 hover:text-indigo-600 focus:outline-none p-2 hover:bg-white/60 rounded-xl transition-all no-export ring-1 ring-transparent hover:ring-white/50"
                            title="Maximize Chart"
                        >
                            <span className="material-icons text-xl">fullscreen</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="text-slate-300 hover:text-slate-600 focus:outline-none p-2 hover:bg-white/60 rounded-xl transition-all no-export ring-1 ring-transparent hover:ring-white/50"
                    >
                        <span className="material-icons text-2xl select-none">
                            {isMinimized ? 'expand_more' : 'expand_less'}
                        </span>
                    </button>
                </div>
            </div>
            
            {!isMinimized && (
                 <div className="chart-wrapper rounded-2xl overflow-hidden" style={{ width: '100%', height: height, minHeight: height }}>
                    <ResponsiveContainer width="100%" height={height} minWidth={1} minHeight={1}>
                        {children as React.ReactElement}
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { week: weekNo, year: d.getUTCFullYear() };
};

const ChartsGrid: React.FC<ChartsGridProps> = ({ 
    data, 
    onLeadTimeClick, 
    onCargoReadyClick, 
    onAtaClick, 
    onRampUpClick, 
    onBondedInventoryClick, 
    onInventoryClick,
    onCargoReadyInflowClick,
    onDrainLineClick,
    onVesselArrivalClick
}) => {
    const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
    const [scenario, setScenario] = useState<number | ''>(150);
    const [cargoReadyViewMode, setCargoReadyViewMode] = useState<'days' | 'weeks'>('days');
    const [inventoryUnit, setInventoryUnit] = useState<'containers' | 'bls'>('containers');
    const [inventoryOnly, setInventoryOnly] = useState<boolean>(false);

    const cargoReadyData = useMemo(() => {
        if (cargoReadyViewMode === 'days') return data.cargoReadyComparison;

        const weeklyMap = new Map<string, any>();
        
        data.cargoReadyComparison.forEach(day => {
            if (!day.date) return;
            const d = new Date(day.date);
            const { week, year } = getISOWeek(d);
            const weekKey = `W${week} - ${year}`;
            
            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                    label: weekKey,
                    date: d,
                    readyCount: 0,
                    deliveredCount: 0,
                    ataCount: 0,
                    runningBalance: 0,
                    readyCountBL: 0,
                    deliveredCountBL: 0,
                    ataCountBL: 0,
                    runningBalanceBL: 0,
                    isWeekend: false
                });
            }
            
            const weekData = weeklyMap.get(weekKey);
            if (d.getTime() > weekData.date.getTime()) {
                weekData.date = d;
            }
            
            weekData.readyCount += day.readyCount;
            weekData.deliveredCount += day.deliveredCount;
            weekData.ataCount += day.ataCount;
            weekData.runningBalance = day.runningBalance; 
            weekData.readyCountBL += day.readyCountBL || 0;
            weekData.deliveredCountBL += day.deliveredCountBL || 0;
            weekData.ataCountBL += day.ataCountBL || 0;
            weekData.runningBalanceBL = day.runningBalanceBL || 0;
        });

        return Array.from(weeklyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [data.cargoReadyComparison, cargoReadyViewMode]);

    const rampUpDataWithScenarios = useMemo(() => {
        const INITIAL_BACKLOG = 2400; // <-- adjust to real yard inventory

        let backlog = INITIAL_BACKLOG;
        let cumulativeDelivered = 0;

        const s = Number(scenario) || 0;

        const result = data.rampUpPlan.map((period) => {
            const arrivals = period.actualArrivals + period.projectedArrivals;

            const capacity = s * 5; // Using working days only

            const delivered = Math.min(capacity, backlog + arrivals);

            backlog = backlog + arrivals - delivered;
            cumulativeDelivered += delivered;

            return {
                ...period,
                weeklyDelivered: delivered,
                cumulativeDelivered,
                backlog
            };
        });

        // Extend periods if there is still a backlog
        if (backlog > 0 && result.length > 0) {
            const lastItem = result[result.length - 1];
            const lastPeriod = lastItem ? lastItem.period : "W1 - 2026";
            const parts = lastPeriod.split(' - ');
            let weekStr = parts[0] || "W1";
            let yearStr = parts[1] || "2026";
            let week = parseInt(weekStr.replace('W', '')) || 1;
            let year = parseInt(yearStr) || 2026;
            let cumulativeArrivals = lastItem ? lastItem.cumulativeArrivals : 0;

            let safetyCounter = 0;
            while (backlog > 0 && safetyCounter < 52) {
                week++;
                if (week > 52) {
                    week = 1;
                    year++;
                }
                
                const arrivals = 0;
                const capacity = s * 5;
                
                const delivered = Math.min(capacity, backlog + arrivals);
                
                cumulativeDelivered += delivered;
                backlog = backlog + arrivals - delivered;
                
                result.push({
                    period: `W${week} - ${year}`,
                    actualArrivals: 0,
                    projectedArrivals: 0,
                    cumulativeArrivals,
                    weeklyDelivered: delivered,
                    cumulativeDelivered,
                    backlog
                });
                safetyCounter++;
            }
        }

        return result;
    }, [data.rampUpPlan, scenario]);

    const getSum = (dataset: { value: number }[]) => dataset.reduce((acc, curr) => acc + curr.value, 0);

    const carrierNames = useMemo(() => {
        const names = new Set<string>();
        data.carrierDelayImpact.forEach(c => names.add(c.name));
        return Array.from(names);
    }, [data.carrierDelayImpact]);

    const depotNames = useMemo(() => {
        const names = new Set<string>();
        data.dailyDepotReturnBreakdown.forEach(day => {
            Object.keys(day).forEach(key => {
                if (key !== 'date' && key !== 'label' && key !== 'total') {
                    names.add(key);
                }
            });
        });
        return Array.from(names);
    }, [data.dailyDepotReturnBreakdown]);

    const warehouseNames = useMemo(() => {
        const names = new Set<string>();
        data.dailyWarehousePickedBreakdown.forEach(day => {
            Object.keys(day).forEach(key => {
                if (key !== 'date' && key !== 'label' && key !== 'total') {
                    names.add(key);
                }
            });
        });
        return Array.from(names);
    }, [data.dailyWarehousePickedBreakdown]);

    const warehouseStats = useMemo(() => {
        const sums: Record<string, number> = {};
        const activeDays: Record<string, number> = {};
        const totalDays = data.dailyWarehousePickedBreakdown.length || 1;
        
        warehouseNames.forEach(name => {
            sums[name] = 0;
            activeDays[name] = 0;
        });

        data.dailyWarehousePickedBreakdown.forEach(day => {
            warehouseNames.forEach(name => {
                if (day[name]) {
                    sums[name] += day[name];
                    activeDays[name] += 1;
                }
            });
        });

        return warehouseNames.map(name => {
            const total = sums[name];
            const active = activeDays[name] || 0;
            const activeAvg = active > 0 ? Math.round(total / active) : 0;
            const fullAvg = Math.round(total / totalDays);
            const inconsistent = active > 0 && active < totalDays * 0.5;

            return {
                name,
                total,
                activeDays: active,
                totalDays,
                activeAvg,
                fullAvg,
                inconsistent
            };
        }).sort((a, b) => b.activeAvg - a.activeAvg);
    }, [data.dailyWarehousePickedBreakdown, warehouseNames]);

    const renderWarehouseStats = () => (
        <div className="flex flex-wrap gap-2 justify-end">
            {warehouseStats.map((wh, index) => {
                const color = getWarehouseColor(wh.name, index);
                return (
                    <div 
                        key={wh.name} 
                        className={`flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border ${wh.inconsistent ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}
                        title={`Total: ${wh.total} | Active Days: ${wh.activeDays}/${wh.totalDays} | Full Period Avg: ${wh.fullAvg} | Active Day Avg: ${wh.activeAvg}`}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">{wh.name}:</span>
                        <span className="text-xs font-black text-slate-800">{wh.activeAvg} AVG</span>
                        {wh.inconsistent && <span className="text-[10px] ml-1" title="Inconsistent pickup pattern (active < 50% of days)">⚠️</span>}
                    </div>
                );
            })}
        </div>
    );

    const depotStats = useMemo(() => {
        const sums: Record<string, number> = {};
        const activeDays: Record<string, number> = {};
        const totalDays = data.dailyDepotReturnBreakdown.length || 1;
        
        depotNames.forEach(name => {
            sums[name] = 0;
            activeDays[name] = 0;
        });

        data.dailyDepotReturnBreakdown.forEach(day => {
            depotNames.forEach(name => {
                if (day[name]) {
                    sums[name] += day[name];
                    activeDays[name] += 1;
                }
            });
        });

        return depotNames.map(name => {
            const total = sums[name];
            const active = activeDays[name] || 0;
            const activeAvg = active > 0 ? Math.round(total / active) : 0;
            const fullAvg = Math.round(total / totalDays);
            const inconsistent = active > 0 && active < totalDays * 0.5;

            return {
                name,
                total,
                activeDays: active,
                totalDays,
                activeAvg,
                fullAvg,
                inconsistent
            };
        }).sort((a, b) => b.activeAvg - a.activeAvg);
    }, [data.dailyDepotReturnBreakdown, depotNames]);

    const renderDepotStats = () => (
        <div className="flex flex-wrap gap-2 justify-end">
            {depotStats.map((depot, index) => {
                const color = chartColors[depotNames.indexOf(depot.name) % chartColors.length];
                return (
                    <div 
                        key={depot.name} 
                        className={`flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border ${depot.inconsistent ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}
                        title={`Total: ${depot.total} | Active Days: ${depot.activeDays}/${depot.totalDays} | Full Period Avg: ${depot.fullAvg} | Active Day Avg: ${depot.activeAvg}`}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                        <span className="text-[10px] font-black uppercase text-slate-500">{depot.name}:</span>
                        <span className="text-xs font-black text-slate-800">{depot.activeAvg} AVG</span>
                        {depot.inconsistent && <span className="text-[10px] ml-1" title="Inconsistent return pattern (active < 50% of days)">⚠️</span>}
                    </div>
                );
            })}
        </div>
    );

    const renderChartContent = (key: string, isMaximized: boolean = false) => {
        const labelSize = isMaximized ? 12 : 10;
        const tickSize = isMaximized ? 11 : 9;

        switch (key) {
            case 'daily_volume':
                return (
                    <ComposedChart
                        data={data.leadTimeTrend}
                        margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                        onClick={(e: any) => {
                            if (onLeadTimeClick && e?.activePayload?.length) {
                                onLeadTimeClick(e.activePayload[0].payload);
                            }
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: labelSize, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                        <Legend wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        <ReferenceLine y={150} stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2}>
                            <Label value="Goal: 150" position="right" fill="#F59E0B" fontSize={labelSize} fontWeight={900} />
                        </ReferenceLine>
                        <Bar dataKey="containerCount" name="Arrivals (Delivered)" cursor="pointer" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="containerCount" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                            {data.leadTimeTrend.map((entry, index) => {
                                let fill = '#94a3b8';
                                if (entry.isWeekend) fill = '#6366F1';
                                else if (entry.goalReached) fill = '#10B981';
                                return <Cell key={`cell-${index}`} fill={fill} />;
                            })}
                        </Bar>
                    </ComposedChart>
                );
            case 'daily_depot_return':
                return (
                    <BarChart data={data.dailyDepotReturnBreakdown} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: tickSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#f0f9ff'}} />
                        <Legend wrapperStyle={{ fontSize: tickSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        {depotNames.map((name, index) => (
                            <Bar key={name} dataKey={name} stackId="depot" fill={chartColors[index % chartColors.length]}>
                                <LabelList dataKey={name} position="center" content={(props: any) => {
                                    const { x, y, width, height, value } = props;
                                    if (value <= 0) return null;
                                    return <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={tickSize} fontWeight={900}>{value}</text>;
                                }} />
                            </Bar>
                        ))}
                        <Bar dataKey="total" stackId="depot" fill="transparent" isAnimationActive={false}>
                            <LabelList dataKey="total" position="top" style={{ fontSize: labelSize, fill: '#1e293b', fontWeight: 900 }} />
                        </Bar>
                    </BarChart>
                );
            case 'daily_warehouse_picked':
                return (
                    <BarChart data={data.dailyWarehousePickedBreakdown} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: tickSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                        <Legend wrapperStyle={{ fontSize: tickSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        {warehouseNames.map((name, index) => (
                            <Bar key={name} dataKey={name} stackId="warehouse" fill={getWarehouseColor(name, index)}>
                                <LabelList dataKey={name} position="center" content={(props: any) => {
                                    const { x, y, width, height, value } = props;
                                    if (value <= 0) return null;
                                    return <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={tickSize} fontWeight={900}>{value}</text>;
                                }} />
                            </Bar>
                        ))}
                        <Bar dataKey="total" stackId="warehouse" fill="transparent" isAnimationActive={false}>
                            <LabelList dataKey="total" position="top" style={{ fontSize: labelSize, fill: '#1e293b', fontWeight: 900 }} />
                        </Bar>
                    </BarChart>
                );
            case 'depot_distribution':
                return (
                    <BarChart data={data.depotDistribution} layout="vertical" margin={{ top: 20, right: 60, left: 30, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fontSize: tickSize, fontWeight: 700, fill: '#64748b' }} 
                            axisLine={false} 
                            width={100}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Returned Containers" radius={[0, 6, 6, 0]}>
                            <LabelList dataKey="value" position="right" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                            {data.depotDistribution.map((entry, index) => (
                                <Cell key={`depot-cell-${index}`} fill={chartColors[index % chartColors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'goal_achievement':
                return (
                    <BarChart data={data.leadTimeTrend} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={100} stroke="#16A34A" strokeDasharray="6 3" strokeWidth={2}>
                            <Label value="TARGET (100%)" position="left" fill="#16A34A" fontSize={labelSize} fontWeight={900} />
                        </ReferenceLine>
                        <ReferenceLine y={85} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1}>
                            <Label value="MINIMUM (85%)" position="left" fill="#F59E0B" fontSize={labelSize} fontWeight={900} />
                        </ReferenceLine>
                        <Bar dataKey="achievementPct" name="Goal Achievement" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="achievementPct" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} formatter={(v: number) => v > 0 ? `${v}%` : ''} />
                            {data.leadTimeTrend.map((entry, index) => {
                                if (entry.isWeekend) return <Cell key={`cell-pct-${index}`} fill="#9333EA" />;
                                let fill = '#DC2626';
                                if (entry.achievementPct >= 100) fill = '#10B981';
                                else if (entry.achievementPct >= 85) fill = '#F59E0B';
                                return <Cell key={`cell-pct-${index}`} fill={fill} />;
                            })}
                        </Bar>
                    </BarChart>
                );
            case 'carrier_breakdown':
                return (
                    <BarChart data={data.dailyCarrierBreakdown} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: tickSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                        <Legend wrapperStyle={{ fontSize: tickSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        <ReferenceLine y={150} stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2}>
                            <Label value="Goal: 150" position="right" fill="#F59E0B" fontSize={labelSize} fontWeight={900} />
                        </ReferenceLine>
                        {carrierNames.map((name, index) => (
                            <Bar key={name} dataKey={name} stackId="volume" fill={getCarrierColor(name, index)}>
                                <LabelList dataKey={name} position="center" content={(props: any) => {
                                    const { x, y, width, height, value } = props;
                                    if (value <= 0) return null;
                                    return <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={tickSize} fontWeight={900}>{value}</text>;
                                }} />
                            </Bar>
                        ))}
                        <Bar dataKey="total" stackId="volume" fill="transparent" isAnimationActive={false}>
                            <LabelList dataKey="total" position="top" style={{ fontSize: labelSize, fill: '#1e293b', fontWeight: 900 }} />
                        </Bar>
                    </BarChart>
                );
            case 'volume_share':
                return (
                    <BarChart data={data.carrierDelayImpact} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: tickSize, fontWeight: 700, fill: '#64748b' }} axisLine={false} interval={0} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase' }} />
                        <Bar dataKey="volumePct" name="Volume Share (%)" radius={[6, 6, 0, 0]}>
                            <LabelList 
                                dataKey="volumePct" 
                                position="top" 
                                content={(props: any) => {
                                    const { x, y, width, value, index } = props;
                                    const entry = data.carrierDelayImpact[index];
                                    if (!entry) return null;
                                    return (
                                        <text 
                                            x={x + width / 2} 
                                            y={y - 10} 
                                            fill="#1e293b" 
                                            textAnchor="middle" 
                                            fontSize={labelSize} 
                                            fontWeight={900}
                                        >
                                            {`${value}% (${entry.volume})`}
                                        </text>
                                    );
                                }}
                            />
                            {data.carrierDelayImpact.map((entry, index) => (
                                <Cell key={`carrier-cell-${index}`} fill={getCarrierColor(entry.name, index)} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'delay_distribution':
                return (
                    <BarChart data={data.dailyCarrierDelayBreakdown} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: tickSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#fff5f5'}} />
                        <Legend wrapperStyle={{ fontSize: tickSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        {carrierNames.map((name, index) => (
                            <Bar key={`${name}_late`} dataKey={name} name={name} stackId="delay" fill={getCarrierColor(name, index)}>
                                <LabelList dataKey={name} position="center" content={(props: any) => {
                                    const { x, y, width, height, value } = props;
                                    if (value <= 0) return null;
                                    return <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={tickSize} fontWeight={900}>{value}</text>;
                                }} />
                            </Bar>
                        ))}
                        <Bar dataKey="totalLate" stackId="delay" fill="transparent" isAnimationActive={false}>
                            <LabelList dataKey="totalLate" position="top" style={{ fontSize: labelSize, fill: '#DC2626', fontWeight: 900 }} />
                        </Bar>
                    </BarChart>
                );
            case 'monthly_trend':
                return (
                    <ComposedChart data={data.monthlyTrend} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#DC2626' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase' }} />
                        <Bar yAxisId="left" dataKey="value" name="Volume" fill="#2563EB" radius={[6,6,0,0]} />
                        <Line yAxisId="right" type="monotone" dataKey="late" name="Late" stroke="#DC2626" strokeWidth={3} dot={{ r: 4, fill: '#DC2626', stroke: '#fff' }} />
                    </ComposedChart>
                );
            case 'terminal_capacity':
                return (
                    <ComposedChart data={data.warehouseVolume} margin={{ top: 35, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="capacity" name="Capacity" fill="#f1f5f9" barSize={isMaximized ? 60 : 40} radius={[8,8,0,0]}>
                            <LabelList dataKey="capacity" position="top" fontSize={labelSize} fill="#94a3b8" fontWeight={900} />
                        </Bar>
                        <Bar dataKey="arrived" name="Arrived (ETA)" fill="#3b82f6" barSize={isMaximized ? 40 : 25} radius={[8,8,0,0]}>
                            <LabelList dataKey="arrived" position="top" fontSize={labelSize} fill="#3b82f6" fontWeight={900} />
                        </Bar>
                        <Bar dataKey="value" name="Picked" fill="#334155" barSize={isMaximized ? 40 : 25} radius={[8,8,0,0]}>
                            <LabelList dataKey="value" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                        </Bar>
                    </ComposedChart>
                );
            case 'bonded_flow':
                return (
                    <BarChart data={data.bondedFlow} margin={{ top: 35, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '10px' }} />
                        <Bar dataKey="placed" name="Placed in Bonded" fill="#e2e8f0" barSize={isMaximized ? 50 : 35} radius={[8,8,0,0]}>
                            <LabelList dataKey="placed" position="top" fontSize={labelSize} fill="#64748b" fontWeight={900} />
                        </Bar>
                        <Bar dataKey="arrived" name="Arrived (ETA)" fill="#3b82f6" barSize={isMaximized ? 40 : 25} radius={[8,8,0,0]}>
                            <LabelList dataKey="arrived" position="top" fontSize={labelSize} fill="#3b82f6" fontWeight={900} />
                        </Bar>
                        <Bar dataKey="picked" name="Real Picked Up" fill="#0f172a" barSize={isMaximized ? 35 : 25} radius={[8,8,0,0]}>
                            <LabelList dataKey="picked" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                        </Bar>
                    </BarChart>
                );
            case 'bonded_inventory':
                return (
                    <BarChart data={data.bondedInventory} margin={{ top: 35, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                        <Bar 
                            dataKey="arrivedNotPicked" 
                            name="Arrived Already" 
                            fill="#ef4444" 
                            stackId="a"
                            barSize={isMaximized ? 40 : 25} 
                            onClick={(data: any) => onBondedInventoryClick && onBondedInventoryClick(data, 'arrivedNotPicked')}
                            style={{ cursor: 'pointer' }}
                        />
                        <Bar 
                            dataKey="futureArrivals" 
                            name="Future Arrivals" 
                            fill="#fca5a5" 
                            stackId="a"
                            barSize={isMaximized ? 40 : 25} 
                            radius={[8,8,0,0]}
                            onClick={(data: any) => onBondedInventoryClick && onBondedInventoryClick(data, 'futureArrivals')}
                            style={{ cursor: 'pointer' }}
                        >
                            <LabelList dataKey="total" position="top" fontSize={labelSize} fill="#ef4444" fontWeight={900} />
                        </Bar>
                    </BarChart>
                );
            case 'carrier_leadtime':
                return (
                    <BarChart data={data.carrierPerformance} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="avgTime" name="Avg Days" radius={[8,8,0,0]}>
                            <LabelList dataKey="avgTime" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} formatter={(val: number) => Number(val).toFixed(1)} />
                            {data.carrierPerformance.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#94a3b8' : '#DC2626'} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'romaneio_distribution':
                return (
                    <BarChart data={data.romaneioDistribution} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Containers" radius={[8,8,0,0]}>
                            <LabelList dataKey="value" position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                            {data.romaneioDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'YES' || entry.name === 'LCL' ? '#16A34A' : '#F59E0B'} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'cargo_ready_comparison':
                return (
                    <ComposedChart 
                        data={cargoReadyData} 
                        margin={{ top: 20, right: 20, left: 10, bottom: 30 }}
                        onClick={(state) => {
                             if (state && state.activePayload && state.activePayload.length > 0) {
                                  // Call inventory click since it handles the time frame drilldown correctly
                                  // This allows users to click anywhere on the background stripe for that week/day
                                  if (onInventoryClick) onInventoryClick(state.activePayload[0].payload);
                             }
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                            dataKey="label" 
                            tick={(tickProps: any) => {
                                const { x, y, payload } = tickProps;
                                const entry = cargoReadyData.find(d => d.label === payload.value);
                                const isWeekend = entry?.isWeekend;
                                
                                let displayLabel = payload.value;
                                if (cargoReadyViewMode === 'days' && entry?.date) {
                                    const d = new Date(entry.date);
                                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                    displayLabel = `${days[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                                }

                                return (
                                    <g transform={`translate(${x},${y})`}>
                                        <text
                                            x={0}
                                            y={0}
                                            dy={16}
                                            textAnchor="middle"
                                            fill={isWeekend ? "#7C3AED" : "#1e293b"}
                                            fontSize={isMaximized ? 10 : 8}
                                            fontWeight={isWeekend ? 900 : 600}
                                        >
                                            {displayLabel}
                                        </text>
                                    </g>
                                );
                            }}
                            axisLine={false} 
                            tickLine={false} 
                            interval={0}
                        />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '30px' }} />
                        
                        {/* Vessel Arrivals (ATA) */}
                        {!inventoryOnly && (
                            <Bar 
                                dataKey={inventoryUnit === 'bls' ? 'ataCountBL' : 'ataCount'} 
                                name={`Vessel Arrivals (ATA) [${inventoryUnit === 'bls' ? 'BLs' : 'Containers'}]`} 
                                fill="#EF4444" 
                                radius={[6, 6, 0, 0]}
                                opacity={0.6}
                                onClick={(data) => onVesselArrivalClick?.(data)}
                                style={{ cursor: onVesselArrivalClick ? 'pointer' : 'default' }}
                            >
                                <LabelList dataKey={inventoryUnit === 'bls' ? 'ataCountBL' : 'ataCount'} position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                            </Bar>
                        )}

                        {/* Supply Inflow */}
                        {!inventoryOnly && (
                            <Bar 
                                dataKey={inventoryUnit === 'bls' ? 'readyCountBL' : 'readyCount'} 
                                name={`Cargo Ready (Inflow) [${inventoryUnit === 'bls' ? 'BLs' : 'Containers'}]`} 
                                fill="#F59E0B" 
                                radius={[6, 6, 0, 0]}
                                opacity={0.6}
                                onClick={(data) => onCargoReadyInflowClick?.(data)}
                                style={{ cursor: onCargoReadyInflowClick ? 'pointer' : 'default' }}
                            >
                                <LabelList dataKey={inventoryUnit === 'bls' ? 'readyCountBL' : 'readyCount'} position="top" fontSize={labelSize} fill="#1e293b" fontWeight={900} />
                            </Bar>
                        )}

                        {/* Remaining Balance Area */}
                        <Line
                            type="stepAfter"
                            dataKey={inventoryUnit === 'bls' ? 'runningBalanceBL' : 'runningBalance'}
                            name={`Remaining Balance (Inventory) [${inventoryUnit === 'bls' ? 'BLs' : 'Containers'}]`}
                            stroke="#7C3AED"
                            strokeWidth={inventoryOnly ? 4 : 2}
                            strokeDasharray={inventoryOnly ? "" : "5 5"}
                            dot={{ r: inventoryOnly ? 6 : 4, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 9, stroke: '#C4B5FD', strokeWidth: 4, cursor: 'pointer', onClick: (e, payload: any) => onInventoryClick?.(payload.payload) }}
                            onClick={(data) => {
                                 if (data && data.payload) { onInventoryClick?.(data.payload) }
                                 else { onInventoryClick?.(data) }
                            }}
                            style={{ cursor: onInventoryClick ? 'pointer' : 'default', filter: inventoryOnly ? 'drop-shadow(0px 4px 6px rgba(124, 58, 237, 0.4))' : 'none' }}
                        />
                        
                        {/* Drain Line */}
                        <Line 
                            type="monotone" 
                            dataKey={inventoryUnit === 'bls' ? 'deliveredCountBL' : 'deliveredCount'} 
                            name={`Drain Line (Delivered Trend) [${inventoryUnit === 'bls' ? 'BLs' : 'Containers'}]`} 
                            stroke="#16A34A" 
                            strokeWidth={inventoryOnly ? 4 : 2} 
                            opacity={inventoryOnly ? 0.4 : 1}
                            dot={{ r: 5, fill: '#16A34A', stroke: '#fff', strokeWidth: 2 }} 
                            activeDot={{ r: 8 }}
                            onClick={(data) => onDrainLineClick?.(data)}
                            style={{ cursor: onDrainLineClick ? 'pointer' : 'default' }}
                        />
                    </ComposedChart>
                );
            case 'ramp_up_plan':
                return (
                    <ComposedChart data={rampUpDataWithScenarios} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                            dataKey="period" 
                            tick={{ fontSize: labelSize, fontWeight: 700, fill: '#64748b' }} 
                            axisLine={false} 
                            tickLine={false} 
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis tick={{ fontSize: labelSize, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                            wrapperStyle={{ fontSize: labelSize, fontWeight: 800, textTransform: 'uppercase', paddingTop: '30px' }} 
                            payload={[
                                { value: 'Arrivals', type: 'rect', color: '#1E293B' },
                                { value: 'Delivered', type: 'line', color: '#10B981', strokeDasharray: '5 5' },
                                { value: 'Backlog', type: 'line', color: '#EF4444' },
                                { value: 'Terminal Capacity', type: 'line', color: '#DC2626', strokeDasharray: '5 5' }
                            ]}
                        />
                        
                        <ReferenceLine 
                            y={15000} 
                            stroke="#DC2626" 
                            strokeDasharray="5 5" 
                            label={{ position: 'insideTopLeft', value: 'Terminal Capacity', fill: '#DC2626', fontSize: 12, fontWeight: 'bold' }} 
                        />

                        <Bar dataKey="actualArrivals" name="Actual Arrivals (ATA)" stackId="a" fill="#1E293B" radius={[0, 0, 0, 0]} onClick={(data) => onRampUpClick?.(data)} style={{ cursor: onRampUpClick ? 'pointer' : 'default' }} />
                        
                        <Bar dataKey="projectedArrivals" name="Projected Arrivals (ETA)" stackId="a" fill="#94A3B8" radius={[6, 6, 0, 0]} onClick={(data) => onRampUpClick?.(data)} style={{ cursor: onRampUpClick ? 'pointer' : 'default' }} />

                        {scenario !== '' && (
                            <>
                                <Line 
                                    type="monotone" 
                                    dataKey="weeklyDelivered" 
                                    name={`Delivered Capacity (${scenario}/day)`} 
                                    stroke="#10B981" 
                                    strokeWidth={3} 
                                    strokeDasharray="5 5"
                                    dot={false} 
                                    activeDot={{ r: 6 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="backlog" 
                                    name={`Projected Backlog`} 
                                    stroke="#EF4444" 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6 }}
                                >
                                    <LabelList dataKey="backlog" position="top" fontSize={labelSize} fill="#EF4444" fontWeight={900} />
                                </Line>
                            </>
                        )}
                    </ComposedChart>
                );
            default:
                return null;
        }
    };

    const getChartMeta = (key: string) => {
        switch(key) {
            case 'daily_volume': return { title: "1 - Daily Volume vs Goal (150 CNTR)", subtitle: "Weekdays track the 150 cntr goal. Weekends are calculated as bonus performance." };
            case 'goal_achievement': return { title: "2 - Daily Goal Achievement (%)", subtitle: "Percentage of the 150 CNTR target reached per day." };
            case 'carrier_breakdown': return { title: "3 - Daily Volume Breakdown by Carrier", subtitle: "Daily CNTR throughput segmented by transport company vs 150 target." };
            case 'volume_share': return { title: "4 - Carrier Volume Share", subtitle: "Percentage and total count of operations per transport company." };
            case 'depot_distribution': return { title: "5 - Depot Share Distribution", subtitle: "Total cumulative distribution of container returns per depot facility." };
            case 'daily_depot_return': return { title: "6 - Daily Depot Return Throughput", subtitle: "Daily units returned to depot facilities (Column AY) stacked by Depot (AZ)." };
            case 'daily_warehouse_picked': return { title: "7 - Daily Warehouse Picked Quantity", subtitle: "Daily quantity of items picked from warehouses segmented by Bonded Warehouse." };
            case 'delay_distribution': return { title: "Daily Delay Distribution by Carrier", subtitle: "Daily count of late shipments categorized by the responsible transport company." };
            case 'monthly_trend': return { title: "Monthly Performance & Volume", subtitle: "Tracking monthly shipment totals and delay counts." };
            case 'terminal_capacity': return { title: "Terminal Picking & Capacity", subtitle: "Current warehouse volume vs maximum reported storage capacity." };
            case 'bonded_flow': return { title: "Bonded Flow Analysis", subtitle: "Total containers placed in bonded area vs successfully picked units." };
            case 'bonded_inventory': return { title: "Arrived & Not Picked per Bonded Warehouse", subtitle: "Inventory levels: containers arrived but not yet picked up." };
            case 'carrier_leadtime': return { title: "Carrier Performance (Lead Time)", subtitle: "Average transit days from port departure to final warehouse delivery." };
            case 'romaneio_distribution': return { title: "Romaneio Status Distribution", subtitle: "Tracking of shipments with completed vs pending romaneios (Column BD)." };
            case 'cargo_ready_comparison': return { title: "Cargo Ready vs Delivered Comparison", subtitle: "Comparison between vessel arrivals (ATA), containers ready (Column Z), and units actually delivered per day." };
            case 'ramp_up_plan': return { title: "Inbound Capacity Ramp-Up Plan", subtitle: "Projection of arrivals showing actual vs estimated container volume per week." };
            default: return { title: "Chart", subtitle: "" };
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1 - Daily Volume */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('daily_volume').title}
                    subtitle={getChartMeta('daily_volume').subtitle}
                    headerRight={<div className="flex gap-2">
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Met</span>
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Missed</span>
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-indigo-500"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Weekend</span>
                    </div>}
                    height={350}
                    onMaximize={() => setMaximizedChart('daily_volume')}
                >
                    {renderChartContent('daily_volume')}
                </ChartContainer>
            </div>

            {/* 2 - Daily Goal Achievement */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('goal_achievement').title}
                    subtitle={getChartMeta('goal_achievement').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('goal_achievement')}
                >
                    {renderChartContent('goal_achievement')}
                </ChartContainer>
            </div>

            {/* 3 - Daily Volume Breakdown */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('carrier_breakdown').title}
                    subtitle={getChartMeta('carrier_breakdown').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('carrier_breakdown')}
                >
                    {renderChartContent('carrier_breakdown')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('cargo_ready_comparison').title} 
                    subtitle={getChartMeta('cargo_ready_comparison').subtitle}
                    headerRight={
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="accent-indigo-600 rounded" checked={inventoryOnly} onChange={(e) => setInventoryOnly(e.target.checked)} />
                                <span className="text-[10px] font-black uppercase text-slate-500">Show Inventory Only</span>
                            </label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button 
                                    onClick={() => setInventoryUnit('containers')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${inventoryUnit === 'containers' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Containers
                                </button>
                                <button 
                                    onClick={() => setInventoryUnit('bls')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${inventoryUnit === 'bls' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    BLs
                                </button>
                            </div>
                            <div className="w-[1px] h-6 bg-slate-200" />
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button 
                                    onClick={() => setCargoReadyViewMode('days')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${cargoReadyViewMode === 'days' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Days
                                </button>
                                <button 
                                    onClick={() => setCargoReadyViewMode('weeks')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${cargoReadyViewMode === 'weeks' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Weeks
                                </button>
                            </div>
                        </div>
                    }
                    height={400}
                    onMaximize={() => setMaximizedChart('cargo_ready_comparison')}
                >
                    {renderChartContent('cargo_ready_comparison')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('ramp_up_plan').title} 
                    subtitle={getChartMeta('ramp_up_plan').subtitle}
                    headerRight={
                        <div className="flex gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-500">Scenario (/day):</label>
                                <input 
                                    type="number" 
                                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={scenario}
                                    onChange={(e) => setScenario(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Qty"
                                />
                            </div>
                        </div>
                    }
                    height={400}
                    onMaximize={() => setMaximizedChart('ramp_up_plan')}
                >
                    {renderChartContent('ramp_up_plan')}
                </ChartContainer>
            </div>

            {/* 4 - Carrier Volume Share */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('volume_share').title}
                    subtitle={getChartMeta('volume_share').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('volume_share')}
                >
                    {renderChartContent('volume_share')}
                </ChartContainer>
            </div>

            {/* 5 - Depot Share Distribution */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('depot_distribution').title}
                    subtitle={getChartMeta('depot_distribution').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('depot_distribution')}
                >
                    {renderChartContent('depot_distribution')}
                </ChartContainer>
            </div>

            {/* 6 - Daily Depot Return */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('daily_depot_return').title}
                    subtitle={getChartMeta('daily_depot_return').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('daily_depot_return')}
                    headerRight={renderDepotStats()}
                >
                    {renderChartContent('daily_depot_return')}
                </ChartContainer>
            </div>

            {/* 7 - Daily Warehouse Picked */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('daily_warehouse_picked').title}
                    subtitle={getChartMeta('daily_warehouse_picked').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('daily_warehouse_picked')}
                    headerRight={renderWarehouseStats()}
                >
                    {renderChartContent('daily_warehouse_picked')}
                </ChartContainer>
            </div>

            {/* Secondary Charts */}
            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('delay_distribution').title}
                    subtitle={getChartMeta('delay_distribution').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('delay_distribution')}
                >
                    {renderChartContent('delay_distribution')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer
                    title={getChartMeta('monthly_trend').title}
                    subtitle={getChartMeta('monthly_trend').subtitle}
                    headerRight={<div className="bg-slate-900 text-white px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase">DELIVERED: {getSum(data.monthlyTrend)}</div>}
                    height={350}
                    onMaximize={() => setMaximizedChart('monthly_trend')}
                >
                    {renderChartContent('monthly_trend')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('terminal_capacity').title} 
                    subtitle={getChartMeta('terminal_capacity').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('terminal_capacity')}
                >
                    {renderChartContent('terminal_capacity')}
                </ChartContainer>
            </div>

            {/* New Flow Chart */}
            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('bonded_flow').title} 
                    subtitle={getChartMeta('bonded_flow').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('bonded_flow')}
                >
                    {renderChartContent('bonded_flow')}
                </ChartContainer>
            </div>

            {/* Arrived Not Picked Chart */}
            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('bonded_inventory').title} 
                    subtitle={getChartMeta('bonded_inventory').subtitle}
                    height={400}
                    onMaximize={() => setMaximizedChart('bonded_inventory')}
                >
                    {renderChartContent('bonded_inventory')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('carrier_leadtime').title} 
                    subtitle={getChartMeta('carrier_leadtime').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('carrier_leadtime')}
                >
                    {renderChartContent('carrier_leadtime')}
                </ChartContainer>
            </div>

            <div className="export-section lg:col-span-2">
                <ChartContainer 
                    title={getChartMeta('romaneio_distribution').title} 
                    subtitle={getChartMeta('romaneio_distribution').subtitle}
                    height={350}
                    onMaximize={() => setMaximizedChart('romaneio_distribution')}
                >
                    {renderChartContent('romaneio_distribution')}
                </ChartContainer>
            </div>

            {maximizedChart && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 sm:p-10 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-[1400px] h-full max-h-[850px] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <span className="material-icons text-indigo-600">analytics</span>
                                    {getChartMeta(maximizedChart).title}
                                </h2>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                    {getChartMeta(maximizedChart).subtitle}
                                </p>
                            </div>
                            <div className="flex items-center gap-6">
                                {maximizedChart === 'cargo_ready_comparison' && (
                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                                        <button 
                                            onClick={() => setCargoReadyViewMode('days')}
                                            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${cargoReadyViewMode === 'days' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Days
                                        </button>
                                        <button 
                                            onClick={() => setCargoReadyViewMode('weeks')}
                                            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${cargoReadyViewMode === 'weeks' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Weeks
                                        </button>
                                    </div>
                                )}
                                {maximizedChart === 'ramp_up_plan' && (
                                    <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Scenario (/day):</label>
                                            <input 
                                                type="number" 
                                                className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={scenario}
                                                onChange={(e) => setScenario(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="Qty"
                                            />
                                        </div>
                                    </div>
                                )}
                                {maximizedChart === 'daily_warehouse_picked' && renderWarehouseStats()}
                                {maximizedChart === 'daily_depot_return' && renderDepotStats()}
                                <button 
                                    onClick={() => setMaximizedChart(null)}
                                    className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 p-3 rounded-2xl transition-all shadow-sm"
                                >
                                    <span className="material-icons text-2xl">close</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-10 bg-slate-50/30 overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={1}>
                                {renderChartContent(maximizedChart, true) as React.ReactElement}
                            </ResponsiveContainer>
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center px-10">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Advanced Analysis Active</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setMaximizedChart(null)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all shadow-lg"
                            >
                                Close Visualization
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(ChartsGrid);
