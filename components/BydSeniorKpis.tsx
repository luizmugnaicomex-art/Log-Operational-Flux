import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shipment } from "../types";
import { 
  TrendingUp, 
  Anchor, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Package, 
  Ship, 
  Warehouse, 
  Calendar,
  AlertCircle,
  Sliders,
  Maximize2,
  AlertTriangle,
  Mail,
  CheckCircle2,
  Send,
  Zap,
  Info
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts";

interface BydSeniorKpisProps {
  shipments: Shipment[];
}

export default function BydSeniorKpis({ shipments }: BydSeniorKpisProps) {
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState<string>("ALL");
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"current" | "projections" | "prep_ledger">("current");
  const [selectedPrepShipment, setSelectedPrepShipment] = useState<Shipment | null>(null);

  // Define reference evaluation date (current local time in metadata is May 21, 2026)
  const baseDate = useMemo(() => new Date("2026-05-21T00:00:00Z"), []);

  // Filter raw data reactively based on UI micro-controls
  const evaluatedShipments = useMemo(() => {
    return shipments.filter(s => {
      // Filter out completed/returned containers if showActiveOnly is active
      if (showActiveOnly) {
        const isDelivered = s.deliveryByd !== null;
        if (isDelivered) return false;
      }
      
      // Carrier filter
      if (selectedCarrierFilter !== "ALL") {
        const owner = (s.shipowner || "").toUpperCase();
        if (selectedCarrierFilter === "MSC" && !owner.includes("MSC")) return false;
        if (selectedCarrierFilter === "CMA" && !owner.includes("CMA")) return false;
        if (selectedCarrierFilter === "OTHERS" && (owner.includes("MSC") || owner.includes("CMA"))) return false;
      }
      
      return true;
    });
  }, [shipments, showActiveOnly, selectedCarrierFilter]);

  const totalActiveContainers = evaluatedShipments.length;

  // 1. Exact division by Carrier (MSC vs CMA CGM vs Others)
  const carrierDivision = useMemo(() => {
    let mscCount = 0;
    let cmaCount = 0;
    let othersCount = 0;

    evaluatedShipments.forEach(s => {
      const owner = (s.shipowner || "").toUpperCase();
      if (owner.includes("MSC")) {
        mscCount++;
      } else if (owner.includes("CMA") || owner.includes("ANL")) {
        cmaCount++;
      } else {
        othersCount++;
      }
    });

    const mscPct = totalActiveContainers > 0 ? ((mscCount / totalActiveContainers) * 100).toFixed(1) : "0.0";
    const cmaPct = totalActiveContainers > 0 ? ((cmaCount / totalActiveContainers) * 100).toFixed(1) : "0.0";
    const othersPct = totalActiveContainers > 0 ? ((othersCount / totalActiveContainers) * 100).toFixed(1) : "0.0";

    return {
      msc: { count: mscCount, pct: mscPct },
      cma: { count: cmaCount, pct: cmaPct },
      others: { count: othersCount, pct: othersPct }
    };
  }, [evaluatedShipments, totalActiveContainers]);

  // 2. 7 Days and 15 Days Future Projections Matrix
  const arrivalsMatrix = useMemo(() => {
    let within7Days = 0;
    let within15Days = 0;
    let farFuture = 0;

    const sevenDaysLater = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fifteenDaysLater = new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    const timelineData7: Record<string, number> = {};
    const timelineData15: Record<string, number> = {};

    evaluatedShipments.forEach(s => {
      const estDate = s.ata || s.estimatedDelivery;
      if (estDate) {
        const time = estDate.getTime();
        const baseTime = baseDate.getTime();

        if (time >= baseTime && time <= sevenDaysLater.getTime()) {
          within7Days++;
          const dateStr = estDate.toISOString().split('T')[0];
          timelineData7[dateStr] = (timelineData7[dateStr] || 0) + 1;
        }
        if (time >= baseTime && time <= fifteenDaysLater.getTime()) {
          within15Days++;
          const dateStr = estDate.toISOString().split('T')[0];
          timelineData15[dateStr] = (timelineData15[dateStr] || 0) + 1;
        } else if (time > fifteenDaysLater.getTime()) {
          farFuture++;
        }
      }
    });

    const timeline7List = Object.entries(timelineData7)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const timeline15List = Object.entries(timelineData15)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      within7Days,
      within15Days,
      farFuture,
      timeline7List,
      timeline15List
    };
  }, [evaluatedShipments, baseDate]);

  // 3. Volume by Terminal / Bonded Warehouse
  const terminalVolumeData = useMemo(() => {
    const warehouseCounts: Record<string, number> = {};

    evaluatedShipments.forEach(s => {
      let warehouse = s.bondedWarehouse || s.generalWarehouse || "PENDENTE";
      warehouse = warehouse.toUpperCase().trim();
      if (warehouse.includes("TECON")) warehouse = "TECON S.A.";
      else if (warehouse.includes("TPC")) warehouse = "TPC OPERADOR";
      else if (warehouse.includes("INTERMARITIMA") || warehouse.includes("INTER")) warehouse = "INTERMARITIMA";
      else if (warehouse.includes("CDEX") || warehouse.includes("AG -")) warehouse = "CDEX INTER";
      else if (warehouse.includes("CLIA") || warehouse.includes("EMPORIO")) warehouse = "CLIA EMPÓRIO";

      warehouseCounts[warehouse] = (warehouseCounts[warehouse] || 0) + 1;
    });

    return Object.entries(warehouseCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [evaluatedShipments]);

  // 4. Critical Action & Preparation Requirements Analysis
  const prepAlertsLedger = useMemo(() => {
    return evaluatedShipments.map(s => {
      const issues: string[] = [];
      let riskLevel: "HIGH" | "MEDIUM" | "STABLE" = "STABLE";

      // Flag 1: Missing DI (Lot number / Process number undefined or "N/A")
      const isMissingDI = !s.processNumber || s.processNumber === "N/A" || s.processNumber === "";
      if (isMissingDI) {
        issues.push("Falta Registro DI / Licença");
        riskLevel = "HIGH";
      }

      // Flag 2: Missing Nota Fiscal (NF) Date
      const isMissingNF = !s.dateNF;
      if (isMissingNF) {
        issues.push("Aguardando Lançamento de NF");
        if (riskLevel !== "HIGH") riskLevel = "MEDIUM";
      }

      // Flag 3: Missing deliveryByd schedule
      const isMissingSchedule = !s.deliveryByd;
      if (isMissingSchedule) {
        issues.push("Sem Agendamento Transportadora");
        if (riskLevel !== "HIGH") riskLevel = "MEDIUM";
      }

      // Flag 4: High detention risk (arrived and near freeTimeDate)
      let freeTimeDaysRemaining = 99;
      if (s.ata && s.freeTime) {
        const daysInYard = Math.floor((baseDate.getTime() - s.ata.getTime()) / (24 * 60 * 60 * 1000));
        const limitDays = Math.floor((s.freeTime.getTime() - s.ata.getTime()) / (24 * 60 * 60 * 1000));
        freeTimeDaysRemaining = limitDays - daysInYard;
        if (freeTimeDaysRemaining <= 3 && !s.deliveryByd) {
          issues.push(`Risco Crítico Demurrage (${freeTimeDaysRemaining}d restantes)`);
          riskLevel = "HIGH";
        }
      }

      return {
        shipment: s,
        issues,
        riskLevel,
        freeTimeDaysRemaining
      };
    })
    .filter(item => item.issues.length > 0)
    .sort((a, b) => {
      if (a.riskLevel === "HIGH" && b.riskLevel !== "HIGH") return -1;
      if (a.riskLevel !== "HIGH" && b.riskLevel === "HIGH") return 1;
      return a.freeTimeDaysRemaining - b.freeTimeDaysRemaining;
    });
  }, [evaluatedShipments, baseDate]);

  const stats = useMemo(() => {
    const highRiskCount = prepAlertsLedger.filter(r => r.riskLevel === 'HIGH').length;
    const mediumRiskCount = prepAlertsLedger.filter(r => r.riskLevel === 'MEDIUM').length;
    return { highRiskCount, mediumRiskCount };
  }, [prepAlertsLedger]);

  return (
    <div className="flex flex-col gap-8 w-full pb-24">
      
      {/* Upper Status Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-100 p-8 rounded-[2.5rem] border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg text-white font-black text-xl leading-none">
            BYD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Active Shipments Intelligence</h2>
              <span className="text-[10px] font-black uppercase text-indigo-650 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 animate-pulse" /> Supervisor Audit
              </span>
            </div>
            <p className="text-slate-500 font-bold tracking-wide text-xs mt-1 uppercase opacity-80">
              PREPARATION CONTROL PANEL • CURRENT STATE, 7-DAY & 15-DAY OUTLOOK DEMURRAGE COMPLIANCE
            </p>
          </div>
        </div>

        {/* Dynamic Controls Inline */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 border rounded-full text-xs font-bold text-slate-600 shadow-sm">
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Carrier:</span>
            <select 
              value={selectedCarrierFilter}
              onChange={(e) => setSelectedCarrierFilter(e.target.value)}
              className="outline-none bg-transparent font-black text-indigo-600 cursor-pointer"
            >
              <option value="ALL">ALL CARRIERS</option>
              <option value="MSC">MSC LINE</option>
              <option value="CMA">CMA CGM</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>

          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${showActiveOnly ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 shadow-sm"}`}
          >
            <Clock className="w-3.5 h-3.5" />
            {showActiveOnly ? "Active Undelivered Only" : "All Database Units"}
          </button>
        </div>
      </div>

      {/* Senior Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-4 no-export">
        {[
          { id: "current", label: "1. Current Situation", icon: Layers },
          { id: "projections", label: "2. 7D & 15D Future Outlook", icon: Calendar },
          { id: "prep_ledger", label: "3. Compliance & Prep Alerts Ledger", icon: AlertTriangle, badge: stats.highRiskCount }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-4 px-6 font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all relative ${activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-mono text-[9px] font-black leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {/* TAB 1: CURRENT SITUATION */}
          {activeTab === "current" && (
            <div className="space-y-10">
              {/* Statistical Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-black text-slate-405 uppercase tracking-wider block">Total Active Cargos</span>
                  <div className="text-4xl font-extrabold text-slate-800 font-mono tracking-tight mt-3">{totalActiveContainers}</div>
                  <span className="text-[10px] text-indigo-500 font-semibold mt-2">Undelivered units currently in play</span>
                </div>

                <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-black text-slate-405 uppercase tracking-wider block">MSC Carriage share</span>
                  <div className="text-4xl font-extrabold text-amber-600 font-mono tracking-tight mt-3">
                    {carrierDivision.msc.count} <span className="text-xs text-slate-400">({carrierDivision.msc.pct}%)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-2">Mediterranean Shipping Company</span>
                </div>

                <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-black text-slate-405 uppercase tracking-wider block">CMA CGM Carriage share</span>
                  <div className="text-4xl font-extrabold text-blue-600 font-mono tracking-tight mt-3">
                    {carrierDivision.cma.count} <span className="text-xs text-slate-400">({carrierDivision.cma.pct}%)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-2">French Line Containers</span>
                </div>

                <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-black text-slate-405 uppercase tracking-wider block">Compliance Failures</span>
                  <div className="text-4xl font-extrabold text-red-500 font-mono tracking-tight mt-3">
                    {prepAlertsLedger.length}
                  </div>
                  <span className="text-[10px] text-red-400 font-extrabold mt-2 flex items-center gap-1">
                     <AlertCircle className="w-3.5 h-3.5" /> Immediate actions required
                  </span>
                </div>
              </div>

              {/* Terminal distributions chart */}
              <div className="glass p-10 rounded-[3rem] ring-1 ring-white/50 bg-white">
                <div className="mb-6">
                  <h3 className="text-xl font-display font-black text-slate-800 tracking-tight">Active Yard Volumes by Primary Terminals</h3>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">Units currently residing at bonded and general depots</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={terminalVolumeData.slice(0, 8)} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 750, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 750, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={30}>
                        {terminalVolumeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "#4338ca" : index === 1 ? "#4f46e5" : "#6366f1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FUTURE ARRIVAL PROJECTIONS */}
          {activeTab === "projections" && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">7-DAYS ARRIVAL SUM</span>
                        <h4 className="text-4xl font-extrabold text-slate-800 font-mono tracking-tight mt-3">{arrivalsMatrix.within7Days}</h4>
                     </div>
                     <div className="bg-amber-100 p-2.5 rounded-xl"><Clock className="w-5 h-5 text-amber-600" /></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4 font-medium">Containers approaching Port ATA within immediate week. Critical window for securing DIs.</p>
                </div>

                <div className="bg-white border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">15-DAYS ARRIVAL SUM</span>
                        <h4 className="text-4xl font-extrabold text-indigo-650 font-mono tracking-tight mt-3">{arrivalsMatrix.within15Days}</h4>
                     </div>
                     <div className="bg-indigo-100 p-2.5 rounded-xl"><Calendar className="w-5 h-5 text-indigo-600" /></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4 font-medium">Cumulative arrivals expected over the next fortnight. Prepare yard allocations.</p>
                </div>

                <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-md flex flex-col justify-between">
                  <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">COMPLIANCE STRATEGY</span>
                     <h4 className="text-lg font-black tracking-tight text-emerald-400 mt-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Proactive Lead
                     </h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 font-medium">Brokers must submit document packets for the 7D arrivals to avoid demurrage multipliers.</p>
                </div>
              </div>

              {/* 15 Days Projections Timeline */}
              <div className="glass p-10 rounded-[3rem] ring-1 ring-white/50 bg-white">
                <div className="mb-6">
                  <h3 className="text-xl font-display font-black text-slate-800 tracking-tight">15-Day Inbound Arrivals Projection Timeline</h3>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">Expected daily container arrivals over next 15 days window</p>
                </div>
                <div className="h-[300px] w-full">
                  {arrivalsMatrix.timeline15List.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={arrivalsMatrix.timeline15List} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 750, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 750, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" name="Projected Arrivals" stroke="#4F46E5" strokeWidth={3} dot={{ r: 5, fill: '#4F46E5' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold uppercase tracking-wider">
                       No projected arrivals within next 15 days under active criteria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLIANCE & PREPARATION CHECKLIST ALERTS */}
          {activeTab === "prep_ledger" && (
            <div className="space-y-10">
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl text-sm text-amber-900 flex items-start gap-4">
                 <div className="bg-amber-100 p-2.5 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5 text-amber-700" /></div>
                 <div>
                    <h4 className="font-extrabold uppercase tracking-wide text-amber-800">Critical Preparation Directive</h4>
                    <p className="text-xs text-amber-700 mt-1 font-medium">
                       The following shipments are physically present / arriving, but suffer from administrative deficiencies (missing DI process numbers, missing invoice NF records, or missing dispatch schedules). Address these immediately to mitigate detention risk and procurement budget penalties.
                    </p>
                 </div>
              </div>

              {/* Prep Targets Ledger Table */}
              <div className="glass rounded-[2.5rem] overflow-hidden shadow-md border border-slate-200">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                        <th className="px-8 py-5">Container ID</th>
                        <th className="px-6 py-5">Vessel / Carrier</th>
                        <th className="px-6 py-5">ATA</th>
                        <th className="px-6 py-5">Remaining Days</th>
                        <th className="px-8 py-5">Identified Deficiencies / Missing Items</th>
                        <th className="px-8 py-5 text-center">Action Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prepAlertsLedger.length > 0 ? (
                        prepAlertsLedger.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4.5">
                              <span className="text-sm font-display font-black text-slate-800">{row.shipment.containerNumber}</span>
                            </td>
                            <td className="px-6 py-4.5">
                              <span className="text-xs font-bold text-slate-600 block">{row.shipment.vesselName || 'UNKNOWN'}</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">{row.shipment.shipowner || '-'}</span>
                            </td>
                            <td className="px-6 py-4.5">
                              <span className="text-xs font-bold text-slate-500 font-mono">
                                {row.shipment.ata ? row.shipment.ata.toLocaleDateString('en-GB') : 'Yet to Arrive'}
                              </span>
                            </td>
                            <td className="px-6 py-4.5">
                              <span className={`text-xs font-mono font-black ${row.freeTimeDaysRemaining < 3 ? 'text-red-500 font-black' : 'text-slate-500'}`}>
                                {row.freeTimeDaysRemaining < 90 ? `${row.freeTimeDaysRemaining} days` : 'N/A'}
                              </span>
                            </td>
                            <td className="px-8 py-4.5">
                              <div className="flex flex-wrap gap-2">
                                {row.issues.map((issue, idx) => (
                                  <span 
                                    key={idx} 
                                    className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${row.riskLevel === 'HIGH' ? 'bg-red-100 text-red-850 border border-red-200' : 'bg-amber-100 text-amber-850 border border-amber-200'}`}
                                  >
                                    {issue}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-8 py-4.5 text-center">
                              <button
                                onClick={() => setSelectedPrepShipment(row.shipment)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 text-white hover:bg-indigo-650 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm active:scale-95"
                              >
                                <Mail className="w-3.5 h-3.5" /> Prep Mail
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-10">
                            <span className="text-slate-400 text-xs font-black uppercase tracking-widest leading-relaxed">No pending prepare operations found. Perfect compliance!</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Preparation Mail Template Modal Component */}
      <AnimatePresence>
        {selectedPrepShipment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] flex items-center justify-center p-6 no-export">
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-100"
            >
              {/* Modal Banner */}
              <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 p-4">
                  <span className="material-icons text-7xl">send</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">BYD Operations Intelligence</span>
                <h3 className="text-2xl font-display font-black tracking-tight mt-2">Prepared Draft Email Ticket</h3>
              </div>

              {/* Email summary details */}
              <div className="p-8 space-y-6 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                <div className="space-y-1">
                   <div className="flex border-b pb-2 text-xs font-bold text-slate-500">
                      <span className="w-20 font-black">To:</span>
                      <span className="text-slate-800 font-mono">byd.comex.procurement@byd.com; despachante.auditoria@logistics.com</span>
                   </div>
                   <div className="flex border-b pt-2 pb-2 text-xs font-bold text-slate-500">
                      <span className="w-20 font-black">Subject:</span>
                      <span className="text-slate-800 font-mono">PRIORITY COMPLIANCE DISPATCH: {selectedPrepShipment.containerNumber} // Vessel: {selectedPrepShipment.vesselName || 'N/A'}</span>
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-700 leading-relaxed space-y-4 font-mono select-all">
                  <p>Prezados,</p>
                  <p>Encargos prioritários de desembaraço e desalfandegamento pendentes para a unidade <strong>{selectedPrepShipment.containerNumber}</strong>.</p>
                  <p>Informações de Operação:</p>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                     <li>Vessel/Navio: {selectedPrepShipment.vesselName || 'N/A'}</li>
                     <li>Carrier/Armador: {selectedPrepShipment.shipowner || 'N/A'}</li>
                     <li>DI cadastrada em sistema: {selectedPrepShipment.processNumber || 'PENDENTE / VERIFICAR'}</li>
                     <li>Status de Faturamento (Nota Fiscal): {selectedPrepShipment.dateNF ? `Concluído em ${new Date(selectedPrepShipment.dateNF).toLocaleDateString('pt-BR')}` : 'PENDENTE / AGUARDANDO LANÇAMENTO'}</li>
                     <li>Agendamento BYD: {selectedPrepShipment.deliveryByd ? `Marcado para ${new Date(selectedPrepShipment.deliveryByd).toLocaleDateString('pt-BR')}` : 'PENDENTE / ADICIONAR DATA'}</li>
                     <li>Local de Armazenagem: {selectedPrepShipment.bondedWarehouse || 'N/A'}</li>
                  </ul>
                  <p>Favor revisar e atualizar os dados cadastrais em planilha para evitar multas adicionais de estadia.</p>
                  <p>Atenciosamente,<br/>BYD Supervisor Advisory Engine</p>
                </div>

                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-150 p-4 rounded-xl text-xs text-indigo-900 font-medium leading-normal">
                   <Info className="w-5 h-5 text-indigo-650 shrink-0" />
                   <span>The above draft highlights all critical gaps. You can copy it directly to send to custom agents or transit contractors.</span>
                </div>
              </div>

              {/* Modal controllers */}
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  onClick={() => setSelectedPrepShipment(null)}
                  className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Dismiss Ticket
                </button>
                <button
                  onClick={() => {
                    const mailto = `mailto:byd.comex.procurement@byd.com?subject=${encodeURIComponent(`PRIORITY COMPLIANCE DISPATCH: ${selectedPrepShipment.containerNumber}`)}&body=${encodeURIComponent(`Prezados,\n\nFavor revisar o status do container ${selectedPrepShipment.containerNumber}.\n\nAtenciosamente,\nOperaçoes BYD`)}`;
                    window.location.href = mailto;
                  }}
                  className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-full transition-colors flex items-center gap-2 shadow-md hover:shadow-indigo-500/20"
                >
                  <Send className="w-3.5 h-3.5" /> Launch Mail Client
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
