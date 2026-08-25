import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import { 
  Calendar, 
  Download, 
  Layers, 
  SlidersHorizontal, 
  Maximize2, 
  Minimize2,
  Info,
  Ship,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';

interface CargoVolumeAnnualChartProps {
  shipments: Shipment[];
  onMonthClick?: (monthData: { monthIndex: number; monthName: string; year: string; shipments: Shipment[] }) => void;
  className?: string;
}

interface BondedBreakdownItem {
  count: number;
  bls: Set<string>;
  color: string;
  name: string;
}

interface MonthData {
  index: number;
  name: string;
  totalCount: number;
  totalBLs: number;
  bondedBreakdown: Record<string, BondedBreakdownItem>;
  shipmentsList: Shipment[];
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

// Portuguese month names matching the reference screenshot
const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Color palette mapping strictly matching the user screenshot
const BONDED_COLOR_MAP: Record<string, { color: string; bgClass: string; borderClass: string; label: string }> = {
  'intermaritima': { color: '#22C55E', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500', label: 'Intermarítima' },
  'intermarítima': { color: '#22C55E', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500', label: 'Intermarítima' },
  'tpc': { color: '#38BDF8', bgClass: 'bg-sky-400', borderClass: 'border-sky-400', label: 'TPC' },
  'tecon': { color: '#EF4444', bgClass: 'bg-rose-500', borderClass: 'border-rose-500', label: 'TECON' },
  'tecon salvador': { color: '#EF4444', bgClass: 'bg-rose-500', borderClass: 'border-rose-500', label: 'TECON Salvador' },
  'tecon santos': { color: '#EF4444', bgClass: 'bg-rose-500', borderClass: 'border-rose-500', label: 'TECON Santos' },
  'clia emporio': { color: '#F59E0B', bgClass: 'bg-amber-400', borderClass: 'border-amber-400', label: 'CLIA Empório' },
  'clia empório': { color: '#F59E0B', bgClass: 'bg-amber-400', borderClass: 'border-amber-400', label: 'CLIA Empório' },
  'emporio': { color: '#F59E0B', bgClass: 'bg-amber-400', borderClass: 'border-amber-400', label: 'CLIA Empório' },
  'empório': { color: '#F59E0B', bgClass: 'bg-amber-400', borderClass: 'border-amber-400', label: 'CLIA Empório' },
  'teca': { color: '#A855F7', bgClass: 'bg-purple-500', borderClass: 'border-purple-500', label: 'TECA' },
  'sem info desembaraço': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'SEM INFO DESEMBARAÇO' },
  'sem info desembaraço ': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'SEM INFO DESEMBARAÇO' },
  'sem info': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'SEM INFO DESEMBARAÇO' },
  'sem informação desembaraço': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'SEM INFO DESEMBARAÇO' },
  'sem desembaraço': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'SEM INFO DESEMBARAÇO' },
  'dta': { color: '#14B8A6', bgClass: 'bg-teal-500', borderClass: 'border-teal-500', label: 'DTA' },
  'dta pátio': { color: '#14B8A6', bgClass: 'bg-teal-500', borderClass: 'border-teal-500', label: 'DTA' },
  'n/a': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'N/A' },
  'cleared': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'N/A' },
  'unassigned': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'N/A' },
  'not assigned': { color: '#64748B', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', label: 'N/A' }
};

const FALLBACK_COLORS = [
  '#EC4899', '#14B8A6', '#6366F1', '#F97316', '#84CC16', '#06B6D4', '#E11D48', '#8B5CF6'
];

export const CargoVolumeAnnualChart: React.FC<CargoVolumeAnnualChartProps> = ({
  shipments = [],
  onMonthClick,
  className = ''
}) => {
  // 1. Interactive States
  const [metricUnit, setMetricUnit] = useState<'containers' | 'bls'>('containers');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [hiddenBondedAreas, setHiddenBondedAreas] = useState<Record<string, boolean>>({});
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // 2. Discover available Years from ETA / ATA dates
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    shipments.forEach(s => {
      if (!s) return;
      const etaDate = s.ata || s.estimatedDelivery;
      if (etaDate && isValidDate(etaDate)) {
        yearsSet.add(String(etaDate.getFullYear()));
      }
    });
    const sorted = Array.from(yearsSet).sort();
    return sorted;
  }, [shipments]);

  // Set default active year if not yet set
  React.useEffect(() => {
    if (availableYears.length > 0 && selectedYear === 'All') {
      // Find the year with the highest number of records
      const countsByYear: Record<string, number> = {};
      shipments.forEach(s => {
        const etaDate = s?.ata || s?.estimatedDelivery;
        if (etaDate && isValidDate(etaDate)) {
          const yr = String(etaDate.getFullYear());
          countsByYear[yr] = (countsByYear[yr] || 0) + 1;
        }
      });
      const topYear = Object.entries(countsByYear).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topYear) {
        setSelectedYear(topYear);
      }
    }
  }, [availableYears, shipments, selectedYear]);

  // 3. Normalizer and Color Getter for Bonded Warehouse names
  const getBondedMeta = (rawName: string) => {
    const clean = (rawName || 'N/A').trim();
    const key = clean.toLowerCase();
    
    // Check exact match
    if (BONDED_COLOR_MAP[key]) {
      return { ...BONDED_COLOR_MAP[key], originalName: clean };
    }

    // Check specific "sem info" or "desembaraço" keywords for gray color
    if (key.includes('sem info') || key.includes('desembaraço') || key.includes('desembaraco') || key.includes('sem informação') || key.includes('sem informacao')) {
      return {
        color: '#64748B',
        bgClass: 'bg-slate-500',
        borderClass: 'border-slate-500',
        label: 'SEM INFO DESEMBARAÇO',
        originalName: clean
      };
    }

    // Check intermaritima
    if (key.includes('intermaritima') || key.includes('intermarítima')) {
      return {
        color: '#22C55E',
        bgClass: 'bg-emerald-500',
        borderClass: 'border-emerald-500',
        label: 'Intermarítima',
        originalName: clean
      };
    }

    // Check tpc
    if (key === 'tpc' || key.startsWith('tpc ') || key.includes(' tpc')) {
      return {
        color: '#38BDF8',
        bgClass: 'bg-sky-400',
        borderClass: 'border-sky-400',
        label: 'TPC',
        originalName: clean
      };
    }

    // Check tecon
    if (key.includes('tecon')) {
      return {
        color: '#EF4444',
        bgClass: 'bg-rose-500',
        borderClass: 'border-rose-500',
        label: 'TECON',
        originalName: clean
      };
    }

    // Check emporio
    if (key.includes('emporio') || key.includes('empório') || key.includes('clia')) {
      return {
        color: '#F59E0B',
        bgClass: 'bg-amber-400',
        borderClass: 'border-amber-400',
        label: 'CLIA Empório',
        originalName: clean
      };
    }

    // Check teca
    if (key.includes('teca')) {
      return {
        color: '#A855F7',
        bgClass: 'bg-purple-500',
        borderClass: 'border-purple-500',
        label: 'TECA',
        originalName: clean
      };
    }

    // Check dta
    if (key.includes('dta')) {
      return {
        color: '#14B8A6',
        bgClass: 'bg-teal-500',
        borderClass: 'border-teal-500',
        label: 'DTA',
        originalName: clean
      };
    }

    // Dynamic hash color for unmapped warehouses
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
    return {
      color,
      bgClass: 'bg-indigo-500',
      borderClass: 'border-indigo-500',
      label: clean,
      originalName: clean
    };
  };

  // 4. Discover all distinct Bonded Areas across the dataset
  const allBondedAreas = useMemo(() => {
    const map = new Map<string, { label: string; color: string; count: number }>();
    
    // Priority order matching reference layout
    const standardOrder = ['Intermarítima', 'TPC', 'TECON', 'CLIA Empório', 'SEM INFO DESEMBARAÇO', 'N/A', 'TECA', 'DTA'];
    
    shipments.forEach(s => {
      if (!s) return;
      const raw = s.bondedWarehouse || 'N/A';
      const meta = getBondedMeta(raw);
      const label = meta.label;
      if (!map.has(label)) {
        map.set(label, { label, color: meta.color, count: 0 });
      }
      map.get(label)!.count++;
    });

    // Ensure standard keys exist even if zero count
    standardOrder.forEach(name => {
      const meta = getBondedMeta(name);
      if (!map.has(meta.label)) {
        map.set(meta.label, { label: meta.label, color: meta.color, count: 0 });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const idxA = standardOrder.indexOf(a.label);
      const idxB = standardOrder.indexOf(b.label);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return b.count - a.count;
    });

    return list;
  }, [shipments]);

  // 5. Aggregate 12 Months Data with Bonded Area Breakdown
  const monthlyData: MonthData[] = useMemo(() => {
    // 12 Months structure (0 to 11)
    const months: MonthData[] = PT_MONTHS.map((name, index) => ({
      index,
      name,
      totalCount: 0,
      totalBLs: 0,
      bondedBreakdown: {} as Record<string, BondedBreakdownItem>,
      shipmentsList: [] as Shipment[]
    }));

    shipments.forEach(s => {
      if (!s) return;
      const etaDate = s.ata || s.estimatedDelivery;
      if (!etaDate || !isValidDate(etaDate)) return;

      const yearStr = String(etaDate.getFullYear());
      if (selectedYear !== 'All' && yearStr !== selectedYear) return;

      const monthIdx = etaDate.getMonth(); // 0 - 11
      if (monthIdx < 0 || monthIdx > 11) return;

      const targetMonth = months[monthIdx];
      const rawBonded = s.bondedWarehouse || 'N/A';
      const meta = getBondedMeta(rawBonded);
      const bondedKey = meta.label;

      if (hiddenBondedAreas[bondedKey]) return; // Skip if filtered out from legend

      if (!targetMonth.bondedBreakdown[bondedKey]) {
        targetMonth.bondedBreakdown[bondedKey] = {
          count: 0,
          bls: new Set<string>(),
          color: meta.color,
          name: bondedKey
        };
      }

      targetMonth.totalCount++;
      targetMonth.bondedBreakdown[bondedKey].count++;
      if (s.billOfLading) {
        targetMonth.bondedBreakdown[bondedKey].bls.add(s.billOfLading);
      }
      targetMonth.shipmentsList.push(s);
    });

    // Compute unique BLs per month
    months.forEach(m => {
      const allBls = new Set<string>();
      Object.values(m.bondedBreakdown).forEach(b => {
        b.bls.forEach(bl => allBls.add(bl));
      });
      m.totalBLs = allBls.size;
    });

    return months;
  }, [shipments, selectedYear, hiddenBondedAreas]);

  // Maximum value for scaling the capsule bar height
  const maxMonthValue = useMemo(() => {
    let max = 0;
    monthlyData.forEach(m => {
      const val = metricUnit === 'bls' ? m.totalBLs : m.totalCount;
      if (val > max) max = val;
    });
    return max > 0 ? max : 1000;
  }, [monthlyData, metricUnit]);

  // Total Annual Volume across selected year
  const totalAnnualVolume = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + (metricUnit === 'bls' ? m.totalBLs : m.totalCount), 0);
  }, [monthlyData, metricUnit]);

  // Toggle hiding a bonded area via legend
  const toggleBondedArea = (label: string) => {
    setHiddenBondedAreas(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Export 12-Month Matrix to CSV
  const handleExportCSV = () => {
    const isBl = metricUnit === 'bls';
    const unitLabel = isBl ? 'BLs' : 'Containers';
    const bondedHeaders = allBondedAreas.map(b => b.label);
    
    const headers = [
      'Mês',
      `Total ${unitLabel}`,
      ...bondedHeaders.map(h => `${h} [${unitLabel}]`)
    ];

    const rows = monthlyData.map(m => {
      const total = isBl ? m.totalBLs : m.totalCount;
      const bondedVals = bondedHeaders.map(bh => {
        const entry = m.bondedBreakdown[bh];
        if (!entry) return 0;
        return isBl ? entry.bls.size : entry.count;
      });
      return [`"${m.name}"`, total, ...bondedVals];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cargo_Volume_ETA_Arrivals_${selectedYear}_${metricUnit}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`bg-[#0B1120] text-white rounded-[2.5rem] border border-slate-800 shadow-2xl p-6 sm:p-8 lg:p-10 relative overflow-hidden transition-all duration-300 ${
        isMaximized ? 'fixed inset-4 z-[999] bg-[#0B1120] p-8 flex flex-col justify-between overflow-y-auto' : ''
      } ${className}`}
    >
      {/* Background Glow Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-8 border-b border-slate-800/80 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white flex items-center gap-2">
                Cargo Volume
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                ETA Arrivals by Bonded Area &bull; Annual Operational Flow
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Switcher */}
          {availableYears.length > 0 && (
            <div className="flex items-center bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5">Ano:</span>
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
              <button
                onClick={() => setSelectedYear('All')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  selectedYear === 'All'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
            </div>
          )}

          {/* Metric Toggle: Containers vs BLs */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl">
            <button
              onClick={() => setMetricUnit('containers')}
              className={`px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                metricUnit === 'containers'
                  ? 'bg-sky-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CNTRs
            </button>
            <button
              onClick={() => setMetricUnit('bls')}
              className={`px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                metricUnit === 'bls'
                  ? 'bg-sky-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BLs
            </button>
          </div>

          {/* Total Annual Count Badge */}
          <div className="px-3.5 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Ano:</span>
            <span className="font-display font-black text-emerald-400 text-sm">
              {totalAnnualVolume.toLocaleString()}
            </span>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            title="Exportar dados do gráfico para CSV"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restaurar visualização" : "Maximizar gráfico"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors cursor-pointer"
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Capsule Bar Visualization Grid (12 Months) */}
      <div className="py-8 relative z-10">
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 md:gap-3.5 items-end justify-between min-h-[340px] sm:min-h-[380px]">
          {monthlyData.map((month, idx) => {
            const isBl = metricUnit === 'bls';
            const total = isBl ? month.totalBLs : month.totalCount;
            const isHovered = hoveredMonthIndex === idx;

            // Height percentage of the filled stacked bar inside the capsule track
            // Max height is 88% to ensure visual margin at top
            const fillHeightPct = maxMonthValue > 0 ? (total / maxMonthValue) * 88 : 0;

            // Calculate stacked segments from bottom to top
            const breakdownEntries = Object.entries(month.bondedBreakdown).map(([name, data]) => {
              const count = isBl ? data.bls.size : data.count;
              const share = total > 0 ? (count / total) * 100 : 0;
              return {
                name,
                count,
                share,
                color: data.color
              };
            });

            return (
              <div
                key={month.name}
                className="flex flex-col items-center group relative cursor-pointer"
                onMouseEnter={() => setHoveredMonthIndex(idx)}
                onMouseLeave={() => setHoveredMonthIndex(null)}
                onClick={() => {
                  if (onMonthClick) {
                    onMonthClick({
                      monthIndex: month.index,
                      monthName: month.name,
                      year: selectedYear,
                      shipments: month.shipmentsList
                    });
                  }
                }}
              >
                {/* 1. Value on Top of Bar (Matching Screenshot) */}
                <div className="mb-2 text-center h-6 flex items-center justify-center">
                  <span
                    className={`font-display font-black text-xs sm:text-sm tracking-tight transition-all duration-200 ${
                      total > 0
                        ? isHovered
                          ? 'text-emerald-400 scale-110'
                          : 'text-white'
                        : 'text-slate-600 font-semibold'
                    }`}
                  >
                    {total}
                  </span>
                </div>

                {/* 2. Vertical Capsule Pill Track */}
                <div
                  className={`w-full max-w-[28px] sm:max-w-[34px] md:max-w-[42px] lg:max-w-[48px] h-[220px] sm:h-[260px] md:h-[280px] rounded-full bg-[#0e172a] border border-slate-800/80 relative flex flex-col justify-end overflow-hidden p-0.5 shadow-inner transition-all duration-300 ${
                    isHovered
                      ? 'border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/50'
                      : 'hover:border-slate-700'
                  }`}
                >
                  {/* Subtle inner track background glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-transparent pointer-events-none rounded-full" />

                  {/* Filled Stacked Container (proportionally sized) */}
                  {total > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, fillHeightPct)}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full rounded-full overflow-hidden flex flex-col justify-end relative shadow-lg"
                    >
                      {/* Stacked colored segments by bonded area */}
                      {breakdownEntries.map((seg, sIdx) => {
                        return (
                          <div
                            key={seg.name}
                            style={{
                              height: `${seg.share}%`,
                              backgroundColor: seg.color
                            }}
                            className="w-full transition-opacity hover:opacity-90 relative"
                            title={`${seg.name}: ${seg.count} (${seg.share.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Minimal indicator if zero volume */}
                  {total === 0 && (
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mb-1 opacity-60" />
                  )}
                </div>

                {/* 3. Month Name below (Matching Screenshot) */}
                <div className="mt-3 text-center w-full">
                  <span
                    className={`block text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-tight truncate transition-colors duration-200 ${
                      isHovered
                        ? 'text-indigo-300 font-black'
                        : total > 0
                        ? 'text-slate-300'
                        : 'text-slate-600'
                    }`}
                    title={month.name}
                  >
                    {month.name}
                  </span>
                </div>

                {/* 4. Interactive Floating Tooltip on Hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-3 z-50 pointer-events-none"
                    >
                      <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl text-white min-w-[210px] text-xs ring-1 ring-white/10">
                        {/* Tooltip Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                          <div className="flex items-center gap-1.5 font-display font-black text-slate-100">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{month.name} {selectedYear !== 'All' ? selectedYear : ''}</span>
                          </div>
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            {total} <span className="text-[9px] text-slate-400 font-normal">{isBl ? 'BLs' : 'TEUs'}</span>
                          </span>
                        </div>

                        {/* Breakdown per Bonded Warehouse */}
                        {breakdownEntries.length > 0 ? (
                          <div className="space-y-1.5">
                            {breakdownEntries.map((seg) => (
                              <div key={seg.name} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: seg.color }}
                                  />
                                  <span className="text-slate-300 truncate max-w-[110px]" title={seg.name}>
                                    {seg.name}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-100">
                                  {seg.count} <span className="text-[9px] text-slate-500 font-normal">({seg.share.toFixed(0)}%)</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">Sem chegadas registradas</p>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[9px] text-indigo-300 font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Clique para detalhar</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Legend at Bottom (Matching Reference Screenshot) */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {allBondedAreas.map((area) => {
            const isHidden = hiddenBondedAreas[area.label];
            return (
              <button
                key={area.label}
                onClick={() => toggleBondedArea(area.label)}
                title={`Clique para ${isHidden ? 'exibir' : 'ocultar'} ${area.label}`}
                className={`flex items-center gap-2 cursor-pointer transition-all ${
                  isHidden ? 'opacity-35 line-through' : 'opacity-100 hover:scale-105'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{
                    backgroundColor: area.color,
                    boxShadow: isHidden ? 'none' : `0 0 8px ${area.color}80`
                  }}
                />
                <span className="font-bold text-slate-200 text-[11px] sm:text-xs">
                  {area.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Distribuição mensal consolidada por recinto alfandegado (ETA/ATA)</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CargoVolumeAnnualChart);
