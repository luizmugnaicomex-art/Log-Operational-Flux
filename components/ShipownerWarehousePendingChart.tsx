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
  Legend,
  Cell,
  LabelList
} from 'recharts';
import {
  Warehouse,
  Building2,
  Ship,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  X,
  ChevronRight,
  ShieldAlert,
  Info,
  Layers,
  ArrowRight,
  Flame,
  FileSpreadsheet,
  BarChart3
} from 'lucide-react';

interface ShipownerWarehousePendingChartProps {
  shipments: Shipment[];
  onSelectShipowner?: (name: string) => void;
  selectedShipownerFilter?: string;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const toUTC = (date: Date): Date => {
  if (!isValidDate(date)) return new Date(0);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const formatUSD = (val: number): string => currencyFormatter.format(val || 0);

// Helper to normalize bonded warehouse names
export const normalizeBondedWarehouse = (raw?: string | null): string => {
  if (!raw) return 'Other / Unassigned Bonded';
  const upper = raw.trim().toUpperCase();
  if (['0', 'N/A', 'NULL', '-', 'UNKNOWN'].includes(upper)) return 'Other / Unassigned Bonded';
  if (upper.includes('TECON') || upper.includes('WILSON') || upper.includes('TECOM')) return 'TECON Salvador';
  if (upper.includes('INTERMARITIMA') || upper.includes('INTERMAR') || upper.includes('INTER ARCO')) return 'Intermarítima';
  if (upper.includes('TPC')) return 'TPC';
  if (upper.includes('EMPORIO') || upper.includes('EMPÓRIO') || upper.includes('CLIA')) return 'CLIA Empório';
  return raw.trim();
};

// Helper to normalize general warehouse names
export const normalizeGeneralWarehouse = (raw?: string | null): string => {
  if (!raw) return '';
  const upper = raw.trim().toUpperCase();
  if (['0', 'N/A', 'NULL', '-', 'UNKNOWN'].includes(upper)) return '';
  if (upper.includes('TRANSIT') || upper.includes('UNASSIGNED') || upper.includes('CLEARED')) return '';
  if (upper.includes('J&W') || upper.includes('JW')) return 'AG - CTS J&W';
  if (upper.includes('LOGIC')) return 'AG - CTS LOGIC';
  if (upper.includes('PONTUAL')) return 'AG - CTS PONTUAL';
  if (upper.includes('UNI')) return 'AG - CTS UNI';
  if (upper.includes('VBR')) return 'AG - CTS VBR';
  if (upper.includes('CDEX') || upper.includes('SEDEX')) return 'AG - INTER CDEX';
  if (upper.includes('MULTILOG')) return 'AG - MULTILOG';
  if (upper.includes('AREA 23') || upper.includes('ÁREA 23')) return 'AREA 23';
  if (upper.includes('BUFFER') || upper.includes('TERCAM')) return 'BUFFER - TERCAM';
  return raw.trim();
};

export interface PendingItemStats {
  shipowner: string;
  totalPending: number;
  bondedCount: number;
  generalCount: number;
  arrivedBonded: number;
  arrivedGeneral: number;
  pipelineBonded: number;
  pipelineGeneral: number;
  bondedBreakdown: Record<string, number>;
  generalBreakdown: Record<string, number>;
  overdueCount: number;
  urgentCount: number;
  safeCount: number;
  demurrageCost: number;
  shipments: Shipment[];
}

export const ShipownerWarehousePendingChart: React.FC<ShipownerWarehousePendingChartProps> = ({
  shipments = [],
  onSelectShipowner,
  selectedShipownerFilter = 'ALL'
}) => {
  const [chartMode, setChartMode] = useState<'stacked' | 'grouped'>('stacked');
  const [filterScope, setFilterScope] = useState<'arrived_only' | 'all_pending'>('all_pending');
  const [selectedBarShipowner, setSelectedBarShipowner] = useState<string | null>(null);
  const [chartViewMode, setChartViewMode] = useState<'breakout' | 'overview'>('breakout');
  
  // Drilldown modal for pending return
  const [detailModalShipowner, setDetailModalShipowner] = useState<string | null>(null);
  const [modalFilterLocation, setModalFilterLocation] = useState<'ALL' | 'BONDED' | 'GENERAL'>('ALL');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPage, setModalPage] = useState<number>(1);
  const modalPageSize = 20;

  const todayUTC = useMemo(() => toUTC(new Date()), []);

  // Compute pending inventory statistics per shipowner
  const { shipownerPendingMap, globalStats, mscStats } = useMemo(() => {
    const map: Record<string, PendingItemStats> = {};
    const global = {
      totalPending: 0,
      totalBonded: 0,
      totalGeneral: 0,
      totalOverdue: 0,
      totalUrgent: 0,
      totalDemurrage: 0
    };

    if (!Array.isArray(shipments)) {
      return { shipownerPendingMap: map, globalStats: global, mscStats: null };
    }

    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i];
      if (!s) continue;

      // Only pending delivery units (not yet delivered to BYD)
      if (s.deliveryByd && isValidDate(s.deliveryByd)) continue;

      const hasArrived = Boolean(s.ata && isValidDate(s.ata) && toUTC(s.ata).getTime() <= todayUTC.getTime());

      // If user selected arrived_only filter and shipment has not arrived, skip
      if (filterScope === 'arrived_only' && !hasArrived) continue;

      let shipowner = (s.shipowner || '').trim().toUpperCase();
      if (!shipowner || ['0', 'N/A', 'NULL', '-'].includes(shipowner)) {
        shipowner = 'UNKNOWN / OTHER';
      }

      if (!map[shipowner]) {
        map[shipowner] = {
          shipowner,
          totalPending: 0,
          bondedCount: 0,
          generalCount: 0,
          arrivedBonded: 0,
          arrivedGeneral: 0,
          pipelineBonded: 0,
          pipelineGeneral: 0,
          bondedBreakdown: {},
          generalBreakdown: {},
          overdueCount: 0,
          urgentCount: 0,
          safeCount: 0,
          demurrageCost: 0,
          shipments: []
        };
      }

      const item = map[shipowner];
      item.totalPending++;
      item.shipments.push(s);
      global.totalPending++;

      if (s.demurrageCost > 0) {
        item.demurrageCost += s.demurrageCost;
        global.totalDemurrage += s.demurrageCost;
      }

      // Free time analysis
      if (s.freeTimeDate && isValidDate(s.freeTimeDate)) {
        const diffDays = Math.floor((toUTC(s.freeTimeDate).getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          item.overdueCount++;
          global.totalOverdue++;
        } else if (diffDays <= 4) {
          item.urgentCount++;
          global.totalUrgent++;
        } else {
          item.safeCount++;
        }
      }

      // Determine location: General Warehouse vs Bonded Warehouse
      const gwName = normalizeGeneralWarehouse(s.generalWarehouse);
      const bwName = normalizeBondedWarehouse(s.bondedWarehouse);

      if (gwName) {
        // Staged / Transferred at General Warehouse
        item.generalCount++;
        global.totalGeneral++;
        item.generalBreakdown[gwName] = (item.generalBreakdown[gwName] || 0) + 1;
        if (hasArrived) item.arrivedGeneral++;
        else item.pipelineGeneral++;
      } else {
        // At Bonded Warehouse / Terminal
        item.bondedCount++;
        global.totalBonded++;
        item.bondedBreakdown[bwName] = (item.bondedBreakdown[bwName] || 0) + 1;
        if (hasArrived) item.arrivedBonded++;
        else item.pipelineBonded++;
      }
    }

    // MSC specific entry
    let msc: PendingItemStats | null = null;
    for (const [name, stats] of Object.entries(map)) {
      if (name.includes('MSC')) {
        msc = stats;
        break;
      }
    }

    return { shipownerPendingMap: map, globalStats: global, mscStats: msc };
  }, [shipments, filterScope, todayUTC]);

  // Sorted list for chart display (top shipowners with pending containers)
  const chartData = useMemo(() => {
    return (Object.values(shipownerPendingMap) as PendingItemStats[])
      .filter(item => item.totalPending > 0)
      .sort((a, b) => b.totalPending - a.totalPending)
      .map(item => ({
        name: item.shipowner,
        bonded: item.bondedCount,
        general: item.generalCount,
        total: item.totalPending,
        overdue: item.overdueCount,
        urgent: item.urgentCount,
        demurrage: item.demurrageCost,
        isMSC: item.shipowner.includes('MSC')
      }));
  }, [shipownerPendingMap]);

  // Export CSV specifically for MSC (or any selected shipowner)
  const handleExportReturnCSV = (shipownerName: string, items: Shipment[]) => {
    if (!items.length) return;
    const headers = [
      'Container Number',
      'Shipowner',
      'Location Category',
      'Specific Warehouse',
      'Bill of Lading',
      'Vessel Name',
      'Cargo Model',
      'ATA Port Date',
      'Free Time Deadline',
      'Return Urgency',
      'Demurrage Incurred (USD)',
      'Customs Channel',
      'Carrier / Transporter',
      'Status Comex'
    ];

    const csvRows = items.map(s => {
      const gw = normalizeGeneralWarehouse(s.generalWarehouse);
      const bw = normalizeBondedWarehouse(s.bondedWarehouse);
      const locCategory = gw ? 'General Warehouse (Armazém Geral)' : 'Bonded Warehouse (Alfandegado)';
      const specificWh = gw || bw;

      let returnUrgency = 'SAFE';
      if (s.freeTimeDate && isValidDate(s.freeTimeDate)) {
        const diffDays = Math.floor((toUTC(s.freeTimeDate).getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) returnUrgency = `OVERDUE (${Math.abs(diffDays)}d)`;
        else if (diffDays <= 3) returnUrgency = `CRITICAL (${diffDays}d left)`;
        else if (diffDays <= 7) returnUrgency = `ATTENTION (${diffDays}d left)`;
      }

      return [
        `"${s.containerNumber || ''}"`,
        `"${s.shipowner || ''}"`,
        `"${locCategory}"`,
        `"${specificWh}"`,
        `"${s.billOfLading || ''}"`,
        `"${s.vesselName || ''}"`,
        `"${s.cargoModel || s.cargo || ''}"`,
        `"${s.ata && isValidDate(s.ata) ? s.ata.toISOString().split('T')[0] : ''}"`,
        `"${s.freeTimeDate && isValidDate(s.freeTimeDate) ? s.freeTimeDate.toISOString().split('T')[0] : ''}"`,
        `"${returnUrgency}"`,
        `"${s.demurrageCost || 0}"`,
        `"${s.parametrization || ''}"`,
        `"${s.carrier || ''}"`,
        `"${s.statusComex || s.status || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${shipownerName.replace(/[^a-zA-Z0-9]/g, '_')}_Pending_Return_Containers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active item selected for detailed warehouse breakdown cards below chart
  const activeFocusItem = useMemo(() => {
    if (selectedBarShipowner && shipownerPendingMap[selectedBarShipowner]) {
      return shipownerPendingMap[selectedBarShipowner];
    }
    if (selectedShipownerFilter !== 'ALL' && shipownerPendingMap[selectedShipownerFilter]) {
      return shipownerPendingMap[selectedShipownerFilter];
    }
    // Default to MSC if present, else highest volume
    if (mscStats) return mscStats;
    return chartData.length > 0 ? shipownerPendingMap[chartData[0].name] : null;
  }, [selectedBarShipowner, selectedShipownerFilter, shipownerPendingMap, mscStats, chartData]);

  const handleSelectShipowner = (name: string) => {
    setSelectedBarShipowner(name);
    setChartViewMode('breakout');
    if (onSelectShipowner) onSelectShipowner(name);
  };

  // Detailed quantity breakout by warehouse for the active focus shipowner
  const warehouseBreakoutData = useMemo(() => {
    if (!activeFocusItem) return [];
    const list: {
      warehouse: string;
      count: number;
      category: 'bonded' | 'general';
      categoryName: string;
      fill: string;
      percentage: number;
    }[] = [];

    const total = activeFocusItem.totalPending || 1;

    // Bonded Warehouses (Port Terminals)
    Object.entries(activeFocusItem.bondedBreakdown || {}).forEach(([wh, rawCnt]) => {
      const cnt = Number(rawCnt) || 0;
      if (cnt > 0) {
        list.push({
          warehouse: wh,
          count: cnt,
          category: 'bonded',
          categoryName: 'Bonded Warehouse (Alfandegado)',
          fill: '#0284C7',
          percentage: Number(((cnt / total) * 100).toFixed(1))
        });
      }
    });

    // General Warehouses (Armazéns Gerais)
    Object.entries(activeFocusItem.generalBreakdown || {}).forEach(([wh, rawCnt]) => {
      const cnt = Number(rawCnt) || 0;
      if (cnt > 0) {
        list.push({
          warehouse: wh,
          count: cnt,
          category: 'general',
          categoryName: 'General Warehouse (Armazém Geral)',
          fill: '#9333EA',
          percentage: Number(((cnt / total) * 100).toFixed(1))
        });
      }
    });

    return list.sort((a, b) => b.count - a.count);
  }, [activeFocusItem]);

  // Modal filtered shipments for drilldown
  const modalShipments = useMemo(() => {
    if (!detailModalShipowner) return [];
    const item = shipownerPendingMap[detailModalShipowner];
    if (!item) return [];

    return item.shipments.filter(s => {
      const gw = normalizeGeneralWarehouse(s.generalWarehouse);
      if (modalFilterLocation === 'BONDED' && gw) return false;
      if (modalFilterLocation === 'GENERAL' && !gw) return false;

      if (!modalSearch) return true;
      const term = modalSearch.toLowerCase();
      return (
        (s.containerNumber && s.containerNumber.toLowerCase().includes(term)) ||
        (s.billOfLading && s.billOfLading.toLowerCase().includes(term)) ||
        (s.vesselName && s.vesselName.toLowerCase().includes(term)) ||
        (s.bondedWarehouse && s.bondedWarehouse.toLowerCase().includes(term)) ||
        (s.generalWarehouse && s.generalWarehouse.toLowerCase().includes(term)) ||
        (s.cargoModel && s.cargoModel.toLowerCase().includes(term)) ||
        (s.carrier && s.carrier.toLowerCase().includes(term))
      );
    });
  }, [detailModalShipowner, shipownerPendingMap, modalFilterLocation, modalSearch]);

  const modalPaginated = useMemo(() => {
    const start = (modalPage - 1) * modalPageSize;
    return modalShipments.slice(start, start + modalPageSize);
  }, [modalShipments, modalPage]);

  const modalTotalPages = Math.ceil(modalShipments.length / modalPageSize);

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/90 shadow-sm space-y-8">
      {/* 1. Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 shadow-xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl md:text-2xl font-display font-black text-slate-900 tracking-tight">
                  Containers Pending Delivery by Shipowner
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Bonded vs General Warehouses
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Monitoring units awaiting factory delivery & empty container return across shipping lines (MSC, COSCO, CMA CGM, etc.)
              </p>
            </div>
          </div>
        </div>

        {/* View Controls & Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Filter (Arrived vs All Pending) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => setFilterScope('all_pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterScope === 'all_pending'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pending ({globalStats.totalPending})
            </button>
            <button
              onClick={() => setFilterScope('arrived_only')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterScope === 'arrived_only'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Arrived in Yard/WH</span>
            </button>
          </div>

          {/* Chart Display Mode (Stacked vs Grouped) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => setChartMode('stacked')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMode === 'stacked'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stacked Total
            </button>
            <button
              onClick={() => setChartMode('grouped')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMode === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          {/* Quick MSC Focus Button */}
          {mscStats && (
            <button
              onClick={() => {
                setSelectedBarShipowner(mscStats.shipowner);
                if (onSelectShipowner) onSelectShipowner(mscStats.shipowner);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
                selectedBarShipowner === mscStats.shipowner
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
            >
              <Ship className="w-3.5 h-3.5 text-amber-600" />
              <span>MSC Focus ({mscStats.totalPending})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Executive Snapshot Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pending Delivery</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-2xl font-display font-black text-slate-900">{globalStats.totalPending.toLocaleString()}</h4>
            <span className="text-[11px] font-bold text-slate-500">containers</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Units awaiting BYD receipt</p>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/70">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-700">At Bonded Warehouses</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-2xl font-display font-black text-sky-900">{globalStats.totalBonded.toLocaleString()}</h4>
            <span className="text-[11px] font-bold text-sky-700 font-mono">
              {globalStats.totalPending > 0 ? `${((globalStats.totalBonded / globalStats.totalPending) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <p className="text-[10px] text-sky-600 mt-1">TECON, Intermarítima, CLIA, TPC</p>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/70">
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">At General Warehouses</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-2xl font-display font-black text-purple-900">{globalStats.totalGeneral.toLocaleString()}</h4>
            <span className="text-[11px] font-bold text-purple-700 font-mono">
              {globalStats.totalPending > 0 ? `${((globalStats.totalGeneral / globalStats.totalPending) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <p className="text-[10px] text-purple-600 mt-1">CTS J&W, Logic, CDEX, Multilog, Buffer</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
            {activeFocusItem ? `${activeFocusItem.shipowner} Focus Units` : 'Shipowner Focus'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-2xl font-display font-black text-amber-900">
              {activeFocusItem ? activeFocusItem.totalPending.toLocaleString() : 0}
            </h4>
            <span className="text-[11px] font-bold text-amber-700 font-mono">
              {activeFocusItem && globalStats.totalPending > 0
                ? `${((activeFocusItem.totalPending / globalStats.totalPending) * 100).toFixed(0)}% share`
                : '0%'}
            </span>
          </div>
          <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            {activeFocusItem
              ? `${activeFocusItem.overdueCount} overdue / ${activeFocusItem.urgentCount} urgent return`
              : 'No shipowner selected'}
          </p>
        </div>
      </div>

      {/* Interactive Shipowner Selector Strip */}
      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5 text-indigo-600" /> Click a Shipowner to View Warehouse Breakout:
          </span>
          <span className="text-[11px] text-slate-400 font-semibold">
            {chartViewMode === 'breakout' && activeFocusItem ? (
              <span className="text-indigo-600 font-bold">Showing: {activeFocusItem.shipowner}</span>
            ) : (
              'Comparing all lines'
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setChartViewMode('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
              chartViewMode === 'overview'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs font-black'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Shipowners Overview</span>
          </button>

          {chartData.map((item) => {
            const isSelected = activeFocusItem?.shipowner === item.name && chartViewMode === 'breakout';
            const isMsc = item.isMSC;
            return (
              <button
                key={item.name}
                onClick={() => handleSelectShipowner(item.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? isMsc
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs font-black'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                    : isMsc
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="truncate">{item.name}</span>
                {isMsc && <span className="text-[10px]">★</span>}
                <span
                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : isMsc
                      ? 'bg-amber-100 text-amber-900 font-bold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.total.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Bar Chart & Shipowner Priority Return Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* The Bar Chart: Dynamically switches between Warehouse Breakout for selected shipowner & All Shipowners Overview */}
        <div className="lg:col-span-8 bg-slate-50/60 rounded-3xl p-6 border border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              {chartViewMode === 'breakout' && activeFocusItem ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>Warehouse Quantity Breakout:</span>
                      <span className="text-indigo-600 underline font-black">
                        {activeFocusItem.shipowner}
                      </span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {activeFocusItem.totalPending.toLocaleString()} CNTRs
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Click any warehouse bar to view container list. Click another shipowner above to change breakout.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Shipowner Pending Volume by Warehouse Type</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Click any bar or shipowner button above to drill into its warehouse quantity breakout
                  </p>
                </div>
              )}
            </div>
            
            {/* View Mode & Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle Breakout vs Overview */}
              <div className="flex items-center bg-white p-1 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setChartViewMode('breakout')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    chartViewMode === 'breakout'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Warehouse className="w-3 h-3" />
                  <span>Breakout</span>
                </button>
                <button
                  onClick={() => setChartViewMode('overview')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    chartViewMode === 'overview'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All Lines</span>
                </button>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-xs font-bold bg-white/70 px-2.5 py-1 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-sky-500"></span>
                  <span className="text-slate-700 text-[11px]">Bonded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-purple-600"></span>
                  <span className="text-slate-700 text-[11px]">General</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[360px] w-full">
            {chartViewMode === 'breakout' ? (
              /* --- WAREHOUSE QUANTITY BREAKOUT FOR SELECTED SHIPOWNER --- */
              warehouseBreakoutData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Warehouse className="w-10 h-10 mb-2 opacity-50" />
                  <p className="font-bold text-sm">No pending warehouse containers for {activeFocusItem?.shipowner}</p>
                  <p className="text-xs mt-1">Select another shipowner or switch to All Shipowners view</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={warehouseBreakoutData}
                    margin={{ top: 25, right: 15, left: -10, bottom: 45 }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length && activeFocusItem) {
                        const clickedWh = state.activePayload[0].payload.warehouse;
                        setDetailModalShipowner(activeFocusItem.shipowner);
                        setModalSearch(clickedWh);
                        setModalPage(1);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="warehouse"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="end"
                              transform="rotate(-25)"
                              fontSize={11}
                              fontWeight={700}
                              fill="#334155"
                            >
                              {payload.value}
                            </text>
                          </g>
                        );
                      }}
                      interval={0}
                      height={65}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => String(val)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && activeFocusItem) {
                          const data = payload[0].payload;
                          const isBonded = data.category === 'bonded';
                          return (
                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl text-xs space-y-2.5 border border-slate-700 min-w-[240px]">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                <p className="font-black text-sm text-white flex items-center gap-1.5">
                                  {isBonded ? (
                                    <Warehouse className="w-4 h-4 text-sky-400" />
                                  ) : (
                                    <Building2 className="w-4 h-4 text-purple-400" />
                                  )}
                                  <span>{data.warehouse}</span>
                                </p>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    isBonded
                                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                                      : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                                  }`}
                                >
                                  {isBonded ? 'Bonded WH' : 'General WH'}
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-slate-300">
                                  <span>Shipowner:</span>
                                  <span className="font-bold text-amber-400">{activeFocusItem.shipowner}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-300">
                                  <span>Pending Containers:</span>
                                  <span className="font-mono font-black text-base text-white">
                                    {data.count.toLocaleString()} CNTRs
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                                  <span>Share of {activeFocusItem.shipowner}:</span>
                                  <span className="font-mono font-bold text-slate-200">{data.percentage}%</span>
                                </div>
                              </div>

                              <p className="text-[10px] text-indigo-300 pt-1 border-t border-slate-800 italic text-center">
                                Click bar to inspect container list for this warehouse
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48} className="cursor-pointer">
                      {warehouseBreakoutData.map((entry, index) => (
                        <Cell
                          key={`wh-${index}`}
                          fill={entry.fill}
                          className="cursor-pointer hover:opacity-85 transition-opacity"
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        fill="#0F172A"
                        fontSize={11}
                        fontWeight={800}
                        formatter={(val: any) => Number(val).toLocaleString()}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              /* --- ALL SHIPOWNERS COMPARISON VIEW --- */
              chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Warehouse className="w-10 h-10 mb-2 opacity-50" />
                  <p className="font-bold text-sm">No pending containers found in this view</p>
                  <p className="text-xs mt-1">All containers have been delivered to BYD or filter returned zero results</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 25, right: 15, left: -10, bottom: 40 }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const clicked = state.activePayload[0].payload.name;
                        handleSelectShipowner(clicked);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="name"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const isMSC = payload.value.includes('MSC');
                        const isSelected = activeFocusItem?.shipowner === payload.value;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="end"
                              transform="rotate(-25)"
                              fontSize={11}
                              fontWeight={isMSC || isSelected ? 800 : 600}
                              fill={isMSC ? '#D97706' : isSelected ? '#4F46E5' : '#475569'}
                              className="cursor-pointer"
                            >
                              {payload.value} {isMSC ? '★' : ''}
                            </text>
                          </g>
                        );
                      }}
                      interval={0}
                      height={60}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => String(val)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isMSC = data.name.includes('MSC');
                          return (
                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl text-xs space-y-2.5 border border-slate-700 min-w-[220px]">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                <p className="font-black text-sm text-sky-400 flex items-center gap-1.5">
                                  <Ship className="w-4 h-4 text-sky-400" />
                                  <span>{data.name}</span>
                                </p>
                                {isMSC && (
                                  <span className="bg-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/40">
                                    MSC Fleet
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-slate-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-sky-500"></span>
                                    <span>Bonded Warehouse:</span>
                                  </span>
                                  <span className="font-mono font-bold text-white">{data.bonded.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-purple-500"></span>
                                    <span>General Warehouse:</span>
                                  </span>
                                  <span className="font-mono font-bold text-white">{data.general.toLocaleString()}</span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-bold">
                                  <span className="text-amber-400">Total Pending Return:</span>
                                  <span className="text-white font-mono text-sm">{data.total.toLocaleString()}</span>
                                </div>
                              </div>

                              {(data.overdue > 0 || data.urgent > 0) && (
                                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                                  <span className="text-rose-400 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Overdue Free Time:
                                  </span>
                                  <span className="text-rose-400 font-mono font-bold">{data.overdue} units</span>
                                </div>
                              )}

                              <p className="text-[10px] text-amber-300 pt-1 italic text-center border-t border-slate-800 font-bold">
                                ➔ Click bar to see warehouse quantity breakout for {data.name}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {chartMode === 'stacked' ? (
                      <>
                        <Bar dataKey="bonded" stackId="pending" fill="#0284C7" radius={[0, 0, 0, 0]} maxBarSize={44} className="cursor-pointer">
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`bonded-${index}`}
                              fill={entry.name.includes('MSC') ? '#0284C7' : '#38BDF8'}
                              stroke={activeFocusItem?.shipowner === entry.name ? '#0F172A' : 'none'}
                              strokeWidth={activeFocusItem?.shipowner === entry.name ? 2 : 0}
                            />
                          ))}
                        </Bar>
                        <Bar dataKey="general" stackId="pending" fill="#9333EA" radius={[6, 6, 0, 0]} maxBarSize={44} className="cursor-pointer">
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`general-${index}`}
                              fill={entry.name.includes('MSC') ? '#7E22CE' : '#C084FC'}
                              stroke={activeFocusItem?.shipowner === entry.name ? '#0F172A' : 'none'}
                              strokeWidth={activeFocusItem?.shipowner === entry.name ? 2 : 0}
                            />
                          ))}
                        </Bar>
                      </>
                    ) : (
                      <>
                        <Bar dataKey="bonded" fill="#0284C7" radius={[6, 6, 0, 0]} maxBarSize={24} name="Bonded" className="cursor-pointer" />
                        <Bar dataKey="general" fill="#9333EA" radius={[6, 6, 0, 0]} maxBarSize={24} name="General" className="cursor-pointer" />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-200/70 text-[11px] text-slate-500 gap-2">
            <span>
              {chartViewMode === 'breakout' && activeFocusItem ? (
                <span>
                  Showing <strong>{warehouseBreakoutData.length}</strong> staging warehouses for{' '}
                  <strong className="text-slate-800">{activeFocusItem.shipowner}</strong> (
                  <strong className="text-sky-700">{activeFocusItem.bondedCount}</strong> Bonded /{' '}
                  <strong className="text-purple-700">{activeFocusItem.generalCount}</strong> General)
                </span>
              ) : (
                <span>Showing {chartData.length} shipowners with pending delivery units</span>
              )}
            </span>
            <span className="font-bold text-slate-700 flex items-center gap-2">
              <span>Blue = Bonded Terminals</span>
              <span>•</span>
              <span>Purple = General Warehouses</span>
            </span>
          </div>
        </div>

        {/* Dedicated Shipowner Container Return Priority Panel (Dynamically changes with selected shipowner) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 rounded-3xl p-6 border-2 border-amber-300/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {activeFocusItem ? `${activeFocusItem.shipowner} Container Return` : 'Container Return'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-200 text-amber-900">
                      {activeFocusItem?.shipowner.includes('MSC') ? 'Priority Line' : 'Selected Carrier'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/70 font-bold">
                    {activeFocusItem
                      ? `Official return tracking & staging for ${activeFocusItem.shipowner}`
                      : 'Select a shipowner to view details'}
                  </p>
                </div>
              </div>
            </div>

            {/* Overview Stats Box for Active Focus Shipowner */}
            {activeFocusItem ? (
              <div className="space-y-3">
                <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-amber-200 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-600">
                      Total {activeFocusItem.shipowner} Pending Delivery:
                    </span>
                    <span className="text-xl font-display font-black text-amber-600">
                      {activeFocusItem.totalPending.toLocaleString()} CNTRs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                      <p className="text-[10px] font-black uppercase tracking-wider text-sky-700">At Bonded Terminals</p>
                      <p className="text-lg font-black text-sky-900 mt-0.5">
                        {activeFocusItem.bondedCount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-sky-600 font-medium truncate">
                        {Object.keys(activeFocusItem.bondedBreakdown).slice(0, 2).join(' / ') || 'Port Terminals'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">At General WHs</p>
                      <p className="text-lg font-black text-purple-900 mt-0.5">
                        {activeFocusItem.generalCount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-purple-600 font-medium truncate">
                        {Object.keys(activeFocusItem.generalBreakdown).slice(0, 2).join(' / ') || 'Warehouses'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Free Time Return Risk Tiers */}
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Free Time Urgency Status</span>
                    <span className="text-slate-400 font-normal">Depot Return Deadline</span>
                  </p>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="flex items-center gap-1.5 font-bold text-rose-700">
                        <Flame className="w-3.5 h-3.5 text-rose-600" /> Overdue Free Time:
                      </span>
                      <span className="font-mono font-black text-rose-700">{activeFocusItem.overdueCount} CNTRs</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="flex items-center gap-1.5 font-bold text-amber-800">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Critical (≤ 4 days left):
                      </span>
                      <span className="font-mono font-black text-amber-800">{activeFocusItem.urgentCount} CNTRs</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Safe Return Window:
                      </span>
                      <span className="font-mono font-black text-emerald-800">{activeFocusItem.safeCount} CNTRs</span>
                    </div>
                  </div>
                </div>

                {/* Specific Warehouse Location Breakdown for Selected Shipowner */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    {activeFocusItem.shipowner} Top Staging Locations:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(activeFocusItem.bondedBreakdown).map(([wh, cnt]) => (
                      <button
                        key={wh}
                        onClick={() => {
                          setDetailModalShipowner(activeFocusItem.shipowner);
                          setModalSearch(wh);
                          setModalPage(1);
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 cursor-pointer transition-colors"
                        title={`View containers at ${wh}`}
                      >
                        {wh}: <strong className="font-mono">{cnt}</strong>
                      </button>
                    ))}
                    {Object.entries(activeFocusItem.generalBreakdown).map(([wh, cnt]) => (
                      <button
                        key={wh}
                        onClick={() => {
                          setDetailModalShipowner(activeFocusItem.shipowner);
                          setModalSearch(wh);
                          setModalPage(1);
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 cursor-pointer transition-colors"
                        title={`View containers at ${wh}`}
                      >
                        {wh}: <strong className="font-mono">{cnt}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-2xl text-center text-slate-400">
                <p className="font-bold text-xs">No active shipments in this period filter</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-amber-200/80">
            {activeFocusItem && (
              <>
                <button
                  onClick={() => handleExportReturnCSV(activeFocusItem.shipowner, activeFocusItem.shipments)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download {activeFocusItem.shipowner} Return Manifest (CSV)</span>
                </button>

                <button
                  onClick={() => {
                    setDetailModalShipowner(activeFocusItem.shipowner);
                    setModalFilterLocation('ALL');
                    setModalSearch('');
                    setModalPage(1);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-all cursor-pointer"
                >
                  <span>View All {activeFocusItem.totalPending} {activeFocusItem.shipowner} Pending Containers</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Interactive Staging Warehouses Details for Selected Shipowner */}
      {activeFocusItem && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Warehouse Breakdown for <span className="text-indigo-600 underline font-black">{activeFocusItem.shipowner}</span>:
              </h4>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => {
                  setDetailModalShipowner(activeFocusItem.shipowner);
                  setModalFilterLocation('ALL');
                  setModalPage(1);
                }}
                className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Inspect full list ({activeFocusItem.totalPending})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => handleExportReturnCSV(activeFocusItem.shipowner, activeFocusItem.shipments)}
                className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Bonded Terminals */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-sky-800 mb-2">
                <span className="flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-sky-600" /> Bonded Warehouses (Alfandegados):
                </span>
                <span className="font-mono font-black">{activeFocusItem.bondedCount}</span>
              </div>
              <div className="space-y-1.5">
                {Object.keys(activeFocusItem.bondedBreakdown).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No containers currently at bonded terminals</p>
                ) : (
                  Object.entries(activeFocusItem.bondedBreakdown).map(([wh, cnt]) => (
                    <div key={wh} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-sky-50/60 text-slate-700">
                      <span className="font-medium truncate mr-2">{wh}</span>
                      <span className="font-mono font-bold text-sky-900 shrink-0">{cnt} CNTRs</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* General Warehouses */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-purple-800 mb-2">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-600" /> General Warehouses (Armazéns Gerais):
                </span>
                <span className="font-mono font-black">{activeFocusItem.generalCount}</span>
              </div>
              <div className="space-y-1.5">
                {Object.keys(activeFocusItem.generalBreakdown).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No containers currently at general warehouses</p>
                ) : (
                  Object.entries(activeFocusItem.generalBreakdown).map(([wh, cnt]) => (
                    <div key={wh} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-purple-50/60 text-slate-700">
                      <span className="font-medium truncate mr-2">{wh}</span>
                      <span className="font-mono font-bold text-purple-900 shrink-0">{cnt} CNTRs</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Detailed Container Return Drilldown Modal */}
      <AnimatePresence>
        {detailModalShipowner && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
                    <Ship className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl md:text-2xl font-display font-black tracking-tight text-white">
                        {detailModalShipowner} - Pending Delivery Containers
                      </h2>
                      <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold rounded-lg">
                        {modalShipments.length.toLocaleString()} Containers
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Exact warehouse locations, free time expiration, bill of ladings & return deadlines for {detailModalShipowner}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleExportReturnCSV(detailModalShipowner, modalShipments)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setDetailModalShipowner(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Filter Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search container ID, BL, vessel, cargo..."
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

                  {/* Location Filter Toggle */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs font-bold">
                    <button
                      onClick={() => { setModalFilterLocation('ALL'); setModalPage(1); }}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        modalFilterLocation === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600'
                      }`}
                    >
                      All Locations
                    </button>
                    <button
                      onClick={() => { setModalFilterLocation('BONDED'); setModalPage(1); }}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        modalFilterLocation === 'BONDED' ? 'bg-sky-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      Bonded Only
                    </button>
                    <button
                      onClick={() => { setModalFilterLocation('GENERAL'); setModalPage(1); }}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        modalFilterLocation === 'GENERAL' ? 'bg-purple-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      General Only
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-bold">
                  Showing {Math.min(modalShipments.length, (modalPage - 1) * modalPageSize + 1)} - {Math.min(modalShipments.length, modalPage * modalPageSize)} of {modalShipments.length.toLocaleString()} containers
                </div>
              </div>

              {/* Modal Table Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Container ID</th>
                      <th className="py-3 px-4">Current Warehouse Location</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Bill of Lading</th>
                      <th className="py-3 px-4">Vessel Name</th>
                      <th className="py-3 px-4">Cargo Model</th>
                      <th className="py-3 px-4">ATA Port</th>
                      <th className="py-3 px-4">Free Time Deadline</th>
                      <th className="py-3 px-4">Return Urgency</th>
                      <th className="py-3 px-4 text-right">Demurrage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {modalPaginated.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          No pending containers match your filters
                        </td>
                      </tr>
                    ) : (
                      modalPaginated.map((s, idx) => {
                        const gw = normalizeGeneralWarehouse(s.generalWarehouse);
                        const bw = normalizeBondedWarehouse(s.bondedWarehouse);
                        const isGeneral = Boolean(gw);
                        const specificLocation = gw || bw;

                        // Calculate urgency
                        let urgencyLabel = 'Safe';
                        let urgencyClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        if (s.freeTimeDate && isValidDate(s.freeTimeDate)) {
                          const diff = Math.floor((toUTC(s.freeTimeDate).getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
                          if (diff < 0) {
                            urgencyLabel = `Overdue (${Math.abs(diff)}d)`;
                            urgencyClass = 'bg-rose-50 text-rose-700 border-rose-200';
                          } else if (diff <= 3) {
                            urgencyLabel = `Critical (${diff}d)`;
                            urgencyClass = 'bg-amber-50 text-amber-800 border-amber-200';
                          } else if (diff <= 7) {
                            urgencyLabel = `Warning (${diff}d)`;
                            urgencyClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                          }
                        }

                        return (
                          <tr key={s.containerNumber || idx} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono font-black text-slate-900">{s.containerNumber || '-'}</td>
                            
                            {/* Current Specific Location */}
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                {isGeneral ? (
                                  <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                ) : (
                                  <Warehouse className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                )}
                                <span className="truncate max-w-[150px]">{specificLocation}</span>
                              </span>
                            </td>

                            {/* Category Badge */}
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                                isGeneral
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}>
                                {isGeneral ? 'General WH' : 'Bonded Yard'}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono text-indigo-600 font-bold">{s.billOfLading || '-'}</td>
                            <td className="py-3 px-4 font-medium text-slate-700 truncate max-w-[120px]">{s.vesselName || '-'}</td>
                            <td className="py-3 px-4 text-slate-600 truncate max-w-[120px]">{s.cargoModel || s.cargo || '-'}</td>
                            
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {s.ata && isValidDate(s.ata) ? s.ata.toLocaleDateString() : 'In Transit'}
                            </td>

                            <td className="py-3 px-4 font-mono text-slate-800 font-bold">
                              {s.freeTimeDate && isValidDate(s.freeTimeDate) ? s.freeTimeDate.toLocaleDateString() : '-'}
                            </td>

                            {/* Return Urgency */}
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] border ${urgencyClass}`}>
                                {urgencyLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right font-mono">
                              {s.demurrageCost > 0 ? (
                                <span className="text-rose-600 font-bold">{formatUSD(s.demurrageCost)}</span>
                              ) : (
                                <span className="text-slate-400">$0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
