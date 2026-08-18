import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import { currencyFormatter } from '../utils/formatters';
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
  Pie
} from 'recharts';
import { 
  Ship, 
  Anchor, 
  BarChart3, 
  PieChart as PieIcon, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Download, 
  Calendar,
  ArrowUpDown,
  X,
  ChevronRight,
  ShieldAlert,
  Boxes,
  FileText
} from 'lucide-react';

interface ShipownersViewProps {
  shipments: Shipment[];
}

interface ShipownerStatItem {
  name: string;
  totalContainers: number;
  deliveredCount: number;
  inTransitCount: number;
  atPortCount: number;
  clearedCount: number;
  onTimeCount: number;
  onTimeEligible: number;
  demurrageCost: number;
  demurrageCount: number;
  leadTimeSum: number;
  leadTimeCount: number;
  vessels: Set<string>;
  cargos: Set<string>;
  shipments: Shipment[];
}

interface EnhancedShipownerStat extends ShipownerStatItem {
  sharePct: number;
  onTimePct: number;
  avgLeadTime: number;
  vesselCount: number;
  cargoCount: number;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

// Format currency using the Intl.NumberFormat object
const formatUSD = (val: number): string => {
  return currencyFormatter.format(val || 0);
};

// Distinctive luxury color palette for maritime shipping lines
const SHIPOWNER_COLORS: Record<string, string> = {
  'MSC': '#F59E0B',        // Amber / MSC Gold
  'COSCO': '#3B82F6',      // Blue / Cosco Ocean Blue
  'CMA CGM': '#EF4444',    // Red / CMA Red
  'CMA': '#EF4444',
  'MAERSK': '#06B6D4',    // Cyan / Maersk Sky
  'HAPAG': '#F97316',      // Orange / Hapag Orange
  'HAPAG-LLOYD': '#F97316',
  'ONE': '#EC4899',        // Magenta / ONE Magenta
  'ZIM': '#8B5CF6',        // Purple / Zim
  'EVERGREEN': '#10B981',  // Emerald / Evergreen Green
  'YANG MING': '#6366F1',  // Indigo
  'PIL': '#14B8A6',        // Teal
  'OTHER': '#64748B',      // Slate
  'UNKNOWN': '#94A3B8'
};

const getColorForShipowner = (name: string, index: number = 0): string => {
  const upper = (name || '').trim().toUpperCase();
  for (const [key, color] of Object.entries(SHIPOWNER_COLORS)) {
    if (upper.includes(key)) return color;
  }
  const fallbackColors = ['#4F46E5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
  return fallbackColors[index % fallbackColors.length];
};

export const ShipownersView: React.FC<ShipownersViewProps> = ({ shipments = [] }) => {
  const [selectedShipownerFilter, setSelectedShipownerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedIncoterm, setSelectedIncoterm] = useState<string>('ALL');
  
  // Drill-down Modal State
  const [modalShipowner, setModalShipowner] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPage, setModalPage] = useState<number>(1);
  const modalItemsPerPage = 25;

  const [sortConfig, setSortConfig] = useState<{ key: keyof EnhancedShipownerStat; direction: 'asc' | 'desc' }>({
    key: 'totalContainers',
    direction: 'desc'
  });

  // Extract Years, Months, and Incoterms for quick scoped filtering
  const { availableYears, availableMonths, availableIncoterms } = useMemo(() => {
    const years = new Set<string>();
    const months = new Set<string>();
    const incoterms = new Set<string>();
    shipments.forEach(s => {
      const d = s.deliveryByd || s.ata || s.estimatedDelivery;
      if (d && isValidDate(d)) {
        years.add(String(d.getFullYear()));
        months.add(String(d.getMonth() + 1).padStart(2, '0'));
      }
      if (s.incoterm && s.incoterm.trim()) {
        const inco = s.incoterm.trim().toUpperCase();
        if (inco !== '0' && inco !== 'N/A' && inco !== 'NULL' && inco !== '-') {
          incoterms.add(inco);
        }
      }
    });
    return {
      availableYears: Array.from(years).sort((a, b) => b.localeCompare(a)),
      availableMonths: Array.from(months).sort(),
      availableIncoterms: Array.from(incoterms).sort()
    };
  }, [shipments]);

  // Filter shipments based on temporal, incoterm and status filters
  const timeFilteredShipments = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    return shipments.filter(s => {
      if (!s) return false;
      const d = s.deliveryByd || s.ata || s.estimatedDelivery;
      if (selectedYear !== 'ALL') {
        if (!d || !isValidDate(d) || String(d.getFullYear()) !== selectedYear) return false;
      }
      if (selectedMonth !== 'ALL') {
        if (!d || !isValidDate(d) || String(d.getMonth() + 1).padStart(2, '0') !== selectedMonth) return false;
      }
      if (selectedIncoterm !== 'ALL') {
        const inco = (s.incoterm || '').trim().toUpperCase();
        if (inco !== selectedIncoterm) return false;
      }
      return true;
    });
  }, [shipments, selectedYear, selectedMonth, selectedIncoterm]);

  // Aggregate comprehensive stats per Shipowner
  const shipownerStatsMap = useMemo(() => {
    const stats: Record<string, ShipownerStatItem> = {};

    const len = timeFilteredShipments.length;
    for (let i = 0; i < len; i++) {
      const s = timeFilteredShipments[i];
      if (!s) continue;

      let name = (s.shipowner || '').trim().toUpperCase();
      if (!name || name === '0' || name === 'N/A' || name === 'NULL') {
        name = 'UNKNOWN / UNASSIGNED';
      }

      if (!stats[name]) {
        stats[name] = {
          name,
          totalContainers: 0,
          deliveredCount: 0,
          inTransitCount: 0,
          atPortCount: 0,
          clearedCount: 0,
          onTimeCount: 0,
          onTimeEligible: 0,
          demurrageCost: 0,
          demurrageCount: 0,
          leadTimeSum: 0,
          leadTimeCount: 0,
          vessels: new Set<string>(),
          cargos: new Set<string>(),
          shipments: []
        };
      }

      const st = stats[name];
      st.totalContainers++;
      st.shipments.push(s);

      if (s.vesselName && s.vesselName.trim()) st.vessels.add(s.vesselName.trim().toUpperCase());
      if (s.cargo && s.cargo.trim()) st.cargos.add(s.cargo.trim());

      // Operational stages
      if (s.deliveryByd) {
        st.deliveredCount++;
      } else if (s.channelDate || s.dateNF) {
        st.clearedCount++;
      } else if (s.ata) {
        st.atPortCount++;
      } else {
        st.inTransitCount++;
      }

      // Demurrage
      if (s.demurrageCost > 0) {
        st.demurrageCost += s.demurrageCost;
        st.demurrageCount++;
      }

      // On-time performance
      if (s.estimatedDelivery && s.deliveryByd) {
        st.onTimeEligible++;
        if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance <= 0) {
          st.onTimeCount++;
        }
      }

      // Lead time
      if (s.portToDelivery !== null && s.portToDelivery >= 0) {
        st.leadTimeSum += s.portToDelivery;
        st.leadTimeCount++;
      }
    }

    return stats;
  }, [timeFilteredShipments]);

  // Overall Global KPIs
  const totalVolume = useMemo(() => {
    return Object.values(shipownerStatsMap).reduce((acc: number, curr: ShipownerStatItem) => acc + curr.totalContainers, 0);
  }, [shipownerStatsMap]);

  const totalDemurrage = useMemo(() => {
    return Object.values(shipownerStatsMap).reduce((acc: number, curr: ShipownerStatItem) => acc + curr.demurrageCost, 0);
  }, [shipownerStatsMap]);

  // Sorted list of shipowners
  const shipownersList = useMemo((): EnhancedShipownerStat[] => {
    const list: EnhancedShipownerStat[] = (Object.values(shipownerStatsMap) as ShipownerStatItem[]).map((st: ShipownerStatItem) => {
      const sharePct = totalVolume > 0 ? (st.totalContainers / totalVolume) * 100 : 0;
      const onTimePct = st.onTimeEligible > 0 ? (st.onTimeCount / st.onTimeEligible) * 100 : 100;
      const avgLeadTime = st.leadTimeCount > 0 ? st.leadTimeSum / st.leadTimeCount : 0;

      return {
        ...st,
        sharePct,
        onTimePct,
        avgLeadTime,
        vesselCount: st.vessels.size,
        cargoCount: st.cargos.size
      };
    });

    return list.sort((a, b) => {
      const fieldA = a[sortConfig.key];
      const fieldB = b[sortConfig.key];
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return sortConfig.direction === 'asc' ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
      }
      if (typeof fieldA === 'number' && typeof fieldB === 'number') {
        return sortConfig.direction === 'asc' ? (fieldA - fieldB) : (fieldB - fieldA);
      }
      return 0;
    });
  }, [shipownerStatsMap, totalVolume, sortConfig]);

  // Top Shipowner
  const topShipowner = useMemo(() => {
    if (shipownersList.length === 0) return null;
    return [...shipownersList].sort((a, b) => b.totalContainers - a.totalContainers)[0];
  }, [shipownersList]);

  // Highest Demurrage Shipowner
  const topDemurrageShipowner = useMemo(() => {
    if (shipownersList.length === 0) return null;
    const sorted = [...shipownersList].filter(s => s.demurrageCost > 0).sort((a, b) => b.demurrageCost - a.demurrageCost);
    return sorted.length > 0 ? sorted[0] : null;
  }, [shipownersList]);

  // Chart Data: Volume Comparison
  const volumeChartData = useMemo(() => {
    return shipownersList.slice(0, 10).map((st, idx) => ({
      name: st.name,
      containers: st.totalContainers,
      delivered: st.deliveredCount,
      pending: st.totalContainers - st.deliveredCount,
      share: parseFloat(st.sharePct.toFixed(1)),
      fill: getColorForShipowner(st.name, idx)
    }));
  }, [shipownersList]);

  // Chart Data: Share Distribution (Pie / Donut)
  const shareChartData = useMemo(() => {
    const top6 = shipownersList.slice(0, 6);
    const others = shipownersList.slice(6);
    const othersTotal = others.reduce((acc, curr) => acc + curr.totalContainers, 0);

    const items = top6.map((st, idx) => ({
      name: st.name,
      value: st.totalContainers,
      share: parseFloat(st.sharePct.toFixed(1)),
      color: getColorForShipowner(st.name, idx)
    }));

    if (othersTotal > 0) {
      items.push({
        name: 'OTHER SHIPOWNERS',
        value: othersTotal,
        share: totalVolume > 0 ? parseFloat(((othersTotal / totalVolume) * 100).toFixed(1)) : 0,
        color: '#94A3B8'
      });
    }

    return items;
  }, [shipownersList, totalVolume]);

  // Chart Data: Demurrage by Shipowner
  const demurrageChartData = useMemo(() => {
    return [...shipownersList]
      .filter(st => st.demurrageCost > 0)
      .slice(0, 8)
      .map((st, idx) => ({
        name: st.name,
        demurrage: st.demurrageCost,
        containersWithDemurrage: st.demurrageCount,
        fill: getColorForShipowner(st.name, idx)
      }));
  }, [shipownersList]);

  // Filtered rows for main display
  const displayedShipowners = useMemo(() => {
    return shipownersList.filter(st => {
      if (selectedShipownerFilter !== 'ALL' && st.name !== selectedShipownerFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = st.name.toLowerCase().includes(term);
        const matchesVessel = Array.from(st.vessels).some((v: string) => v.toLowerCase().includes(term));
        const matchesCargo = Array.from(st.cargos).some((c: string) => c.toLowerCase().includes(term));
        if (!matchesName && !matchesVessel && !matchesCargo) return false;
      }
      if (statusFilter === 'DEMURRAGE_ONLY' && st.demurrageCost <= 0) return false;
      if (statusFilter === 'PENDING_ONLY' && (st.totalContainers - st.deliveredCount) <= 0) return false;
      return true;
    });
  }, [shipownersList, selectedShipownerFilter, searchTerm, statusFilter]);

  // Drilldown Modal Shipments
  const modalFilteredShipments = useMemo(() => {
    if (!modalShipowner) return [];
    const ownerData = shipownerStatsMap[modalShipowner];
    if (!ownerData) return [];

    return ownerData.shipments.filter(s => {
      if (!modalSearch) return true;
      const term = modalSearch.toLowerCase();
      return (
        (s.containerNumber && s.containerNumber.toLowerCase().includes(term)) ||
        (s.billOfLading && s.billOfLading.toLowerCase().includes(term)) ||
        (s.vesselName && s.vesselName.toLowerCase().includes(term)) ||
        (s.cargo && s.cargo.toLowerCase().includes(term)) ||
        (s.carrier && s.carrier.toLowerCase().includes(term)) ||
        (s.bondedWarehouse && s.bondedWarehouse.toLowerCase().includes(term))
      );
    });
  }, [modalShipowner, shipownerStatsMap, modalSearch]);

  const modalPaginatedShipments = useMemo(() => {
    const start = (modalPage - 1) * modalItemsPerPage;
    return modalFilteredShipments.slice(start, start + modalItemsPerPage);
  }, [modalFilteredShipments, modalPage]);

  const modalTotalPages = Math.ceil(modalFilteredShipments.length / modalItemsPerPage);

  const handleExportCSV = (shipownerName: string, items: Shipment[]) => {
    if (!items.length) return;
    const headers = [
      'Container Number',
      'Shipowner',
      'Incoterm',
      'Bill of Lading',
      'Vessel Name',
      'Cargo',
      'ATA Port',
      'Delivery BYD',
      'Free Time Deadline',
      'Demurrage Cost (USD)',
      'Customs Channel',
      'Bonded Warehouse',
      'Carrier',
      'Status'
    ];

    const csvRows = items.map(s => [
      `"${s.containerNumber || ''}"`,
      `"${s.shipowner || ''}"`,
      `"${s.incoterm || ''}"`,
      `"${s.billOfLading || ''}"`,
      `"${s.vesselName || ''}"`,
      `"${s.cargo || ''}"`,
      `"${s.ata && isValidDate(s.ata) ? s.ata.toISOString().split('T')[0] : ''}"`,
      `"${s.deliveryByd && isValidDate(s.deliveryByd) ? s.deliveryByd.toISOString().split('T')[0] : ''}"`,
      `"${s.freeTimeDate && isValidDate(s.freeTimeDate) ? s.freeTimeDate.toISOString().split('T')[0] : ''}"`,
      `"${s.demurrageCost || 0}"`,
      `"${s.parametrization || ''}"`,
      `"${s.bondedWarehouse || ''}"`,
      `"${s.carrier || ''}"`,
      `"${s.statusComex || s.status || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Shipowner_${shipownerName.replace(/[^a-zA-Z0-9]/g, '_')}_Containers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key: keyof EnhancedShipownerStat) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="space-y-10 pb-16">
      {/* 1. Header & Title with High-Craft Visual Hierarchy */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shadow-sm">
              <Ship className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
                Shipowners <span className="text-indigo-600">Intelligence</span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Comparative volume, carrier allocation, demurrage exposure & operational flow per shipowner / armador
              </p>
            </div>
          </div>
        </div>

        {/* Temporal & Incoterm Quick Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-xs">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" /> Year
            </span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-slate-700 text-xs py-1 px-2 outline-none cursor-pointer"
            >
              <option value="ALL">All Years ({availableYears.length})</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-xs">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-700 text-xs py-1 px-2 outline-none cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-xs">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-indigo-500" /> Incoterm
            </span>
            <select
              value={selectedIncoterm}
              onChange={(e) => setSelectedIncoterm(e.target.value)}
              className="bg-transparent font-bold text-slate-700 text-xs py-1 px-2 outline-none cursor-pointer"
            >
              <option value="ALL">All Incoterms ({availableIncoterms.length})</option>
              {availableIncoterms.map(inco => (
                <option key={inco} value={inco}>{inco}</option>
              ))}
            </select>
          </div>

          {(selectedYear !== 'ALL' || selectedMonth !== 'ALL' || selectedIncoterm !== 'ALL') && (
            <button
              onClick={() => { setSelectedYear('ALL'); setSelectedMonth('ALL'); setSelectedIncoterm('ALL'); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards / KPI Executive Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Active Volume */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Volume</p>
              <h3 className="text-3xl font-display font-black text-slate-900 mt-2">
                {totalVolume.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Across {shipownersList.length} maritime lines
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Boxes className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        {/* Top Market Leader */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Leading Shipowner</p>
              <h3 className="text-2xl font-display font-black text-indigo-600 mt-2 truncate max-w-[170px]" title={topShipowner?.name || 'N/A'}>
                {topShipowner?.name || 'N/A'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {topShipowner ? `${topShipowner.totalContainers.toLocaleString()} CNTRs (${topShipowner.sharePct.toFixed(1)}% share)` : 'No data'}
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Anchor className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        {/* Demurrage Cost Impact */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Demurrage Incurred</p>
              <h3 className="text-3xl font-display font-black text-rose-600 mt-2">
                {formatUSD(totalDemurrage)}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 truncate" title={topDemurrageShipowner ? `Highest: ${topDemurrageShipowner.name} (${formatUSD(topDemurrageShipowner.demurrageCost)})` : 'No demurrage incurred'}>
                {topDemurrageShipowner ? `Highest: ${topDemurrageShipowner.name}` : 'Zero demurrage incurred'}
              </p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        {/* Global Delivered vs Active Fleet */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Delivered Rate</p>
              <h3 className="text-3xl font-display font-black text-emerald-600 mt-2">
                {totalVolume > 0 
                  ? `${((shipownersList.reduce((acc, c) => acc + c.deliveredCount, 0) / totalVolume) * 100).toFixed(1)}%` 
                  : '0%'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {shipownersList.reduce((acc, c) => acc + c.deliveredCount, 0).toLocaleString()} of {totalVolume.toLocaleString()} delivered
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Shipowner Quick Filter Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedShipownerFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
            selectedShipownerFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Shipowners ({shipownersList.length})
        </button>

        {shipownersList.slice(0, 10).map((st, idx) => {
          const color = getColorForShipowner(st.name, idx);
          const isSelected = selectedShipownerFilter === st.name;
          return (
            <button
              key={st.name}
              onClick={() => setSelectedShipownerFilter(st.name)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate max-w-[120px]">{st.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {st.totalContainers.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Comparative Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Volume Comparison Bar Chart */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Containers Volume Comparison per Shipowner
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Comparing total container quantity handled across major shipping lines
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-indigo-600"></span> Total Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500"></span> Delivered
              </span>
            </div>
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volumeChartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[180px]">
                          <p className="font-black text-sm text-indigo-400 flex items-center gap-2">
                            <Ship className="w-4 h-4" /> {data.name}
                          </p>
                          <div className="space-y-1 pt-1 border-t border-slate-800">
                            <p className="flex justify-between">
                              <span className="text-slate-400">Total Containers:</span>
                              <span className="font-bold font-mono text-white">{data.containers.toLocaleString()}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-400">Market Share:</span>
                              <span className="font-bold text-amber-400">{data.share}%</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-400">Delivered:</span>
                              <span className="font-bold text-emerald-400">{data.delivered.toLocaleString()}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-400">Pending / In-Transit:</span>
                              <span className="font-bold text-sky-400">{data.pending.toLocaleString()}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="containers" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {volumeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Share Donut Chart */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <PieIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Market Share Allocation
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Percentage distribution of total containers
            </p>
          </div>

          <div className="h-[250px] w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shareChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {shareChartData.map((entry, index) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: number, name: string) => [
                    `${val.toLocaleString()} containers (${totalVolume > 0 ? ((val/totalVolume)*100).toFixed(1) : 0}%)`,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Legend List */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            {shareChartData.slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-bold text-slate-700 text-[11px] truncate">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900 text-[11px] shrink-0">{item.share}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Demurrage & Lead Time Comparison Cards */}
      {demurrageChartData.length > 0 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Demurrage Cost Impact by Shipowner
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Total penalty exposure incurred per maritime line based on agreed free time limits
              </p>
            </div>
            <div className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
              Total Incurred: {formatUSD(totalDemurrage)}
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={demurrageChartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 70, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis 
                  type="number"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fill: '#1E293B', fontSize: 11, fontWeight: 700 }}
                  width={110}
                />
                <Tooltip 
                  formatter={(val: number) => [formatUSD(val), 'Demurrage Cost']}
                  labelFormatter={(name) => `Shipowner: ${name}`}
                />
                <Bar dataKey="demurrage" fill="#EF4444" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. Comprehensive Shipowner Comparison Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Top Controls */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
              Shipowner Performance & Fleet Matrix
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Detailed metrics, container volume breakdowns, on-time delivery rates and direct drilldown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search shipowner, vessel, cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_ONLY">With Active/In-Transit</option>
              <option value="DEMURRAGE_ONLY">With Demurrage Incurred</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6 cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('name')}>
                  <span className="flex items-center gap-1">Shipowner / Armador <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('totalContainers')}>
                  <span className="flex items-center justify-end gap-1">Total Containers <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('sharePct')}>
                  <span className="flex items-center justify-end gap-1">Market Share <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-center">Operational Flow</th>
                <th className="py-4 px-6 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('onTimePct')}>
                  <span className="flex items-center justify-end gap-1">On-Time % <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('demurrageCost')}>
                  <span className="flex items-center justify-end gap-1">Demurrage Cost <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort('avgLeadTime')}>
                  <span className="flex items-center justify-end gap-1">Avg Lead Time <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-4 px-6 text-center">Vessels</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayedShipowners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Ship className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm">No shipowners matched the selected filter</p>
                    <p className="text-xs mt-1">Try resetting your search or time parameters</p>
                  </td>
                </tr>
              ) : (
                displayedShipowners.map((st, idx) => {
                  const color = getColorForShipowner(st.name, idx);
                  const deliveredPct = st.totalContainers > 0 ? (st.deliveredCount / st.totalContainers) * 100 : 0;
                  return (
                    <tr key={st.name} className="hover:bg-slate-50/80 transition-colors">
                      {/* Shipowner Name + Logo Tag */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <span className="font-black text-slate-900 text-sm">{st.name}</span>
                            <p className="text-[10px] text-slate-400 font-bold">{st.cargos.size} cargo types</p>
                          </div>
                        </div>
                      </td>

                      {/* Total Container Quantity */}
                      <td className="py-4 px-6 text-right font-mono font-black text-slate-900 text-sm">
                        {st.totalContainers.toLocaleString()}
                      </td>

                      {/* Share % with mini progress bar */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono font-bold text-slate-900">{st.sharePct.toFixed(1)}%</span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, st.sharePct)}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Operational Flow (Delivered / Cleared / In-Transit) */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 min-w-[130px]">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span className="text-emerald-600">{st.deliveredCount} deliv</span>
                            <span className="text-slate-400">{st.totalContainers - st.deliveredCount} pend</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                            <div 
                              className="bg-emerald-500 h-full"
                              style={{ width: `${deliveredPct}%` }}
                              title={`Delivered: ${st.deliveredCount}`}
                            />
                            <div 
                              className="bg-sky-400 h-full"
                              style={{ width: `${100 - deliveredPct}%` }}
                              title={`Pending: ${st.totalContainers - st.deliveredCount}`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* On-Time Rate */}
                      <td className="py-4 px-6 text-right">
                        <span className={`font-bold font-mono px-2 py-0.5 rounded-md text-[11px] ${
                          st.onTimePct >= 85 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : st.onTimePct >= 65 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {st.onTimeEligible > 0 ? `${st.onTimePct.toFixed(1)}%` : 'N/A'}
                        </span>
                      </td>

                      {/* Demurrage Cost */}
                      <td className="py-4 px-6 text-right">
                        {st.demurrageCost > 0 ? (
                          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[11px]">
                            {formatUSD(st.demurrageCost)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">$0.00</span>
                        )}
                      </td>

                      {/* Avg Lead Time */}
                      <td className="py-4 px-6 text-right font-mono font-bold text-slate-700">
                        {st.avgLeadTime > 0 ? `${st.avgLeadTime.toFixed(1)} days` : '-'}
                      </td>

                      {/* Vessels Count */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 font-bold text-slate-600 text-[11px]">
                          <Anchor className="w-3 h-3 text-slate-400" />
                          {st.vesselCount}
                        </span>
                      </td>

                      {/* Action: Open Drilldown */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => {
                            setModalShipowner(st.name);
                            setModalSearch('');
                            setModalPage(1);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                        >
                          <span>Drilldown</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Drill-down Container Manifest Modal */}
      <AnimatePresence>
        {modalShipowner && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                    <Ship className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl md:text-2xl font-display font-black tracking-tight text-white">
                        {modalShipowner}
                      </h2>
                      <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-mono font-bold rounded-lg">
                        {modalFilteredShipments.length.toLocaleString()} Containers
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Individual container manifest, bill of ladings, vessel timelines & demurrage
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleExportCSV(modalShipowner, modalFilteredShipments)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setModalShipowner(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Filter Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by container ID, BL, vessel, warehouse..."
                    value={modalSearch}
                    onChange={(e) => { setModalSearch(e.target.value); setModalPage(1); }}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  {modalSearch && (
                    <button onClick={() => setModalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-bold">
                  Showing {Math.min(modalFilteredShipments.length, (modalPage - 1) * modalItemsPerPage + 1)} - {Math.min(modalFilteredShipments.length, modalPage * modalItemsPerPage)} of {modalFilteredShipments.length.toLocaleString()} containers
                </div>
              </div>

              {/* Modal Table Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Container ID</th>
                      <th className="py-3 px-4">Incoterm</th>
                      <th className="py-3 px-4">Bill of Lading</th>
                      <th className="py-3 px-4">Vessel Name</th>
                      <th className="py-3 px-4">Cargo</th>
                      <th className="py-3 px-4">Discharge (ATA)</th>
                      <th className="py-3 px-4">Delivery (BYD)</th>
                      <th className="py-3 px-4">Free Time Deadline</th>
                      <th className="py-3 px-4 text-right">Demurrage</th>
                      <th className="py-3 px-4">Warehouse</th>
                      <th className="py-3 px-4">Channel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {modalPaginatedShipments.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          No containers match the current search
                        </td>
                      </tr>
                    ) : (
                      modalPaginatedShipments.map((s, i) => (
                        <tr key={s.containerNumber || i} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-black text-slate-900">{s.containerNumber || '-'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200/60">
                              {s.incoterm || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-indigo-600 font-bold">{s.billOfLading || '-'}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{s.vesselName || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 truncate max-w-[120px]" title={s.cargo}>{s.cargo || '-'}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{s.ata && isValidDate(s.ata) ? s.ata.toLocaleDateString() : '-'}</td>
                          <td className="py-3 px-4 font-mono">
                            {s.deliveryByd && isValidDate(s.deliveryByd) ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {s.deliveryByd.toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{s.freeTimeDate && isValidDate(s.freeTimeDate) ? s.freeTimeDate.toLocaleDateString() : '-'}</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {s.demurrageCost > 0 ? (
                              <span className="text-rose-600 font-bold">{formatUSD(s.demurrageCost)}</span>
                            ) : (
                              <span className="text-slate-400">$0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-bold">{s.bondedWarehouse || s.generalWarehouse || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              s.parametrization?.toUpperCase().includes('VERDE') || s.parametrization?.toUpperCase().includes('GREEN')
                                ? 'bg-emerald-50 text-emerald-700'
                                : s.parametrization?.toUpperCase().includes('VERMELHO') || s.parametrization?.toUpperCase().includes('RED')
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-slate-100 text-slate-700'
                            }`}>
                              {s.parametrization || 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Pagination */}
              {modalTotalPages > 1 && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    Page {modalPage} of {modalTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModalPage(p => Math.max(1, p - 1))}
                      disabled={modalPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
                      disabled={modalPage === modalTotalPages}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShipownersView;
