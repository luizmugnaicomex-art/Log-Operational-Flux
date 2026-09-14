import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import { currencyFormatter } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Download,
  Filter,
  ShieldAlert,
  HelpCircle,
  X,
  Layers,
  ArrowUpDown,
  Boxes,
  RotateCcw,
  Truck,
  Warehouse,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import { normalizeBondedWarehouse, normalizeGeneralWarehouse } from './ShipownerWarehousePendingChart';

interface DemurrageControlViewProps {
  shipments: Shipment[];
}

type AgingKey =
  | 'overdue'
  | '1_5'
  | '6_10'
  | '11_15'
  | '16_20'
  | '21_25'
  | '26_30'
  | '31_35'
  | 'gt_35';

type LocationStage =
  | 'buffer'
  | 'buffer_scheduled'
  | 'delivered_without_eir'
  | 'outside_byd';

interface AgingRowDef {
  key: AgingKey;
  label: string;
  colorClass: string;
  dotColor: string;
  minDays?: number;
  maxDays?: number;
}

const AGING_ROWS: AgingRowDef[] = [
  { key: 'overdue', label: 'Overdue', colorClass: 'text-rose-600 font-bold', dotColor: 'bg-rose-600', maxDays: 0 },
  { key: '1_5', label: '1-5 days', colorClass: 'text-rose-500 font-semibold', dotColor: 'bg-rose-500', minDays: 1, maxDays: 5 },
  { key: '6_10', label: '6-10 days', colorClass: 'text-amber-600 font-semibold', dotColor: 'bg-amber-500', minDays: 6, maxDays: 10 },
  { key: '11_15', label: '11-15 days', colorClass: 'text-amber-500 font-medium', dotColor: 'bg-amber-400', minDays: 11, maxDays: 15 },
  { key: '16_20', label: '16-20 days', colorClass: 'text-yellow-600 font-medium', dotColor: 'bg-yellow-400', minDays: 16, maxDays: 20 },
  { key: '21_25', label: '21-25 days', colorClass: 'text-yellow-500 font-medium', dotColor: 'bg-yellow-300', minDays: 21, maxDays: 25 },
  { key: '26_30', label: '26-30 days', colorClass: 'text-emerald-500 font-medium', dotColor: 'bg-emerald-400', minDays: 26, maxDays: 30 },
  { key: '31_35', label: '31-35 days', colorClass: 'text-emerald-600 font-medium', dotColor: 'bg-emerald-500', minDays: 31, maxDays: 35 },
  { key: 'gt_35', label: '>35 days', colorClass: 'text-emerald-700 font-semibold', dotColor: 'bg-emerald-600', minDays: 36 }
];

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const toUTC = (date: Date): Date => {
  if (!isValidDate(date)) return new Date(0);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const formatDateBR = (date: Date | null | undefined): string => {
  if (!date || !isValidDate(date)) return '-';
  if (date.getFullYear() < 2000) return '13/02/1900';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export const DemurrageControlView: React.FC<DemurrageControlViewProps> = ({ shipments }) => {
  // Reference date calculation: allow switching between Today (2026-09-14) or latest dataset date
  const latestDataDate = useMemo(() => {
    let max = new Date('2026-09-14');
    for (const s of shipments) {
      if (s.deliveryByd && isValidDate(s.deliveryByd) && s.deliveryByd.getFullYear() > 2020) {
        if (s.deliveryByd.getTime() > max.getTime()) max = s.deliveryByd;
      }
      if (s.freeTimeDate && isValidDate(s.freeTimeDate) && s.freeTimeDate.getFullYear() > 2020) {
        if (s.freeTimeDate.getTime() > max.getTime()) max = s.freeTimeDate;
      }
    }
    return max;
  }, [shipments]);

  const [referenceDateMode, setReferenceDateMode] = useState<'today' | 'latest'>('today');
  const referenceDate = useMemo(() => {
    return referenceDateMode === 'today' ? new Date('2026-09-14') : latestDataDate;
  }, [referenceDateMode, latestDataDate]);

  // Selected drilldown filter (cell or BL)
  const [selectedCell, setSelectedCell] = useState<{
    stage?: LocationStage | 'all';
    aging?: AgingKey | 'all';
    bl?: string;
    label?: string;
  } | null>(null);

  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [sortField, setSortField] = useState<'days' | 'bl' | 'cntr' | 'demurrage'>('days');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Classify each shipment into location stage
  const classifyLocationStage = (s: Shipment): LocationStage => {
    // 1. Delivered / Collected but not Returned - without EIR (Critical equipment tracking)
    const isDeliveredOrCollected = 
      !!s.deliveryByd || 
      (s.cargoPresence && /DELIVER|ENTREG/i.test(s.cargoPresence)) ||
      (s.status && /DELIVER|ENTREG/i.test(s.status)) ||
      !!s.unloadDate;

    const isWithoutEIR = 
      !s.actualDepotReturnDate ||
      (s.emptyContainerReturnOperation && /WITHOUT|SEM EIR|PENDING|COLLECTED/i.test(s.emptyContainerReturnOperation));

    if (isDeliveredOrCollected && isWithoutEIR) {
      return 'delivered_without_eir';
    }

    // 2. Buffer Scheduled
    const isScheduled = 
      (s.containerStatusAtBuffer && /SCHEDULE|PROGRAM|AGEND/i.test(s.containerStatusAtBuffer)) ||
      (s.status && /SCHEDULE|PROGRAM|AGEND/i.test(s.status)) ||
      (s.statusComex && /SCHEDULE|PROGRAM|AGEND/i.test(s.statusComex));

    if (isScheduled && !s.deliveryByd) {
      return 'buffer_scheduled';
    }

    // 3. At BYD Buffer (Grounded/Present)
    const isAtBuffer = 
      !!s.containerPuttedDownAtBydBuffer ||
      (s.containerStatusAtBuffer && /BUFFER|PUT DOWN|PATIO|PÁTIO|GROUNDED/i.test(s.containerStatusAtBuffer)) ||
      (s.status && /BUFFER/i.test(s.status));

    if (isAtBuffer && !s.actualDepotReturnDate) {
      return 'buffer';
    }

    // 4. Default to Outside BYD (Still at Port, Terminals, or External General Warehouses)
    return 'outside_byd';
  };

  // Calculate free time days remaining for a shipment relative to reference date
  const getDaysRemaining = (s: Shipment, refDate: Date): number => {
    const ftDate = s.deadlineReturnDate || s.freeTimeDate || s.freeTime;
    if (!ftDate || !isValidDate(ftDate)) {
      if (s.detentionRisk && s.detentionRisk > 0) return -s.detentionRisk;
      return 999;
    }
    // Uninitialized / 1900 dates in Excel indicate unlogged/expired status
    if (ftDate.getFullYear() < 2000) return -999;

    const targetUTC = toUTC(ftDate);
    const refUTC = toUTC(refDate);
    const diffMs = targetUTC.getTime() - refUTC.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getAgingCategory = (days: number): AgingKey => {
    if (days <= 0) return 'overdue';
    if (days <= 5) return '1_5';
    if (days <= 10) return '6_10';
    if (days <= 15) return '11_15';
    if (days <= 20) return '16_20';
    if (days <= 25) return '21_25';
    if (days <= 30) return '26_30';
    if (days <= 35) return '31_35';
    return 'gt_35';
  };

  // Pre-process and categorize all shipments
  const analyzedShipments = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    return shipments.filter(Boolean).map(s => {
      const stage = classifyLocationStage(s);
      const days = getDaysRemaining(s, referenceDate);
      const aging = getAgingCategory(days);
      return {
        shipment: s,
        stage,
        days,
        aging
      };
    });
  }, [shipments, referenceDate]);

  // 1. Matrix Aggregation: [AgingRow x LocationStage]
  const matrixData = useMemo(() => {
    const counts: Record<AgingKey, Record<LocationStage, number>> = {
      overdue: { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '1_5': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '6_10': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '11_15': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '16_20': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '21_25': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '26_30': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      '31_35': { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 },
      gt_35: { buffer: 0, buffer_scheduled: 0, delivered_without_eir: 0, outside_byd: 0 }
    };

    analyzedShipments.forEach(item => {
      counts[item.aging][item.stage]++;
    });

    return counts;
  }, [analyzedShipments]);

  // Stage column totals
  const stageTotals = useMemo(() => {
    const totals: Record<LocationStage, number> = {
      buffer: 0,
      buffer_scheduled: 0,
      delivered_without_eir: 0,
      outside_byd: 0
    };
    (Object.values(matrixData) as Array<Record<LocationStage, number>>).forEach(row => {
      totals.buffer += row.buffer;
      totals.buffer_scheduled += row.buffer_scheduled;
      totals.delivered_without_eir += row.delivered_without_eir;
      totals.outside_byd += row.outside_byd;
    });
    return totals;
  }, [matrixData]);

  const grandTotal = useMemo(() => {
    return stageTotals.buffer + stageTotals.buffer_scheduled + stageTotals.delivered_without_eir + stageTotals.outside_byd;
  }, [stageTotals]);

  // 2. Critical Risk BLs Table (Top Right):
  // "BLs pending delivery with expired free time or free time expiring within 5 days"
  const criticalBLs = useMemo(() => {
    const blMap: Record<string, {
      bl: string;
      batch: string;
      cntrCount: number;
      freeTimeDate: Date | null;
      estimatedDelivery: Date | null;
      daysRemaining: number;
      containers: Shipment[];
    }> = {};

    analyzedShipments.forEach(({ shipment, days }) => {
      // Pending delivery: not yet delivered to BYD
      const isPendingDelivery = !shipment.deliveryByd;
      const isExpiringSoon = days <= 5;

      if (isPendingDelivery && isExpiringSoon) {
        const bl = shipment.billOfLading || 'UNKNOWN BL';
        const batch = shipment.batchNumber || shipment.lotNumber || 'N/A';
        const ftDate = shipment.deadlineReturnDate || shipment.freeTimeDate || shipment.freeTime || null;

        if (!blMap[bl]) {
          blMap[bl] = {
            bl,
            batch,
            cntrCount: 0,
            freeTimeDate: ftDate,
            estimatedDelivery: shipment.estimatedDelivery || null,
            daysRemaining: days,
            containers: []
          };
        }
        blMap[bl].cntrCount++;
        blMap[bl].containers.push(shipment);
        if (days < blMap[bl].daysRemaining) {
          blMap[bl].daysRemaining = days;
          blMap[bl].freeTimeDate = ftDate;
        }
      }
    });

    const list = Object.values(blMap).sort((a, b) => a.daysRemaining - b.daysRemaining);
    const totalCount = list.reduce((acc, curr) => acc + curr.cntrCount, 0);

    return { list, totalCount };
  }, [analyzedShipments]);

  // 3. Total Pending Container by Component (Middle Right)
  const componentData = useMemo(() => {
    let kdCount = 0;
    let batteryCount = 0;
    let otherCount = 0;

    analyzedShipments.forEach(({ shipment }) => {
      if (!shipment.deliveryByd) {
        const cargo = (shipment.cargo || '').toUpperCase();
        if (cargo.includes('BATTER') || cargo.includes('BATERIA')) {
          batteryCount++;
        } else if (cargo.includes('KD') || cargo.includes('CKD') || cargo.includes('CAR') || cargo.includes('AUTO')) {
          kdCount++;
        } else if (cargo.length > 0) {
          otherCount++;
        } else {
          kdCount++; // default allocation if unassigned
        }
      }
    });

    const res = [
      { name: 'KD', count: kdCount, color: '#16A34A' },
      { name: 'BATTERY', count: batteryCount, color: '#0EA5E9' }
    ];

    if (otherCount > 0) {
      res.push({ name: 'OTHER', count: otherCount, color: '#64748B' });
    }

    return res;
  }, [analyzedShipments]);

  // 4. Total Pending Delivery Container by General Warehouse (Bottom Left)
  const generalWarehouseData = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    analyzedShipments.forEach(({ shipment }) => {
      if (!shipment.deliveryByd) {
        const gw = normalizeGeneralWarehouse(shipment.generalWarehouse);
        if (gw) {
          map[gw] = (map[gw] || 0) + 1;
          total++;
        }
      }
    });

    const colors = ['#15803D', '#DC2626', '#E11D48', '#F97316', '#EAB308', '#0284C7', '#6366F1'];

    return Object.entries(map)
      .map(([name, value], idx) => ({
        name,
        value,
        pct: total > 0 ? ((value / total) * 100).toFixed(2) : '0',
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [analyzedShipments]);

  // 5. Total Pending Delivery Container by Bonded Warehouse (Bottom Center)
  const bondedWarehouseData = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    analyzedShipments.forEach(({ shipment }) => {
      if (!shipment.deliveryByd) {
        const bw = normalizeBondedWarehouse(shipment.bondedWarehouse);
        if (bw) {
          map[bw] = (map[bw] || 0) + 1;
          total++;
        }
      }
    });

    const colors = ['#0284C7', '#84CC16', '#22C55E', '#DC2626', '#F43F5E', '#A855F7'];

    return Object.entries(map)
      .map(([name, value], idx) => ({
        name,
        value,
        pct: total > 0 ? ((value / total) * 100).toFixed(2) : '0',
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [analyzedShipments]);

  // 6. Total Containers per Shipowner (Bottom Right)
  const shipownerData = useMemo(() => {
    const map: Record<string, number> = {};

    analyzedShipments.forEach(({ shipment }) => {
      const so = shipment.shipowner ? shipment.shipowner.trim().toUpperCase() : 'UNKNOWN';
      map[so] = (map[so] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [analyzedShipments]);

  // Drilldown filter: filter matching shipments for the drilldown view
  const drilldownShipments = useMemo(() => {
    if (!selectedCell) return [];

    let filtered = analyzedShipments.filter(item => {
      if (selectedCell.bl) {
        return item.shipment.billOfLading === selectedCell.bl;
      }
      if (selectedCell.stage && selectedCell.stage !== 'all' && item.stage !== selectedCell.stage) {
        return false;
      }
      if (selectedCell.aging && selectedCell.aging !== 'all' && item.aging !== selectedCell.aging) {
        return false;
      }
      return true;
    });

    if (drilldownSearch.trim()) {
      const q = drilldownSearch.trim().toLowerCase();
      filtered = filtered.filter(item => {
        if (!item || !item.shipment) return false;
        const cntr = String(item.shipment.containerNumber || '').toLowerCase();
        const bl = String(item.shipment.billOfLading || '').toLowerCase();
        const so = String(item.shipment.shipowner || '').toLowerCase();
        const batch = String(item.shipment.batchNumber || item.shipment.lotNumber || '').toLowerCase();
        return cntr.includes(q) || bl.includes(q) || so.includes(q) || batch.includes(q);
      });
    }

    filtered.sort((a, b) => {
      if (sortField === 'days') {
        return sortAsc ? a.days - b.days : b.days - a.days;
      }
      if (sortField === 'bl') {
        const blA = a.shipment.billOfLading || '';
        const blB = b.shipment.billOfLading || '';
        return sortAsc ? blA.localeCompare(blB) : blB.localeCompare(blA);
      }
      if (sortField === 'cntr') {
        const cA = a.shipment.containerNumber || '';
        const cB = b.shipment.containerNumber || '';
        return sortAsc ? cA.localeCompare(cB) : cB.localeCompare(cA);
      }
      if (sortField === 'demurrage') {
        return sortAsc ? (a.shipment.demurrageCost || 0) - (b.shipment.demurrageCost || 0) : (b.shipment.demurrageCost || 0) - (a.shipment.demurrageCost || 0);
      }
      return 0;
    });

    return filtered;
  }, [analyzedShipments, selectedCell, drilldownSearch, sortField, sortAsc]);

  // Export filtered drilldown list to CSV
  const handleExportCSV = () => {
    if (drilldownShipments.length === 0) return;
    const headers = [
      'Container Number',
      'Bill of Lading',
      'Batch',
      'Shipowner',
      'Stage',
      'Cargo',
      'Bonded Warehouse',
      'General Warehouse',
      'Free Time Date',
      'Days to Expiration',
      'Estimated Delivery',
      'Delivery Date',
      'Demurrage Cost (USD)'
    ];

    const rows = drilldownShipments.map(({ shipment, stage, days }) => [
      `"${shipment.containerNumber}"`,
      `"${shipment.billOfLading}"`,
      `"${shipment.batchNumber || ''}"`,
      `"${shipment.shipowner}"`,
      `"${stage}"`,
      `"${shipment.cargo || ''}"`,
      `"${shipment.bondedWarehouse || ''}"`,
      `"${shipment.generalWarehouse || ''}"`,
      `"${formatDateBR(shipment.deadlineReturnDate || shipment.freeTimeDate)}"`,
      days,
      `"${formatDateBR(shipment.estimatedDelivery)}"`,
      `"${formatDateBR(shipment.deliveryByd)}"`,
      shipment.demurrageCost || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `demurrage_control_export_${selectedCell?.label || 'data'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-6 border border-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Demurrage Control & Expiration Light
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Free Time Aging Matrix, Return Operations (Without EIR) & Shipowner Detention Risk
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Overdue</p>
                <p className="text-sm font-black text-rose-400">
                  {(Object.values(matrixData.overdue) as number[]).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">1-5 Days</p>
                <p className="text-sm font-black text-amber-400">
                  {(Object.values(matrixData['1_5']) as number[]).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Red Box Focus Metric */}
            <div 
              onClick={() => setSelectedCell({ stage: 'delivered_without_eir', aging: 'all', label: 'Delivered but Not Returned (Without EIR)' })}
              className="px-4 py-2 rounded-xl bg-rose-950/40 border-2 border-rose-500 hover:bg-rose-900/40 cursor-pointer transition-all flex items-center gap-2.5 shadow-lg shadow-rose-900/20"
              title="Click to view containers delivered without EIR"
            >
              <Flame className="w-4 h-4 text-rose-400 animate-bounce" />
              <div>
                <p className="text-[10px] uppercase font-black text-rose-300 tracking-wider">Without EIR</p>
                <p className="text-base font-black text-white">
                  {stageTotals.delivered_without_eir.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
              <Boxes className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Active</p>
                <p className="text-sm font-black text-white">{grandTotal.toLocaleString()}</p>
              </div>
            </div>

            {/* Reference Date Toggle */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setReferenceDateMode('today')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  referenceDateMode === 'today'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Calculate aging based on current operational date (14/09/2026)"
              >
                Today (14/09)
              </button>
              <button
                onClick={() => setReferenceDateMode('latest')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  referenceDateMode === 'latest'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Calculate aging based on max data date"
              >
                Max Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Replicating the attached executive layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ========================================================= */}
        {/* CARD 1: Expiration Light Matrix Table (Left, 7 Cols)    */}
        {/* ========================================================= */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                Expiration Light
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Free time remaining vs. container operational location
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                  <th className="py-3 px-3 text-left">Range</th>
                  <th className="py-3 px-2 text-right">At BYD Buffer</th>
                  <th className="py-3 px-2 text-right">At BYD Buffer - Scheduled</th>
                  {/* RED BOX HIGHLIGHT HEADER (Delivered/Collected but not Returned - without EIR) */}
                  <th className="py-3 px-2 text-right bg-rose-50/90 text-rose-700 border-x-2 border-t-2 border-rose-500 font-extrabold shadow-inner">
                    <div className="flex items-center justify-end gap-1">
                      <span>Delivered/Collected but not Returned - without EIR</span>
                    </div>
                  </th>
                  <th className="py-3 px-2 text-right">Outside BYD</th>
                  <th className="py-3 px-3 text-right bg-slate-100">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {AGING_ROWS.map(row => {
                  const dataRow = matrixData[row.key];
                  const rowTotal = dataRow.buffer + dataRow.buffer_scheduled + dataRow.delivered_without_eir + dataRow.outside_byd;
                  const isRowSelected = selectedCell?.aging === row.key;

                  return (
                    <tr 
                      key={row.key}
                      className={`hover:bg-slate-50/80 transition-colors ${isRowSelected ? 'bg-indigo-50/40' : ''}`}
                    >
                      {/* Range Column */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedCell({ aging: row.key, stage: 'all', label: `${row.label} (All Stages)` })}
                          className="flex items-center gap-2 group text-left cursor-pointer"
                        >
                          <span className={`w-3 h-3 rounded-full ${row.dotColor} shrink-0 shadow-sm`} />
                          <span className={`${row.colorClass} group-hover:underline`}>{row.label}</span>
                        </button>
                      </td>

                      {/* At BYD Buffer */}
                      <td className="py-2.5 px-2 text-right font-medium">
                        {dataRow.buffer > 0 ? (
                          <button
                            onClick={() => setSelectedCell({ aging: row.key, stage: 'buffer', label: `${row.label} - At Buffer` })}
                            className="hover:text-indigo-600 hover:font-bold cursor-pointer transition-all"
                          >
                            {dataRow.buffer.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* At BYD Buffer - Scheduled */}
                      <td className="py-2.5 px-2 text-right font-medium">
                        {dataRow.buffer_scheduled > 0 ? (
                          <button
                            onClick={() => setSelectedCell({ aging: row.key, stage: 'buffer_scheduled', label: `${row.label} - Buffer Scheduled` })}
                            className="hover:text-indigo-600 hover:font-bold cursor-pointer transition-all"
                          >
                            {dataRow.buffer_scheduled.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* RED HIGHLIGHT COLUMN: Delivered / Collected but not Returned - without EIR */}
                      <td className="py-2.5 px-2 text-right font-bold bg-rose-50/60 border-x-2 border-rose-500 text-rose-700">
                        {dataRow.delivered_without_eir > 0 ? (
                          <button
                            onClick={() => setSelectedCell({ aging: row.key, stage: 'delivered_without_eir', label: `${row.label} - Without EIR` })}
                            className="px-2 py-0.5 rounded bg-rose-100/80 hover:bg-rose-600 hover:text-white transition-all cursor-pointer shadow-xs inline-block"
                            title="Click to view containers delivered without EIR in this aging bracket"
                          >
                            {dataRow.delivered_without_eir.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-rose-300">-</span>
                        )}
                      </td>

                      {/* Outside BYD */}
                      <td className="py-2.5 px-2 text-right font-medium">
                        {dataRow.outside_byd > 0 ? (
                          <button
                            onClick={() => setSelectedCell({ aging: row.key, stage: 'outside_byd', label: `${row.label} - Outside BYD` })}
                            className="hover:text-indigo-600 hover:font-bold cursor-pointer transition-all"
                          >
                            {dataRow.outside_byd.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Row Total */}
                      <td className="py-2.5 px-3 text-right font-extrabold bg-slate-50 text-slate-900">
                        <button
                          onClick={() => setSelectedCell({ aging: row.key, stage: 'all', label: `${row.label} (All Stages)` })}
                          className="hover:text-indigo-600 cursor-pointer"
                        >
                          {rowTotal.toLocaleString()}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Total Row */}
              <tfoot>
                <tr className="bg-slate-100/95 font-black text-slate-900 text-xs border-t-2 border-slate-300">
                  <td className="py-3 px-3 uppercase tracking-wider font-extrabold">Total</td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => setSelectedCell({ stage: 'buffer', aging: 'all', label: 'All Buffer Containers' })}
                      className="hover:text-indigo-600 cursor-pointer"
                    >
                      {stageTotals.buffer.toLocaleString()}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => setSelectedCell({ stage: 'buffer_scheduled', aging: 'all', label: 'All Scheduled Buffer' })}
                      className="hover:text-indigo-600 cursor-pointer"
                    >
                      {stageTotals.buffer_scheduled.toLocaleString()}
                    </button>
                  </td>

                  {/* Red highlighted column footer */}
                  <td className="py-3 px-2 text-right bg-rose-100 border-x-2 border-b-2 border-rose-500 text-rose-700 font-black text-sm">
                    <button
                      onClick={() => setSelectedCell({ stage: 'delivered_without_eir', aging: 'all', label: 'All Delivered without EIR' })}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer shadow-sm inline-block"
                      title="Click to view all containers delivered without EIR"
                    >
                      {stageTotals.delivered_without_eir.toLocaleString()}
                    </button>
                  </td>

                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => setSelectedCell({ stage: 'outside_byd', aging: 'all', label: 'All Outside BYD' })}
                      className="hover:text-indigo-600 cursor-pointer"
                    >
                      {stageTotals.outside_byd.toLocaleString()}
                    </button>
                  </td>

                  <td className="py-3 px-3 text-right bg-slate-200 text-slate-950 font-black text-sm">
                    <button
                      onClick={() => setSelectedCell({ stage: 'all', aging: 'all', label: 'All Monitored Containers' })}
                      className="hover:text-indigo-600 cursor-pointer"
                    >
                      {grandTotal.toLocaleString()}
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-rose-100 border border-rose-400" />
              <strong>Delivered without EIR</strong>: Risk of carrier demurrage charges until equipment interchange is finalized.
            </span>
            <span className="font-semibold text-indigo-600">Click any number to inspect containers</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 2: BLs Pending Delivery Expiring Table (Right, 5 Cols) */}
        {/* ========================================================= */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[330px]">
            <div className="px-4 py-3 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  BLs pending delivery with expired free time or free time expiring within 5 days
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-black">
                {criticalBLs.list.length} BLs
              </span>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-rose-700 text-white text-[10px] uppercase font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3">BL</th>
                    <th className="py-2 px-2">BATCH</th>
                    <th className="py-2 px-2 text-right">Ctnr</th>
                    <th className="py-2 px-2 text-center">Free Time</th>
                    <th className="py-2 px-3 text-center">Estimated Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {criticalBLs.list.map((item, idx) => (
                    <tr
                      key={item.bl + idx}
                      onClick={() => setSelectedCell({ bl: item.bl, label: `BL: ${item.bl}` })}
                      className="hover:bg-rose-50/60 cursor-pointer transition-colors text-[11px]"
                    >
                      <td className="py-2 px-3 font-bold text-rose-700 underline truncate max-w-[120px]" title={item.bl}>
                        {item.bl}
                      </td>
                      <td className="py-2 px-2 font-medium text-slate-600 truncate max-w-[60px]">
                        {item.batch}
                      </td>
                      <td className="py-2 px-2 text-right font-black text-slate-900">
                        {item.cntrCount}
                      </td>
                      <td className="py-2 px-2 text-center font-medium text-slate-700">
                        {formatDateBR(item.freeTimeDate)}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">
                        {formatDateBR(item.estimatedDelivery)}
                      </td>
                    </tr>
                  ))}
                  {criticalBLs.list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No BLs expiring within 5 days!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Row matching screenshot */}
            <div className="bg-rose-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-black">
              <span className="uppercase tracking-wider">Total</span>
              <span className="text-sm px-3 py-0.5 rounded bg-white text-rose-700 font-extrabold">
                {criticalBLs.totalCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 3: Total Pending Container by Component (Middle Right) */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">
                Total Pending Container by Component
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Unabsorbed Flow
              </span>
            </div>

            <div className="h-32 w-full min-h-[128px] min-w-[200px]">
              <ResponsiveContainer width="100%" height={128} minWidth={1} minHeight={1}>
                <BarChart data={componentData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                    formatter={(val: number) => [`${val.toLocaleString()} CNTR`, 'Volume']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={44} label={{ position: 'top', fill: '#0F172A', fontWeight: 800, fontSize: 11 }}>
                    {componentData.map((entry, index) => (
                      <Cell key={`comp-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: 3 Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ========================================================= */}
        {/* CARD 4: General Warehouse Donut (Bottom Left)            */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
          <div className="mb-3">
            <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">
              Total Pending Delivery Container by General Warehouse
            </h3>
            <p className="text-[10px] text-slate-400">Distribution in secondary storage facilities</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            <div className="w-36 h-36 relative shrink-0 min-w-[144px] min-h-[144px] flex items-center justify-center">
              {generalWarehouseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={144} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={generalWarehouseData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
                      paddingAngle={2}
                    >
                      {generalWarehouseData.map((entry, index) => (
                        <Cell key={`gw-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                      formatter={(val: number, name: string) => [`${val.toLocaleString()} CNTR`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-300 text-xs">No Data</div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 w-full text-[11px] overflow-y-auto max-h-36 custom-scrollbar pr-1">
              {generalWarehouseData.map(item => (
                <div 
                  key={item.name}
                  onClick={() => setSelectedCell({ label: `Warehouse: ${item.name}` })}
                  className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate font-medium text-slate-700" title={item.name}>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-slate-900">
                    <span>{item.value}</span>
                    <span className="text-slate-400 text-[10px]">({item.pct}%)</span>
                  </div>
                </div>
              ))}
              {generalWarehouseData.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No general warehouse data</p>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 5: Bonded Warehouse Donut (Bottom Center)           */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
          <div className="mb-3">
            <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">
              Total Pending Delivery Container by Bonded Warehouse
            </h3>
            <p className="text-[10px] text-slate-400">Distribution across bonded terminals & CLIAs</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            <div className="w-36 h-36 relative shrink-0 min-w-[144px] min-h-[144px] flex items-center justify-center">
              {bondedWarehouseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={144} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={bondedWarehouseData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
                      paddingAngle={2}
                    >
                      {bondedWarehouseData.map((entry, index) => (
                        <Cell key={`bw-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                      formatter={(val: number, name: string) => [`${val.toLocaleString()} CNTR`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-300 text-xs">No Data</div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 w-full text-[11px] overflow-y-auto max-h-36 custom-scrollbar pr-1">
              {bondedWarehouseData.map(item => (
                <div 
                  key={item.name}
                  onClick={() => setSelectedCell({ label: `Terminal: ${item.name}` })}
                  className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate font-medium text-slate-700" title={item.name}>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-slate-900">
                    <span>{item.value}</span>
                    <span className="text-slate-400 text-[10px]">({item.pct}%)</span>
                  </div>
                </div>
              ))}
              {bondedWarehouseData.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No bonded warehouse data</p>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 6: Total Containers per Shipowner (Bottom Right)    */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
          <div className="mb-2">
            <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">
              Total Containers per Shipowner
            </h3>
            <p className="text-[10px] text-slate-400">Total volume ranking by maritime shipping carrier</p>
          </div>

          <div className="h-44 w-full flex-1 min-h-[176px] min-w-[200px]">
            {shipownerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={176} minWidth={1} minHeight={1}>
                <BarChart
                  data={shipownerData}
                  layout="vertical"
                  margin={{ top: 5, right: 35, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#334155' }}
                    width={80}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                    formatter={(val: number) => [`${val.toLocaleString()} CNTR`, 'Volume']}
                  />
                  <Bar
                    dataKey="count"
                    fill="#DC2626"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    label={{ position: 'right', fill: '#0F172A', fontWeight: 800, fontSize: 10 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-300 text-xs">No Shipowner Data</div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DRILLDOWN CONTAINER MANIFEST (Interactive Inspection)    */}
      {/* ========================================================= */}
      {selectedCell && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-indigo-500 shadow-xl overflow-hidden mt-6"
        >
          <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-600 rounded-xl text-white">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Filtered Container Inspection</span>
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded-full text-xs font-bold border border-indigo-400/30">
                    {selectedCell.label || 'Selected Group'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {drilldownShipments.length} matching equipment records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search CNTR, BL, Shipowner..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>

              <button
                onClick={() => setSelectedCell(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th 
                    className="py-3 px-3 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => { setSortField('cntr'); setSortAsc(!sortAsc); }}
                  >
                    <span className="flex items-center gap-1">Container <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th 
                    className="py-3 px-3 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => { setSortField('bl'); setSortAsc(!sortAsc); }}
                  >
                    <span className="flex items-center gap-1">BL <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="py-3 px-2">Batch / DI</th>
                  <th className="py-3 px-3">Shipowner</th>
                  <th className="py-3 px-2">Component</th>
                  <th className="py-3 px-3">Terminal / Warehouse</th>
                  <th className="py-3 px-2 text-center">Free Time</th>
                  <th 
                    className="py-3 px-2 text-center cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => { setSortField('days'); setSortAsc(!sortAsc); }}
                  >
                    <span className="flex items-center justify-center gap-1">Days Left <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="py-3 px-2 text-center">Est. Delivery</th>
                  <th className="py-3 px-2 text-center">Delivered BYD</th>
                  <th 
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => { setSortField('demurrage'); setSortAsc(!sortAsc); }}
                  >
                    <span className="flex items-center justify-end gap-1">Demurrage <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {drilldownShipments.map(({ shipment, days, stage }, idx) => (
                  <tr key={shipment.containerNumber + idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {shipment.containerNumber}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {shipment.billOfLading}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px]">
                      {shipment.batchNumber || shipment.lotNumber || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {shipment.shipowner}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        (shipment.cargo || '').toUpperCase().includes('BATTER')
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {shipment.cargo || 'KD'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]" title={shipment.bondedWarehouse || shipment.generalWarehouse}>
                      {shipment.bondedWarehouse || shipment.generalWarehouse || '-'}
                    </td>
                    <td className="py-2.5 px-2 text-center font-medium text-slate-700">
                      {formatDateBR(shipment.deadlineReturnDate || shipment.freeTimeDate)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        days <= 0
                          ? 'bg-rose-100 text-rose-700 animate-pulse'
                          : days <= 5
                          ? 'bg-rose-50 text-rose-600'
                          : days <= 15
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {days <= 0 ? `Overdue (${Math.abs(days)}d)` : `${days} days`}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-600">
                      {formatDateBR(shipment.estimatedDelivery)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-600">
                      {formatDateBR(shipment.deliveryByd)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {shipment.demurrageCost && shipment.demurrageCost > 0 ? (
                        <span className="text-rose-600">{currencyFormatter.format(shipment.demurrageCost)}</span>
                      ) : (
                        <span className="text-slate-400">$0</span>
                      )}
                    </td>
                  </tr>
                ))}
                {drilldownShipments.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No matching containers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};
