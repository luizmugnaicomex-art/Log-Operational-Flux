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
  Maximize2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";

interface BydSeniorKpisProps {
  shipments: Shipment[];
}

export default function BydSeniorKpis({ shipments }: BydSeniorKpisProps) {
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState<string>("ALL");
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(false);

  // Define reference evaluation date (current local time in metadata is May 21, 2026)
  const baseDate = useMemo(() => new Date("2026-05-21T00:00:00Z"), []);

  // Filter raw data reactively based on UI micro-controls
  const evaluatedShipments = useMemo(() => {
    return shipments.filter(s => {
      // Filter out completed/returned containers if requested
      if (showActiveOnly) {
        const isReturned = s.actualDepotReturnDate !== null || s.status?.toUpperCase().includes("RETURNED");
        if (isReturned) return false;
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

  // 1. Total Active Containers Metric
  const totalActiveContainers = useMemo(() => {
    return evaluatedShipments.length;
  }, [evaluatedShipments]);

  // 2. Exact division by Carrier (MSC vs CMA CGM vs Others)
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

  // 3. Arrival Projections (ATA within next 7 days, or empty/yet to arrive)
  const arrivalProjections = useMemo(() => {
    let next7DaysCount = 0;
    let withoutAtaCount = 0;
    let alreadyArrived = 0;

    const sevenDaysLater = new Date(baseDate);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    evaluatedShipments.forEach(s => {
      if (!s.ata) {
        withoutAtaCount++;
      } else {
        const ataTime = new Date(s.ata).getTime();
        const baseTime = baseDate.getTime();
        const endTime = sevenDaysLater.getTime();

        if (ataTime >= baseTime && ataTime <= endTime) {
          next7DaysCount++;
        } else if (ataTime < baseTime) {
          alreadyArrived++;
        } else {
          withoutAtaCount++; // Future far arrivals grouped
        }
      }
    });

    return {
      next7Days: next7DaysCount,
      withoutAta: withoutAtaCount,
      alreadyArrived
    };
  }, [evaluatedShipments, baseDate]);

  // 4. Volume by Terminal / Bonded Warehouse
  const terminalVolumeData = useMemo(() => {
    const warehouseCounts: Record<string, number> = {};

    evaluatedShipments.forEach(s => {
      let warehouse = s.bondedWarehouse || s.generalWarehouse || "NÃO DEF.";
      // Clean and normalize label for chart beauty
      warehouse = warehouse.toUpperCase().trim();
      if (warehouse.includes("TECON")) warehouse = "TECON S.A.";
      else if (warehouse.includes("TPC")) warehouse = "TPC OPERADOR";
      else if (warehouse.includes("INTERMARITIMA") || warehouse.includes("INTER")) warehouse = "INTERMARITIMA";
      else if (warehouse.includes("CDEX") || warehouse.includes("AG -")) warehouse = "CDEX INTER";
      else if (warehouse.includes("CLIA") || warehouse.includes("EMPORIO")) warehouse = "CLIA EMPÓRIO";
      else if (warehouse === "") warehouse = "PENDENTE";

      warehouseCounts[warehouse] = (warehouseCounts[warehouse] || 0) + 1;
    });

    // Format list for charts
    const list = Object.entries(warehouseCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // Sort descending
    return list.sort((a, b) => b.value - a.value);
  }, [evaluatedShipments]);

  // Dynamic scatter data format for advanced display representation
  const scatterData = useMemo(() => {
    return terminalVolumeData.map((item, index) => ({
      x: index + 1,
      y: item.value,
      z: item.value * 10,
      name: item.name
    }));
  }, [terminalVolumeData]);

  // High couture color palette
  const COLORS = ["#4338ca", "#0284c7", "#f43f5e", "#10b981", "#8b5cf6", "#f59e0b"];

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Upper Status Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-100 p-8 rounded-[2.5rem] border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg text-white font-black text-xl leading-none">
            BYD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Active Shipments Intelligence</h2>
              <span className="text-[10px] font-black uppercase text-indigo-605 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> REATIVE METRICS
              </span>
            </div>
            <p className="text-slate-500 font-bold tracking-wide text-xs mt-1 uppercase opacity-80">
              Controle Sênior de Armadores • Prospecção 7 Dias • Fluxo de Parques Geral (Filtros Ativos)
            </p>
          </div>
        </div>

        {/* Dynamic Controls Inline */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 border rounded-full text-xs font-bold text-slate-600 shadow-sm">
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filtro Armador:</span>
            <select 
              value={selectedCarrierFilter}
              onChange={(e) => setSelectedCarrierFilter(e.target.value)}
              className="outline-none bg-transparent font-black text-indigo-600 cursor-pointer"
            >
              <option value="ALL">TODOS (ALL)</option>
              <option value="MSC">MSC LINE</option>
              <option value="CMA">CMA CGM</option>
              <option value="OTHERS">OUTROS</option>
            </select>
          </div>

          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${showActiveOnly ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 shadow-sm"}`}
          >
            <Clock className="w-3.5 h-3.5" />
            {showActiveOnly ? "Apenas em Trânsito" : "Todos os Containers"}
          </button>
        </div>
      </div>

      {/* KPI Highlight Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Active Containers */}
        <div className="bg-white border border-slate-200 rounded-[2.25rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-indigo-50 w-24 h-24 rounded-full -z-10 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Unidades Ativas</span>
              <span className="text-4xl font-extrabold text-slate-800 font-mono tracking-tight mt-2 block">
                {totalActiveContainers}
              </span>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-600 font-black px-2 py-1 rounded-full flex items-center gap-1 font-mono">
              <Package className="w-3 h-3 text-indigo-600" /> ● LIVE
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
            <span className="font-bold text-slate-600">Total Geral de Lotes filtrados na sessão atual</span>
          </div>
        </div>

        {/* KPI 2: Shipowner Splits */}
        <div className="bg-white border border-slate-200 rounded-[2.25rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-rose-50 w-24 h-24 rounded-full -z-10 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Participação de Armadores</span>
              <div className="flex gap-4 mt-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 block font-mono">MSC</span>
                  <span className="text-xl font-bold text-amber-600 font-mono tracking-tight">{carrierDivision.msc.count} <span className="text-[11px] font-medium text-slate-400">({carrierDivision.msc.pct}%)</span></span>
                </div>
                <div className="border-l border-slate-150 pl-4">
                  <span className="text-[9px] font-bold text-slate-400 block font-mono">CMA CGM</span>
                  <span className="text-xl font-bold text-blue-600 font-mono tracking-tight">{carrierDivision.cma.count} <span className="text-[11px] font-medium text-slate-400">({carrierDivision.cma.pct}%)</span></span>
                </div>
                <div className="border-l border-slate-150 pl-4">
                  <span className="text-[9px] font-bold text-slate-400 block font-mono">OUTROS</span>
                  <span className="text-xl font-bold text-slate-600 font-mono tracking-tight">{carrierDivision.others.count} <span className="text-[11px] font-medium text-slate-400">({carrierDivision.others.pct}%)</span></span>
                </div>
              </div>
            </div>
            <span className="text-[9px] bg-indigo-50 text-indigo-700 font-black px-2 py-1 rounded-full flex items-center gap-1">
              <Ship className="w-3 h-3 text-indigo-500" /> SHARES
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
            <span className="font-bold text-slate-600">Representação da Frota Marítima ativa</span>
          </div>
        </div>

        {/* KPI 3: 7D Projection Arrivals */}
        <div className="bg-white border border-slate-200 rounded-[2.25rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 bg-emerald-50 w-24 h-24 rounded-full -z-10 group-hover:scale-110 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Projeção Próximos 7 Dias</span>
              <div className="flex gap-6 mt-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Chegadas</span>
                  <span className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">{arrivalProjections.next7Days}</span>
                  <span className="text-[9px] text-slate-400 block">UNIDADES 7D</span>
                </div>
                <div className="border-l border-slate-150 pl-6">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Em Trânsito s/ ATA</span>
                  <span className="text-2xl font-bold text-indigo-600 font-mono tracking-tight">{arrivalProjections.withoutAta}</span>
                  <span className="text-[9px] text-slate-400 block">SEM REGISTRO</span>
                </div>
              </div>
            </div>
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3" /> 7D FOCUS
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
            <span className="font-bold text-slate-600">Base tempo de referência atual: 21/05/2026</span>
          </div>
        </div>

      </div>

      {/* Analytics Visualization Double Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Panel A: Volume by Bonded Warehouse (Terminal) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Ocupação por Terminal Destinatário</h3>
              <p className="text-slate-400 text-xs font-semibold">Alocação total de contêineres e fluxo reativo por bondedWarehouse</p>
            </div>
            <span className="text-[9px] font-black bg-indigo-50 px-3 py-1.5 rounded-full text-indigo-700 tracking-wider">
              PARQUE TOTAL
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={terminalVolumeData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold"
                  tickLine={false} 
                  axisLine={false} 
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                  labelStyle={{ fontWeight: 'black', color: '#1e293b', fontSize: '11px' }}
                  itemStyle={{ color: '#4338ca', fontSize: '11px' }}
                />
                <Bar dataKey="value" stroke="none" radius={[0, 8, 8, 0]} maxBarSize={18}>
                  {terminalVolumeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel B: Executive Distribution Details Spot */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 uppercase tracking-widest block">Estágio Logístico Reativo</span>
              <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" /> ANALYTICS DOCK
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">Já Descarregados</span>
                </div>
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {arrivalProjections.alreadyArrived} <span className="text-[10px] text-slate-400 font-medium">Contêineres</span>
                </span>
              </div>

              <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-600">Chegando em breve (7 Dias)</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 font-mono">
                  {arrivalProjections.next7Days} <span className="text-[10px] text-slate-400 font-medium">Unidades</span>
                </span>
              </div>

              <div className="flex justify-between items-center pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-600">A caminho / s/ ATA</span>
                </div>
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {arrivalProjections.withoutAta} <span className="text-[10px] text-slate-400 font-medium">Unidades</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 border p-5 rounded-2xl">
            <h4 className="text-[10px] font-black text-byd-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-500" /> RESUMO EXECUTIVO
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              O fluxo logístico ativo exibe alta concentração com o armador <span className="font-bold text-amber-600">MSC</span>, totalizando <span className="font-bold text-slate-700">{carrierDivision.msc.count} contêineres</span>, seguido por <span className="font-bold text-blue-600">CMA CGM</span> com <span className="font-bold text-slate-700">{carrierDivision.cma.count} contêineres</span>. O principal gargalo físico situa-se no estoque do porto/parque de <span className="font-bold text-indigo-650">TECON S.A.</span>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
