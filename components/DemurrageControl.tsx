import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import { 
  Building2, 
  CircleAlert, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  SlidersHorizontal, 
  Ship, 
  Anchor, 
  ShieldCheck, 
  Layers, 
  Search, 
  Calendar,
  AlertTriangle,
  HelpCircle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  Undo2,
  Download
} from 'lucide-react';

interface DemurrageControlProps {
  shipments: Shipment[];
}

export const DemurrageControl: React.FC<{ shipments: Shipment[] }> = ({ shipments }) => {
  // 1. Dynamic System Reference Date Default: 2026-06-12 (aligns perfectly with comex dates in screenshot)
  const [evaluationDate, setEvaluationDate] = useState<string>("2026-06-12");
  
  // 2. Interactive Tariff Rates state per Shipowner (Carrier)
  const [carrierRates, setCarrierRates] = useState<Record<string, number>>({
    "MSC": 150,
    "CMA CGM": 140,
    "ONE": 130,
    "COSCO": 130,
    "OTHERS": 110
  });

  // Slider for Projected Delay Days (to estimate future demurrage exposure for high-risk assets)
  const [projectedDelayFactor, setProjectedDelayFactor] = useState<number>(7);
  
  // Collapsible Rates Panel state
  const [isRatesPanelOpen, setIsRatesPanelOpen] = useState<boolean>(true);

  // Search & Filter Box state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [carrierFilter, setCarrierFilter] = useState<string>("ALL");
  const [terminalFilter, setTerminalFilter] = useState<string>("ALL");

  // Format currencies beautifully
  const formatCost = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper to normalize shipowner name to match our rates state keys
  const getNormalizedCarrier = (shipowner: string): string => {
    const owner = (shipowner || "").toUpperCase();
    if (owner.includes("MSC")) return "MSC";
    if (owner.includes("CMA") || owner.includes("CMA CGM") || owner.includes("ANL")) return "CMA CGM";
    if (owner.includes("ONE") || owner.includes("OCEAN NETWORK")) return "ONE";
    if (owner.includes("COSCO")) return "COSCO";
    return "OTHERS";
  };

  const todayTime = useMemo(() => {
    const d = new Date(evaluationDate + "T00:00:00Z");
    return isNaN(d.getTime()) ? new Date("2026-06-12T00:00:00Z").getTime() : d.getTime();
  }, [evaluationDate]);

  // Redefined aging categories and metrics pipeline
  const {
    dateIssue,
    demurrage,
    highRisk,
    mediumRisk,
    lowRisk,
    onTimeReturnedCount,
    lateReturnedCount,
    totalAccruedDemurrageActive,
    totalProjectedRisk,
    actionableInventoryCount,
    historicalDemurragePaid
  } = useMemo(() => {
    const dateIssue: Shipment[] = [];        // No free time date registered but arrived
    const demurrage: Shipment[] = [];        // Overdue (diffDays < 0)
    const highRisk: Shipment[] = [];         // Alto Risco (0 <= diffDays <= 5 Days Remaining)
    const mediumRisk: Shipment[] = [];       // Risco Moderado (6 <= diffDays <= 15 Days Remaining)
    const lowRisk: Shipment[] = [];          // Sob Controle (16+ Days Remaining)

    let onTimeReturnedCount = 0;
    let lateReturnedCount = 0;
    let totalAccruedDemurrageActive = 0;
    let totalProjectedRisk = 0;
    let historicalDemurragePaid = 0;

    shipments.forEach(s => {
      const carrierKey = getNormalizedCarrier(s.shipowner || s.carrier || "");
      const dailyRate = carrierRates[carrierKey] || carrierRates["OTHERS"];

      // Handle returned containers (completed)
      if (s.actualDepotReturnDate) {
        const returnDateObj = new Date(s.actualDepotReturnDate);
        historicalDemurragePaid += s.demurrageCost || 0;

        if (s.freeTimeDate) {
          const freeTimeUTC = new Date(s.freeTimeDate);
          freeTimeUTC.setHours(0, 0, 0, 0);
          if (returnDateObj.getTime() > freeTimeUTC.getTime()) {
            lateReturnedCount++;
          } else {
            onTimeReturnedCount++;
          }
        }
        return; // Returned units are removed from active tracking Kanban
      }

      // Handle active containers with missing date
      if (!s.freeTimeDate) {
        if (s.ata) {
          dateIssue.push(s);
        }
        return;
      }

      // Calculate time remaining/overdue days
      const freeTimeUTC = new Date(s.freeTimeDate);
      freeTimeUTC.setHours(0, 0, 0, 0);
      const diffTime = freeTimeUTC.getTime() - todayTime;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Overdue container
        demurrage.push(s);
        // Real-time active demurrage incurred logic: Days Overdue * Active Daily Rate
        const overdueDays = Math.abs(diffDays);
        totalAccruedDemurrageActive += overdueDays * dailyRate;
      } else if (diffDays <= 5) {
        // High Risk (≤ 5 Days Left)
        highRisk.push(s);
        // Predict financial risk logic if return is delayed by projectedDelayFactor (slider configuration)
        totalProjectedRisk += projectedDelayFactor * dailyRate;
      } else if (diffDays <= 15) {
        // Risco Moderado (6 - 15 Days Left)
        mediumRisk.push(s);
      } else {
        // Sob Controle / Safe
        lowRisk.push(s);
      }
    });

    // Actionable count: units currently sitting in high exposure zones
    const actionableInventoryCount = demurrage.length + highRisk.length + dateIssue.length;

    return {
      dateIssue,
      demurrage,
      highRisk,
      mediumRisk,
      lowRisk,
      onTimeReturnedCount,
      lateReturnedCount,
      totalAccruedDemurrageActive,
      totalProjectedRisk,
      actionableInventoryCount,
      historicalDemurragePaid
    };
  }, [shipments, todayTime, carrierRates, projectedDelayFactor]);

  // Extract unique active Terminals / Bonded Warehouses for dropdown filters
  const terminalsList = useMemo(() => {
    const list = new Set<string>();
    shipments.forEach(s => {
      const wh = s.bondedWarehouse || s.generalWarehouse;
      if (wh) {
        let clean = wh.toUpperCase().trim();
        if (clean.includes("TECON")) clean = "TECON S.A.";
        else if (clean.includes("TPC")) clean = "TPC OPERADOR";
        else if (clean.includes("INTERMARITIMA") || clean.includes("INTER")) clean = "INTERMARITIMA";
        list.add(clean);
      }
    });
    return Array.from(list);
  }, [shipments]);

  // Check if each s passes search criteria
  const filterShipmentByUI = (s: Shipment): boolean => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesContainer = (s.containerNumber || "").toLowerCase().includes(search);
      const matchesVessel = (s.vesselName || "").toLowerCase().includes(search);
      const matchesBl = (s.billOfLading || "").toLowerCase().includes(search);
      if (!matchesContainer && !matchesVessel && !matchesBl) return false;
    }

    // Carrier Filter
    if (carrierFilter !== "ALL") {
      const carrierKey = getNormalizedCarrier(s.shipowner || s.carrier || "");
      if (carrierFilter !== carrierKey) return false;
    }

    // Terminal Filter
    if (terminalFilter !== "ALL") {
      const wh = s.bondedWarehouse || s.generalWarehouse || "";
      let cleanWh = wh.toUpperCase().trim();
      if (cleanWh.includes("TECON")) cleanWh = "TECON S.A.";
      else if (cleanWh.includes("TPC")) cleanWh = "TPC OPERADOR";
      else if (cleanWh.includes("INTERMARITIMA") || cleanWh.includes("INTER")) cleanWh = "INTERMARITIMA";
      
      if (terminalFilter === "TECON" && !cleanWh.includes("TECON")) return false;
      if (terminalFilter === "TPC" && !cleanWh.includes("TPC")) return false;
      if (terminalFilter === "INTERMARITIMA" && !cleanWh.includes("INTERMARITIMA")) return false;
    }

    return true;
  };

  // Roadblock analysis logic per card to provide granular management insight 
  const getRoadblockDetails = (s: Shipment, diffDays: number | null) => {
    const statusStr = (s.status || s.statusComex || "").toUpperCase();
    const paramStr = (s.parametrization || "").toUpperCase();

    // Red alert roadblocks
    if (diffDays !== null && diffDays < 0) {
      if (statusStr.includes("DELIVERED") || statusStr.includes("FACTORY") || statusStr.includes("BYD")) {
        return { label: "Empty Return Pending", color: "bg-red-50 text-red-700 border-red-200" };
      }
      if (statusStr.includes("PORT") || statusStr.includes("YARD") || statusStr.includes("DISCH")) {
        return { label: "Waiting Customs Close", color: "bg-rose-100 text-rose-800 border-rose-300" };
      }
      return { label: "Priority Empty Return", color: "bg-red-100 text-red-900 border-red-300" };
    }

    // Warnings and other tracking milestones
    if (paramStr.includes("VERMELHO") || paramStr.includes("CINZA")) {
      return { label: "Verificação Física (Canal)", color: "bg-amber-100 text-amber-800 border-amber-300" };
    }
    if (statusStr.includes("PORT") || statusStr.includes("YARD") || statusStr.includes("DISCH")) {
      return { label: "Waiting Customs Close", color: "bg-yellow-50 text-amber-700 border-yellow-250" };
    }
    if (statusStr.includes("NF") || statusStr.includes("CLEAR") || statusStr.includes("BILL")) {
      return { label: "Transport Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (statusStr.includes("TRANSIT") || statusStr.includes("SEA")) {
      return { label: "Vessel en Route", color: "bg-indigo-50 text-indigo-700 border-indigo-150" };
    }

    return { label: "Reviewing Documentation", color: "bg-slate-50 text-slate-600 border-slate-200" };
  };

  // Dynamic color formatting helper for days countdowns
  const getCountdownFormat = (diffDays: number | null) => {
    if (diffDays === null) return { text: "Sem Prazo", style: "bg-slate-100 text-slate-700" };
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d Overdue`, style: "bg-red-50 text-red-650 font-black border border-red-100 animate-pulse" };
    if (diffDays <= 5) return { text: `${diffDays}d Remaining`, style: "bg-orange-50 text-orange-600 font-extrabold border border-orange-150" };
    if (diffDays <= 15) return { text: `${diffDays}d Remaining`, style: "bg-amber-50 text-amber-600 font-bold border border-amber-150" };
    if (diffDays <= 20) return { text: `${diffDays}d Remaining`, style: "bg-yellow-50 text-yellow-600 font-medium" };
    return { text: `${diffDays}d Secure`, style: "bg-emerald-50 text-emerald-600 font-medium" };
  };

  const handleRateChange = (carrier: string, value: number) => {
    setCarrierRates(prev => ({
      ...prev,
      [carrier]: Math.max(0, value)
    }));
  };

  const handleExportExcel = () => {
    // Filter active raw shipments matching current search inputs
    const exportData = shipments.filter(filterShipmentByUI);

    const headers = [
      "Vessel Name",
      "Bill of Lading (BL)",
      "Container Number",
      "Shipowner (Carrier)",
      "Status of the Cargo",
      "Bonded Warehouse (Terminal)",
      "General Warehouse",
      "ETA (Estimated Arrival)",
      "Delivery at BYD Date",
      "Deadline (Free Time Expiration Date)",
      "Days Remaining / Days Overdue"
    ];

    const formatDateValue = (d: any) => {
      if (!d) return "N/A";
      const dateObj = new Date(d);
      return isNaN(dateObj.getTime()) ? "N/A" : dateObj.toLocaleDateString();
    };

    const rows = exportData.map(s => {
      let daysText = "N/A";
      if (s.freeTimeDate) {
        const freeTimeUTC = new Date(s.freeTimeDate);
        freeTimeUTC.setHours(0, 0, 0, 0);
        const diffTime = freeTimeUTC.getTime() - todayTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysText = diffDays < 0 ? `${Math.abs(diffDays)} days Overdue` : `${diffDays} days remaining`;
      }

      return [
        s.vesselName || "N/A",
        s.billOfLading || "N/A",
        s.containerNumber || "N/A",
        s.shipowner || s.carrier || "N/A",
        s.status || s.statusComex || "N/A",
        s.bondedWarehouse || "N/A",
        s.generalWarehouse || "N/A",
        formatDateValue(s.estimatedDelivery),
        formatDateValue(s.deliveryByd),
        formatDateValue(s.freeTimeDate),
        daysText
      ];
    });

    const escapeCSV = (val: string) => {
      const clean = val.replace(/"/g, '""');
      if (clean.includes(",") || clean.includes("\n") || clean.includes('"') || clean.includes(";")) {
        return `"${clean}"`;
      }
      return clean;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const dStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `BYD_Demurrage_Report_${dStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContainerCard = (s: Shipment) => {
    const diffDays = s.freeTimeDate 
      ? Math.ceil((new Date(s.freeTimeDate).setHours(0,0,0,0) - todayTime) / (1000 * 60 * 60 * 24))
      : null;

    const roadblock = getRoadblockDetails(s, diffDays);
    const countdown = getCountdownFormat(diffDays);
    const normalizedCarrier = getNormalizedCarrier(s.shipowner || s.carrier || "");

    return (
      <motion.div
        key={s.containerNumber}
        layoutId={s.containerNumber}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="bg-white border border-slate-200 hover:border-slate-350 hover:shadow-md rounded-2xl p-4 transition-all duration-250 flex flex-col justify-between gap-3 relative"
      >
        <div className="flex justify-between items-start gap-2">
          {/* Primary Reference Key: Prominent Container Number */}
          <div className="flex flex-col">
            <span className="font-mono font-black text-slate-850 tracking-tight text-sm select-all">
              {s.containerNumber}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
              Ref: {s.billOfLading || "N/A"}
            </span>
          </div>

          {/* Dynamic Days Counter Badge */}
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm ${countdown.style}`}>
            {countdown.text}
          </span>
        </div>

        {/* Vessel Name & Voyage */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Ship className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold truncate" title={s.vesselName}>
              {s.vesselName || 'No Registered Vessel'}
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-450 font-medium">
            <span>Voyage: <span className="font-bold text-slate-650">{s.voyage || 'Vol. 260S'}</span></span>
            <span>Type: <span className="font-mono font-bold text-indigo-500">{s.containerType || "1x 40'HC"}</span></span>
          </div>
        </div>

        {/* Carrier, Location & Roadblock Indicators */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Carrier / Location</span>
            <span className="text-[10px] font-mono bg-slate-105 border font-semibold px-2 py-0.5 rounded text-slate-600">
              {s.bondedWarehouse ? s.bondedWarehouse.toUpperCase() : "PORT YARD"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            {/* Carrier Display */}
            <span className={`text-xs font-black ${normalizedCarrier === "MSC" ? "text-amber-600" : normalizedCarrier === "CMA CGM" ? "text-blue-600" : "text-indigo-600"}`}>
              {normalizedCarrier}
            </span>
            
            {/* Location */}
            <span className="text-xs text-slate-500 font-semibold truncate max-w-[130px]">
              {s.status || "At Sea Pipeline"}
            </span>
          </div>

          {/* Roadblock Badge (Visual Urgency) */}
          <div className={`mt-1 py-1.5 px-3 border rounded-xl text-[10px] font-black tracking-wide text-center uppercase ${roadblock.color}`}>
            {roadblock.label}
          </div>
        </div>

        {/* Exp Date Row */}
        <div className="flex justify-between mt-1 pt-1.5 text-[10px] font-mono text-slate-400 border-t border-slate-50 font-bold">
          <span>EXPIRY DATE:</span>
          <span className="text-slate-600">{s.freeTimeDate ? new Date(s.freeTimeDate).toLocaleDateString() : 'Desconhecido'}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Banner & Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg text-white font-black text-xl leading-none">
            D&D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-white">Demurrage Command & Intelligence Center</h2>
              <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                ● PROACTIVE EXPOSURE ACTIVA
              </span>
            </div>
            <p className="text-slate-400 font-mono text-xs mt-1 uppercase opacity-85">
              Camaçari Control System • Interactive Daily Tariff Modeler • Financial Exposure Risk 2026
            </p>
          </div>
        </div>

        {/* Reference Date Control Widget & Actions */}
        <div className="flex flex-col sm:flex-row items-end gap-3 shrink-0">
          <div className="flex flex-col gap-1 text-xs w-full sm:w-auto">
            <label className="text-slate-400 font-mono text-[9px] font-black uppercase text-right">SYSTEM REFERENCE DATE</label>
            <input 
              type="date" 
              value={evaluationDate}
              onChange={(e) => setEvaluationDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 font-mono font-black text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-44"
            />
          </div>
          
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all border border-emerald-500/20 shadow-md w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Dynamic Tariff Modeler Section */}
      <div className="bg-white border border-slate-200 rounded-[2.25rem] p-6 shadow-sm overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsRatesPanelOpen(!isRatesPanelOpen)}
          className="w-full flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-red-600" />
            <div className="text-left">
              <h3 className="font-extrabold text-slate-850 uppercase text-sm">Interactive Demurrage Tariff Configurator</h3>
              <p className="text-slate-400 text-xs font-medium">Configure daily overdue rates per carrier (USD) to model real-time financial liabilities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-100 font-black px-3 py-1 rounded-full text-slate-500">
              {isRatesPanelOpen ? "COLLAPSE PANEL" : "EDIT CHARGES"}
            </span>
            {isRatesPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isRatesPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6 pt-6 border-t border-slate-100 space-y-6"
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(carrierRates).map(([carrier, rate]) => (
                  <div key={carrier} className="bg-slate-50 border border-slate-150 rounded-2xl p-4 hover:border-slate-350 transition-colors">
                    <label className={`text-[10px] font-black uppercase block mb-1.5 ${carrier === "MSC" ? "text-amber-600" : carrier === "CMA CGM" ? "text-blue-600" : "text-slate-500"}`}>
                      {carrier}
                    </label>
                    <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-inner bg-white">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input 
                        type="number" 
                        value={rate}
                        onChange={(e) => handleRateChange(carrier, Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 text-right font-mono font-black text-slate-800 text-sm focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase text-right">USD / DAY / UNIT</span>
                  </div>
                ))}
              </div>

              {/* Advanced Risk Modeling Interactive Slider */}
              <div className="bg-red-50/50 border border-red-100/50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-red-600" /> Predictive Delay Factor
                  </h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed max-w-xl">
                    Adjust the estimated overhead delay period (days overdue) to calculate projected financial exposures for active assets nearing expiration.
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-white border border-slate-200 p-3 rounded-2xl w-full md:w-auto">
                  <div className="flex flex-col text-xs text-slate-500 min-w-[125px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">PROSPECTIVE PERIOD</span>
                    <span className="font-mono font-black text-lg text-slate-800">{projectedDelayFactor} Days Overdue</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={projectedDelayFactor}
                    onChange={(e) => setProjectedDelayFactor(Number(e.target.value))}
                    className="w-full md:w-44 accent-red-600"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Financial & Prevention Metrics (KPI Top Ribbon) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1: Active Incurred Cost (Com Demurrage) */}
        <div className="bg-white border border-slate-250 p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between group relative overflow-hidden min-h-[170px]">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-red-50 w-24 h-24 rounded-full -z-10 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block">Accrued Operational Cost</span>
              <h3 className="text-3xl font-black text-red-650 font-mono tracking-tight mt-1">
                {formatCost(totalAccruedDemurrageActive)}
              </h3>
            </div>
            <span className="text-[9px] bg-red-100 text-red-700 font-mono font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 select-none">
              <DollarSign className="w-3.5 h-3.5" /> ACCRUED
            </span>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-3">
            <div className="flex flex-col">
              <span className="text-slate-400 font-mono font-bold text-[9px] uppercase">Active Delinquents</span>
              <span className="text-xs font-black text-slate-700">{demurrage.length} containers</span>
            </div>
            <span className="text-[10px] font-bold text-red-600 uppercase block tracking-wide">
              Rate Multipliers Applied
            </span>
          </div>
        </div>

        {/* KPI 2: Projected Financial Exposure */}
        <div className="bg-white border border-slate-250 p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between group relative overflow-hidden min-h-[170px]">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-orange-50 w-24 h-24 rounded-full -z-10 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-orange-650 uppercase tracking-widest block">Projected Financial Risk</span>
              <h3 className="text-3xl font-black text-orange-600 font-mono tracking-tight mt-1">
                {formatCost(totalProjectedRisk)}
              </h3>
            </div>
            <span className="text-[9px] bg-orange-100 text-orange-850 font-mono font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 select-none">
              <TrendingDown className="w-3.5 h-3.5" /> MODEL_EXPOSURE
            </span>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-3">
            <div className="flex flex-col">
              <span className="text-slate-400 font-mono font-bold text-[9px] uppercase">Based on Risk pool</span>
              <span className="text-xs font-black text-slate-700">{highRisk.length} units (≤ 5 Days)</span>
            </div>
            <span className="text-[10px] font-bold text-orange-650 uppercase block">
              {projectedDelayFactor}d estimated overrun
            </span>
          </div>
        </div>

        {/* KPI 3: Actionable Active Assets (Total Exposure Count) */}
        <div className="bg-white border border-slate-250 p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between group relative overflow-hidden min-h-[170px]">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-indigo-50 w-24 h-24 rounded-full -z-10 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block">Actionable Active Inventory</span>
              <h3 className="text-4xl font-black text-slate-800 font-mono tracking-tight mt-1">
                {actionableInventoryCount}
              </h3>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-600 font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 select-none">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" /> ALERT COUNT
            </span>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-3">
            <div className="flex flex-col">
              <span className="text-slate-400 font-mono font-bold text-[9px] uppercase">Urgent Category Breakdown</span>
              <span className="text-[10px] font-bold text-slate-500">{demurrage.length} Overdue + {highRisk.length} High Risk</span>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase block tracking-wide shrink-0">
              Immediate corrective action
            </span>
          </div>
        </div>

        {/* KPI 4: Historic Protection Quotient */}
        <div className="bg-white border border-slate-250 p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between group relative overflow-hidden min-h-[170px]">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-emerald-50 w-24 h-24 rounded-full -z-10 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Historical Paid (Returned Late)</span>
              <h3 className="text-3xl font-black text-[#10b981] font-mono tracking-tight mt-1">
                {formatCost(historicalDemurragePaid)}
              </h3>
            </div>
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 select-none">
              <CheckCircle2 className="w-3.5 h-3.5" /> PAID_HISTORIC
            </span>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-3">
            <div className="flex flex-col">
              <span className="text-slate-400 font-mono font-bold text-[9px] uppercase">Return Efficiency ratio</span>
              <span className="text-xs font-black text-slate-700">
                {onTimeReturnedCount} On-Time / {lateReturnedCount} Overdue
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#10b981] uppercase block tracking-wide select-none">
              Total historic returned
            </span>
          </div>
        </div>

      </div>

      {// Interactive Search & Filtering Controls Area
      }
      <div className="bg-slate-100 p-5 rounded-2xl border border-slate-205 flex flex-col sm:flex-row gap-4 items-center justify-between text-xs font-bold text-slate-600">
        <div className="flex-1 w-full relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Search by Container Number, Vessel name, BL number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold placeholder-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>

        <div className="flex gap-4 w-full sm:w-auto overflow-x-auto select-none">
          {/* Shipowner Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-slate-400 uppercase text-[9px] font-bold">CARRIER:</span>
            <select 
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="bg-transparent font-black text-slate-755 cursor-pointer outline-none text-[11px]"
            >
              <option value="ALL">ALL CARRIERS</option>
              <option value="MSC">MSC</option>
              <option value="CMA CGM">CMA CGM</option>
              <option value="ONE">ONE</option>
              <option value="COSCO">COSCO</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>

          {/* Terminal Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-slate-400 uppercase text-[9px] font-bold">TERMINAL:</span>
            <select 
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="bg-transparent font-black text-slate-755 cursor-pointer outline-none text-[11px]"
            >
              <option value="ALL">ALL TERMINALS</option>
              <option value="TECON">TECON S.A.</option>
              <option value="TPC">TPC OPERADOR</option>
              <option value="INTERMARITIMA">INTERMARITIMA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overhauled Kanban / Board Columns Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-black tracking-tight text-slate-800 uppercase flex items-center gap-2.5">
          <span>Active Command Columns</span>
          <span className="text-[10px] bg-slate-200 font-extrabold px-2.5 py-1 rounded-full text-slate-600 uppercase font-mono tracking-widest leading-none">
            REAL-TIME PIPELINE DISPATCH
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
          
          {/* COLUMN 1: ANALISAR DATA */}
          <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-purple-50 border-b border-purple-150 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-purple-700 uppercase tracking-wider block">Analisar Data</h4>
                <p className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Missing expiry date</p>
              </div>
              <span className="bg-purple-150 text-purple-900 text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {dateIssue.filter(filterShipmentByUI).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {dateIssue.filter(filterShipmentByUI).map(renderContainerCard)}
                {dateIssue.filter(filterShipmentByUI).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-405 text-xs text-center p-4">
                    Nenhum contêiner pendente de auditoria de data / No issues found
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 2: COM DEMURRAGE (Crimson Red / High Attention) */}
          <div className="flex flex-col bg-red-50/20 border border-red-200 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-red-100 border-b border-red-200 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-red-700 uppercase tracking-wider block">Atrasado (Overdue)</h4>
                <p className="text-[9px] uppercase font-bold text-red-500 mt-0.5">Expired Free Time</p>
              </div>
              <span className="bg-red-520 bg-red-600 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {demurrage.filter(filterShipmentByUI).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {demurrage.filter(filterShipmentByUI).map(renderContainerCard)}
                {demurrage.filter(filterShipmentByUI).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center p-4">
                    Parabéns! Nenhum container gerando demurrage ativo / No overdue containers
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 3: ALTO RISCO (≤ 5 Days Remaining) */}
          <div className="flex flex-col bg-orange-50/20 border border-orange-200 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-orange-100 border-b border-orange-200 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-orange-700 uppercase tracking-wider block">Alto Risco</h4>
                <p className="text-[9px] uppercase font-bold text-orange-500 mt-0.5">≤ 5 Days Left</p>
              </div>
              <span className="bg-orange-500 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {highRisk.filter(filterShipmentByUI).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {highRisk.filter(filterShipmentByUI).map(renderContainerCard)}
                {highRisk.filter(filterShipmentByUI).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center p-4">
                    Nenhum container no limite crítico / Zero high risk units
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 4: RISCO MODERADO (6-15 Days Remaining) */}
          <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-wider block">Risco Moderado</h4>
                <p className="text-[9px] uppercase font-bold text-amber-500 mt-0.5">6 - 15 Days Left</p>
              </div>
              <span className="bg-amber-500 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {mediumRisk.filter(filterShipmentByUI).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {mediumRisk.filter(filterShipmentByUI).map(renderContainerCard)}
                {mediumRisk.filter(filterShipmentByUI).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-405 text-xs text-center p-4">
                    Sem unidades em processamento intermediário / No moderate risk units
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 5: ATENÇÃO (16-20 Days Remaining) */}
          <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-yellow-50 border-b border-yellow-250 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-yellow-700 uppercase tracking-wider block">Atenção</h4>
                <p className="text-[9px] uppercase font-bold text-yellow-600 mt-0.5">16 - 20 Days Left</p>
              </div>
              <span className="bg-yellow-400 text-slate-800 text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff <= 20;
                }).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff <= 20;
                }).map(renderContainerCard)}
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff <= 20;
                }).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center p-4">
                    Nenhum container nessas datas / Zero attention units
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 6: SOB CONTROLE (21+ Days Remaining) */}
          <div className="flex flex-col bg-emerald-50/10 border border-emerald-100 rounded-3xl overflow-hidden shadow-inner min-h-[500px]">
            <div className="p-4 bg-emerald-50 border-b border-emerald-150 flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider block">Sob Controle</h4>
                <p className="text-[9px] uppercase font-bold text-emerald-500 mt-0.5">21+ Days Left</p>
              </div>
              <span className="bg-emerald-500 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-sm">
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff > 20;
                }).length}
              </span>
            </div>
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[600px] demurrage-board-col">
              <AnimatePresence>
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff > 20;
                }).map(renderContainerCard)}
                {lowRisk.filter(filterShipmentByUI).filter(s => {
                  if (!s.freeTimeDate) return false;
                  const diff = Math.ceil((new Date(s.freeTimeDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                  return diff > 20;
                }).length === 0 && (
                  <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center p-4">
                    Nenhum container seguro / No secured units
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
