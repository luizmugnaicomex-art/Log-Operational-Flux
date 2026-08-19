import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
  ReferenceArea
} from 'recharts';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  Ship,
  PackageCheck,
  CheckCircle2,
  SlidersHorizontal,
  Download,
  Maximize2,
  Minimize2,
  BarChart3,
  Activity,
  Calendar,
  Boxes,
  Anchor,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import { ChartData, Shipment } from '../types';

interface CargoReadyDeliveredAnalysisProps {
  data: ChartData;
  shipments?: Shipment[];
  onInventoryClick?: (data: any) => void;
  onCargoReadyInflowClick?: (data: any) => void;
  onDrainLineClick?: (data: any) => void;
  onVesselArrivalClick?: (data: any) => void;
  isStandalone?: boolean;
}

const getISOWeek = (date: Date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return { week: 1, year: 2026 };
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
};

export const CargoReadyDeliveredAnalysis: React.FC<CargoReadyDeliveredAnalysisProps> = ({
  data,
  shipments = [],
  onInventoryClick,
  onCargoReadyInflowClick,
  onDrainLineClick,
  onVesselArrivalClick,
  isStandalone = false
}) => {
  // Interactive UI State Controls
  const [granularity, setGranularity] = useState<'weeks' | 'days'>('weeks');
  const [metricUnit, setMetricUnit] = useState<'containers' | 'bls'>('containers');
  const [showInventoryOnly, setShowInventoryOnly] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [capacityThreshold, setCapacityThreshold] = useState<number>(1400); // 1350 - 1500 weekly baseline
  const [selectedPointForModal, setSelectedPointForModal] = useState<any | null>(null);

  // Process & Aggregate Chart Time Series
  const chartData = useMemo(() => {
    if (!data?.cargoReadyComparison || !Array.isArray(data.cargoReadyComparison) || data.cargoReadyComparison.length === 0) {
      return [];
    }

    if (granularity === 'days') {
      return data.cargoReadyComparison.map(day => {
        const d = day.date ? new Date(day.date) : new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = !isNaN(d.getTime()) ? days[d.getDay()] : '';
        const dayFormatted = !isNaN(d.getTime())
          ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
          : day.label;

        const isBottleneck = (day.readyCount || 0) > (day.deliveredCount || 0);
        const isCriticalBacklog = (day.runningBalance || 0) > 2000;

        return {
          ...day,
          displayLabel: `${dayName} ${dayFormatted}`,
          shortLabel: dayFormatted,
          isBottleneck,
          isCriticalBacklog,
          netDelta: (day.readyCount || 0) - (day.deliveredCount || 0),
          netDeltaBL: (day.readyCountBL || 0) - (day.deliveredCountBL || 0)
        };
      });
    }

    // Weekly Granularity Aggregation
    const weeklyMap = new Map<string, any>();

    data.cargoReadyComparison.forEach(day => {
      if (!day.date) return;
      const d = new Date(day.date);
      if (isNaN(d.getTime())) return;
      const { week, year } = getISOWeek(d);
      const weekKey = `W${week.toString().padStart(2, '0')} - ${year}`;

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          label: weekKey,
          displayLabel: weekKey,
          weekNum: week,
          year,
          date: d,
          readyCount: 0,
          deliveredCount: 0,
          ataCount: 0,
          runningBalance: 0,
          readyCountBL: 0,
          deliveredCountBL: 0,
          ataCountBL: 0,
          runningBalanceBL: 0,
          isWeekend: false,
          dayItems: []
        });
      }

      const weekEntry = weeklyMap.get(weekKey);
      if (d.getTime() > weekEntry.date.getTime()) {
        weekEntry.date = d;
      }

      weekEntry.readyCount += day.readyCount || 0;
      weekEntry.deliveredCount += day.deliveredCount || 0;
      weekEntry.ataCount += day.ataCount || 0;
      // Rolling inventory balance takes latest day's balance
      weekEntry.runningBalance = day.runningBalance || 0;
      weekEntry.readyCountBL += day.readyCountBL || 0;
      weekEntry.deliveredCountBL += day.deliveredCountBL || 0;
      weekEntry.ataCountBL += day.ataCountBL || 0;
      weekEntry.runningBalanceBL = day.runningBalanceBL || 0;
      weekEntry.dayItems.push(day);
    });

    const weeklyList = Array.from(weeklyMap.values()).sort((a, b) => {
      const orderA = a.year * 100 + a.weekNum;
      const orderB = b.year * 100 + b.weekNum;
      return orderA - orderB;
    });

    return weeklyList.map(w => {
      const isBottleneck = (w.readyCount || 0) > (w.deliveredCount || 0);
      const isCriticalBacklog = (w.runningBalance || 0) > 2000;
      return {
        ...w,
        isBottleneck,
        isCriticalBacklog,
        netDelta: (w.readyCount || 0) - (w.deliveredCount || 0),
        netDeltaBL: (w.readyCountBL || 0) - (w.deliveredCountBL || 0)
      };
    });
  }, [data?.cargoReadyComparison, granularity]);

  // Executive KPI Aggregations
  const summaryKpis = useMemo(() => {
    if (chartData.length === 0) {
      return {
        totalAta: 0,
        totalReady: 0,
        totalDelivered: 0,
        currentInventory: 0,
        drainEfficiency: 0,
        bottleneckPeriodsCount: 0,
        criticalBacklogPeriodsCount: 0,
        maxBacklog: 0,
        maxBacklogPeriod: 'N/A',
        equilibriumStatus: 'BALANCED'
      };
    }

    let totalAta = 0;
    let totalReady = 0;
    let totalDelivered = 0;
    let maxBacklog = 0;
    let maxBacklogPeriod = '';
    let bottleneckCount = 0;
    let criticalCount = 0;

    chartData.forEach(item => {
      const ata = metricUnit === 'bls' ? (item.ataCountBL || 0) : (item.ataCount || 0);
      const ready = metricUnit === 'bls' ? (item.readyCountBL || 0) : (item.readyCount || 0);
      const delivered = metricUnit === 'bls' ? (item.deliveredCountBL || 0) : (item.deliveredCount || 0);
      const balance = metricUnit === 'bls' ? (item.runningBalanceBL || 0) : (item.runningBalance || 0);

      totalAta += ata;
      totalReady += ready;
      totalDelivered += delivered;

      if (balance > maxBacklog) {
        maxBacklog = balance;
        maxBacklogPeriod = item.displayLabel || item.label;
      }

      if (ready > delivered) bottleneckCount++;
      if (balance > 2000) criticalCount++;
    });

    const latestItem = chartData[chartData.length - 1];
    const currentInventory = metricUnit === 'bls'
      ? (latestItem?.runningBalanceBL || 0)
      : (latestItem?.runningBalance || 0);

    const drainEfficiency = totalReady > 0
      ? Math.min(100, (totalDelivered / totalReady) * 100)
      : 100;

    let equilibriumStatus: 'BALANCED' | 'CONGESTION_RISK' | 'CRITICAL_BOTTLENECK' = 'BALANCED';
    if (currentInventory > 2000 || bottleneckCount > chartData.length * 0.4) {
      equilibriumStatus = 'CRITICAL_BOTTLENECK';
    } else if (totalReady > totalDelivered) {
      equilibriumStatus = 'CONGESTION_RISK';
    }

    return {
      totalAta,
      totalReady,
      totalDelivered,
      currentInventory,
      drainEfficiency: parseFloat(drainEfficiency.toFixed(1)),
      bottleneckPeriodsCount: bottleneckCount,
      criticalBacklogPeriodsCount: criticalCount,
      maxBacklog,
      maxBacklogPeriod,
      equilibriumStatus
    };
  }, [chartData, metricUnit]);

  // Handle drilldown click
  const handleDataPointDrilldown = (point: any) => {
    if (!point) return;
    if (onInventoryClick) {
      onInventoryClick(point);
    } else {
      setSelectedPointForModal(point);
    }
  };

  // Export dataset to CSV
  const handleExportCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const isBl = metricUnit === 'bls';
    const unitLabel = isBl ? 'BLs' : 'Containers';

    const headers = [
      'Period',
      `Vessel Arrivals (ATA) [${unitLabel}]`,
      `Cargo Ready (Inflow) [${unitLabel}]`,
      `Delivered (Drain) [${unitLabel}]`,
      `Remaining Balance (Inventory) [${unitLabel}]`,
      `Net Inflow-Drain Delta [${unitLabel}]`,
      'Status Alert'
    ];

    const rows = chartData.map(d => {
      const ata = isBl ? d.ataCountBL || 0 : d.ataCount || 0;
      const ready = isBl ? d.readyCountBL || 0 : d.readyCount || 0;
      const delivered = isBl ? d.deliveredCountBL || 0 : d.deliveredCount || 0;
      const balance = isBl ? d.runningBalanceBL || 0 : d.runningBalance || 0;
      const delta = ready - delivered;
      let status = 'Normal';
      if (balance > 2000) status = 'CRITICAL YARD CONGESTION';
      else if (ready > delivered) status = 'INFLOW BOTTLENECK';
      else if (delivered >= ready) status = 'DRAIN EQUILIBRIUM';

      return [
        `"${d.displayLabel || d.label}"`,
        ata,
        ready,
        delivered,
        balance,
        delta,
        `"${status}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cargo_Ready_vs_Delivered_${granularity}_${metricUnit}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Executive Tooltip Renderer
  const renderExecutiveTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const dataEntry = chartData.find(
      d => (d.displayLabel === label || d.label === label || d.shortLabel === label)
    ) || payload[0]?.payload;

    if (!dataEntry) return null;

    const isBl = metricUnit === 'bls';
    const ata = isBl ? (dataEntry.ataCountBL || 0) : (dataEntry.ataCount || 0);
    const ready = isBl ? (dataEntry.readyCountBL || 0) : (dataEntry.readyCount || 0);
    const delivered = isBl ? (dataEntry.deliveredCountBL || 0) : (dataEntry.deliveredCount || 0);
    const balance = isBl ? (dataEntry.runningBalanceBL || 0) : (dataEntry.runningBalance || 0);
    const delta = ready - delivered;
    const isBottleneck = ready > delivered;
    const isHighYard = balance > 2000;

    return (
      <div className="bg-slate-950/95 border border-slate-700/70 p-4 rounded-2xl shadow-2xl backdrop-blur-xl text-white min-w-[280px] max-w-[320px] ring-1 ring-white/10 pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="font-display font-black text-sm text-slate-100 tracking-tight">
              {dataEntry.displayLabel || label}
            </span>
          </div>
          {isHighYard ? (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> Yard Peak
            </span>
          ) : isBottleneck ? (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Inflow &gt; Drain
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Optimal Flow
            </span>
          )}
        </div>

        {/* Breakdown List */}
        <div className="space-y-2.5 text-xs">
          {!showInventoryOnly && (
            <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F87171] shadow-[0_0_8px_#F87171]"></span>
                <span className="font-bold text-slate-300 text-[11px]">Vessel Arrivals (ATA)</span>
              </div>
              <span className="font-display font-black text-sm text-[#F87171]">
                {ata.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{isBl ? 'BLs' : 'TEUs'}</span>
              </span>
            </div>
          )}

          {!showInventoryOnly && (
            <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] shadow-[0_0_8px_#FBBF24]"></span>
                <span className="font-bold text-slate-300 text-[11px]">Cargo Ready (Inflow)</span>
              </div>
              <span className="font-display font-black text-sm text-[#FBBF24]">
                {ready.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{isBl ? 'BLs' : 'TEUs'}</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]"></span>
              <span className="font-bold text-slate-300 text-[11px]">Delivered (Drain Line)</span>
            </div>
            <span className="font-display font-black text-sm text-[#10B981]">
              {delivered.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{isBl ? 'BLs' : 'TEUs'}</span>
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-purple-950/40 border border-purple-800/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] shadow-[0_0_10px_#8B5CF6]"></span>
              <span className="font-extrabold text-purple-200 text-[11px]">Remaining Yard Inventory</span>
            </div>
            <span className="font-display font-black text-sm text-[#A78BFA]">
              {balance.toLocaleString()} <span className="text-[10px] text-purple-300/70 font-normal">{isBl ? 'BLs' : 'TEUs'}</span>
            </span>
          </div>
        </div>

        {/* Delta Net Indicator */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
          <span className="text-slate-400 font-bold uppercase tracking-wider">Inflow / Drain Delta:</span>
          <span className={`font-mono font-black ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {delta > 0 ? `+${delta} Backlog` : delta < 0 ? `${delta} Drained` : '0 Balance'}
          </span>
        </div>

        {/* Quick Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDataPointDrilldown(dataEntry);
          }}
          className="mt-3.5 w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-2 px-3 rounded-xl text-center font-black text-[10px] uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer group"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-200 group-hover:rotate-12 transition-transform" />
          <span>Interact For Granular Data</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    );
  };

  const effectiveCapacity = granularity === 'weeks' ? capacityThreshold : Math.round(capacityThreshold / 7);

  return (
    <div
      className={`bg-white rounded-[2rem] border border-slate-200/80 shadow-xl overflow-hidden transition-all duration-300 ${
        isMaximized ? 'fixed inset-4 z-[999] bg-white shadow-2xl p-6 flex flex-col' : 'p-6 lg:p-8'
      }`}
    >
      {/* 1. Header & Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-black text-slate-900 tracking-tight uppercase">
                CARGO READY VS DELIVERED COMPARISON
              </h2>
              <p className="text-xs font-bold text-indigo-600 tracking-wide uppercase">
                Inflow, Drain &amp; Inventory Balance Analysis
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl pt-1">
            Visibility into weekly container inflows, customs clearance releases, actual factory discharge rates,
            and rolling inventory balance to predict yard saturation and capacity bottlenecks.
          </p>
        </div>

        {/* Interactive Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Show Inventory Only Toggle */}
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl cursor-pointer transition-colors text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={showInventoryOnly}
              onChange={(e) => setShowInventoryOnly(e.target.checked)}
              className="accent-indigo-600 rounded cursor-pointer w-4 h-4"
            />
            <span className="text-[11px] uppercase tracking-wider text-slate-600">Show Inventory Only</span>
          </label>

          {/* Metric Toggle: Containers (TEUs) vs BLs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-xs">
            <button
              onClick={() => setMetricUnit('containers')}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                metricUnit === 'containers'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Containers (TEUs)
            </button>
            <button
              onClick={() => setMetricUnit('bls')}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                metricUnit === 'bls'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              BLs (Bills)
            </button>
          </div>

          {/* Granularity Toggle: Days vs Weeks */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-xs">
            <button
              onClick={() => setGranularity('days')}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                granularity === 'days'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Days
            </button>
            <button
              onClick={() => setGranularity('weeks')}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                granularity === 'weeks'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Weeks
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Export time series to CSV"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore view" : "Maximize chart"}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Executive Alert & KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 my-2">
        {/* Metric 1: Current Inventory */}
        <div className="bg-slate-50/80 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-purple-600" /> Current Yard Stock
            </span>
            {summaryKpis.currentInventory > 2000 && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-black rounded-md">
                Congested
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-display font-black text-slate-900">
              {summaryKpis.currentInventory.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">
              {metricUnit === 'bls' ? 'BLs' : 'Units'}
            </span>
          </div>
        </div>

        {/* Metric 2: Drain Rate Efficiency */}
        <div className="bg-slate-50/80 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" /> Drain Velocity
            </span>
            <span className="text-emerald-700 font-bold text-[10px]">
              {summaryKpis.drainEfficiency}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-display font-black text-emerald-700">
              {summaryKpis.totalDelivered.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">
              / {summaryKpis.totalReady.toLocaleString()} Ready
            </span>
          </div>
        </div>

        {/* Metric 3: Peak Yard Congestion */}
        <div className="bg-slate-50/80 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Peak Inventory Peak
            </span>
            <span className="text-[10px] font-bold text-slate-400 truncate max-w-[80px]">
              {summaryKpis.maxBacklogPeriod}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-display font-black text-amber-600">
              {summaryKpis.maxBacklog.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">
              Max Level
            </span>
          </div>
        </div>

        {/* Metric 4: Capacity Equilibrium Status */}
        <div className="bg-slate-50/80 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" /> Target Capacity
            </span>
            <span className="text-indigo-600 font-bold text-[10px]">
              {effectiveCapacity.toLocaleString()}/
              {granularity === 'weeks' ? 'wk' : 'd'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                summaryKpis.equilibriumStatus === 'BALANCED'
                  ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]'
                  : summaryKpis.equilibriumStatus === 'CONGESTION_RISK'
                  ? 'bg-amber-500 shadow-[0_0_8px_#F59E0B]'
                  : 'bg-red-500 shadow-[0_0_8px_#EF4444] animate-pulse'
              }`}
            />
            <span className="text-xs font-display font-black text-slate-800 uppercase tracking-tight">
              {summaryKpis.equilibriumStatus === 'BALANCED'
                ? 'Equilibrium Safe'
                : summaryKpis.equilibriumStatus === 'CONGESTION_RISK'
                ? 'Inflow Alert'
                : 'Saturation Warning'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Capacity Threshold Selector Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/60 p-2.5 px-4 rounded-xl border border-slate-200/50 mb-4">
        <div className="flex items-center gap-2 text-slate-600 font-bold text-[11px]">
          <span className="text-slate-400 uppercase font-black tracking-wider">Equilibrium Threshold:</span>
          <span className="font-mono font-black text-slate-800">
            {effectiveCapacity.toLocaleString()} {metricUnit === 'bls' ? 'BLs' : 'TEUs'} / {granularity === 'weeks' ? 'Week' : 'Day'}
          </span>
          <span className="text-slate-400 font-normal">
            (Baseline operational capacity for factory drain)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Preset:</span>
          {[1200, 1350, 1400, 1500].map((preset) => (
            <button
              key={preset}
              onClick={() => setCapacityThreshold(preset)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                capacityThreshold === preset
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Chart Visualization Area */}
      <div className={`w-full ${isMaximized ? 'flex-1 min-h-[420px]' : 'h-[440px] sm:h-[480px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 25, right: 25, left: 10, bottom: granularity === 'weeks' ? 35 : 55 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                handleDataPointDrilldown(state.activePayload[0].payload);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <defs>
              <linearGradient id="coralBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F87171" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="amberBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="inventoryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

            <XAxis
              dataKey="displayLabel"
              tick={(tickProps: any) => {
                const { x, y, payload } = tickProps;
                const entry = chartData.find(d => d.displayLabel === payload.value || d.label === payload.value);
                const isWeekend = entry?.isWeekend;
                const isBottleneck = entry?.isBottleneck;

                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="middle"
                      fill={isWeekend ? "#6366F1" : isBottleneck ? "#D97706" : "#475569"}
                      fontSize={isMaximized ? 11 : 9}
                      fontWeight={isBottleneck ? 800 : 600}
                    >
                      {payload.value}
                    </text>
                  </g>
                );
              }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={granularity === 'days' ? -35 : 0}
              textAnchor={granularity === 'days' ? 'end' : 'middle'}
            />

            <YAxis
              stroke="#94A3B8"
              tick={{ fontSize: isMaximized ? 11 : 9, fontWeight: 700, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip content={renderExecutiveTooltip} />

            <Legend
              wrapperStyle={{
                fontSize: isMaximized ? '12px' : '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                paddingTop: '25px'
              }}
            />

            {/* Equilibrium / Baseline Capacity Reference Line */}
            <ReferenceLine
              y={effectiveCapacity}
              stroke="#64748B"
              strokeDasharray="4 4"
              strokeWidth={2}
            >
              <LabelList
                value={`Equilibrium Capacity: ${effectiveCapacity.toLocaleString()}`}
                position="right"
                fill="#475569"
                fontSize={isMaximized ? 11 : 9}
                fontWeight={900}
              />
            </ReferenceLine>

            {/* Critical Yard Saturation Warning Line at 2,000 TEUs */}
            <ReferenceLine
              y={2000}
              stroke="#DC2626"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: 'Yard Saturation Limit (2,000 TEUs)',
                position: 'insideTopLeft',
                fill: '#DC2626',
                fontSize: 10,
                fontWeight: 800
              }}
            />

            {/* 1. Vessel Arrivals (ATA) [Containers / BLs] - Soft Red / Coral (#F87171) */}
            {!showInventoryOnly && (
              <Bar
                dataKey={metricUnit === 'bls' ? 'ataCountBL' : 'ataCount'}
                name={`Vessel Arrivals (ATA) [${metricUnit === 'bls' ? 'BLs' : 'Containers'}]`}
                fill="url(#coralBarGrad)"
                radius={[6, 6, 0, 0]}
                opacity={0.85}
                onClick={(d) => onVesselArrivalClick?.(d)}
                style={{ cursor: onVesselArrivalClick ? 'pointer' : 'default' }}
              >
                <LabelList
                  dataKey={metricUnit === 'bls' ? 'ataCountBL' : 'ataCount'}
                  position="top"
                  fontSize={isMaximized ? 11 : 9}
                  fill="#991B1B"
                  fontWeight={900}
                  formatter={(val: number) => (val > 0 ? val : '')}
                />
              </Bar>
            )}

            {/* 2. Cargo Ready (Inflow) [Containers / BLs] - Warm Orange / Amber (#FBBF24) */}
            {!showInventoryOnly && (
              <Bar
                dataKey={metricUnit === 'bls' ? 'readyCountBL' : 'readyCount'}
                name={`Cargo Ready (Inflow) [${metricUnit === 'bls' ? 'BLs' : 'Containers'}]`}
                fill="url(#amberBarGrad)"
                radius={[6, 6, 0, 0]}
                opacity={0.85}
                onClick={(d) => onCargoReadyInflowClick?.(d)}
                style={{ cursor: onCargoReadyInflowClick ? 'pointer' : 'default' }}
              >
                <LabelList
                  dataKey={metricUnit === 'bls' ? 'readyCountBL' : 'readyCount'}
                  position="top"
                  fontSize={isMaximized ? 11 : 9}
                  fill="#92400E"
                  fontWeight={900}
                  formatter={(val: number) => (val > 0 ? val : '')}
                />
              </Bar>
            )}

            {/* 3. Remaining Balance (Inventory) - Purple / Violet (#8B5CF6) */}
            <Line
              type="stepAfter"
              dataKey={metricUnit === 'bls' ? 'runningBalanceBL' : 'runningBalance'}
              name={`Remaining Balance (Inventory) [${metricUnit === 'bls' ? 'BLs' : 'Containers'}]`}
              stroke="#8B5CF6"
              strokeWidth={showInventoryOnly ? 4 : 2.5}
              strokeDasharray={showInventoryOnly ? undefined : "5 5"}
              dot={{ r: showInventoryOnly ? 6 : 4, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{
                r: 9,
                fill: '#7C3AED',
                stroke: '#DDD6FE',
                strokeWidth: 4,
                cursor: 'pointer',
                onClick: (e, payload: any) => handleDataPointDrilldown(payload.payload)
              }}
              onClick={(d) => {
                if (d && d.payload) handleDataPointDrilldown(d.payload);
                else handleDataPointDrilldown(d);
              }}
              style={{
                cursor: 'pointer',
                filter: showInventoryOnly ? 'drop-shadow(0px 4px 8px rgba(139, 92, 246, 0.4))' : 'none'
              }}
            >
              <LabelList
                dataKey={metricUnit === 'bls' ? 'runningBalanceBL' : 'runningBalance'}
                position="top"
                offset={10}
                fontSize={isMaximized ? 11 : 9}
                fill="#6D28D9"
                fontWeight={900}
                formatter={(val: number) => (val > 0 ? val : '')}
              />
            </Line>

            {/* 4. Drain Line (Delivered Trend) - Vibrant Green (#10B981) */}
            <Line
              type="monotone"
              dataKey={metricUnit === 'bls' ? 'deliveredCountBL' : 'deliveredCount'}
              name={`Drain Line (Delivered Trend) [${metricUnit === 'bls' ? 'BLs' : 'Containers'}]`}
              stroke="#10B981"
              strokeWidth={showInventoryOnly ? 3 : 2.5}
              opacity={showInventoryOnly ? 0.35 : 1}
              dot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 8, fill: '#059669', stroke: '#A7F3D0', strokeWidth: 3 }}
              onClick={(d) => onDrainLineClick?.(d)}
              style={{ cursor: onDrainLineClick ? 'pointer' : 'default' }}
            >
              {!showInventoryOnly && (
                <LabelList
                  dataKey={metricUnit === 'bls' ? 'deliveredCountBL' : 'deliveredCount'}
                  position="bottom"
                  offset={10}
                  fontSize={isMaximized ? 11 : 9}
                  fill="#047857"
                  fontWeight={900}
                  formatter={(val: number) => (val > 0 ? val : '')}
                />
              )}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Executive Legend & Diagnostic Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-black text-slate-400 uppercase tracking-wider text-[10px]">Data Series:</span>
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="w-3 h-3 rounded-md bg-[#F87171]"></span> Vessel Arrivals (ATA)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="w-3 h-3 rounded-md bg-[#FBBF24]"></span> Cargo Ready (Inflow)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="w-3 h-1 bg-[#10B981] rounded-full"></span> Drain Line (Delivered)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="w-3 h-1 bg-[#8B5CF6] border-b border-dashed border-[#8B5CF6]"></span> Yard Inventory Balance
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Click any chart bar/point to trigger granular container manifest</span>
        </div>
      </div>
    </div>
  );
};
