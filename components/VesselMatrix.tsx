import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment, VesselMatrixData } from '../types';
import { calculateVesselMatrix, generateMarineFluxMatrix } from '../utils/dataProcessor';

interface VesselMatrixProps {
  shipments: Shipment[];
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const VesselMatrix: React.FC<VesselMatrixProps> = ({ shipments = [] }) => {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>([]);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isIncotermsOpen, setIsIncotermsOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [observations, setObservations] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('vesselObservations');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleObservationChange = (vessel: string, value: string) => {
    const newObservations = { ...observations, [vessel]: value };
    setObservations(newObservations);
    localStorage.setItem('vesselObservations', JSON.stringify(newObservations));
  };

  type ModalViewConfig = {
    type: 'grand_total' | 'vessel_total' | 'vessel_status' | 'vessel_warehouse' | 'grand_status' | 'grand_warehouse' | 'terminal_summary';
    vessel?: string;
    eta?: Date | null;
    status?: string;
    warehouse?: string;
    terminalName?: string;
    terminalSummaryCategory?: 'current' | 'future';
  } | null;

  const [modalConfig, setModalConfig] = useState<ModalViewConfig>(null);

  const uniqueVesselNames = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    const names = new Set(shipments.map(s => s?.vesselName?.trim().toUpperCase()).filter((v): v is string => Boolean(v)));
    return Array.from(names).sort();
  }, [shipments]);

  const uniqueStatusesTotal = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    const statuses = new Set<string>();
    shipments.forEach(s => {
      if (!s) return;
      const comexStatus = s.statusComex?.trim().toUpperCase();
      if (comexStatus) {
        statuses.add(comexStatus);
      } else {
        const status = s.status?.trim().toUpperCase();
        if (status) statuses.add(status);
        else statuses.add("UNKNOWN STATUS");
      }
    });
    return Array.from(statuses).sort();
  }, [shipments]);

  const uniqueIncoterms = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    const incoterms = new Set(shipments.map(s => s?.incoterm?.trim().toUpperCase()).filter((i): i is string => Boolean(i)));
    return Array.from(incoterms).sort();
  }, [shipments]);

  const handleClearFilters = () => {
    setSelectedVessels([]);
    setSelectedStatuses([]);
    setSelectedIncoterms([]);
    setStartDate('');
    setEndDate('');
  };

  const filteredShipments = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    return shipments.filter(s => {
      if (!s) return false;

      if (selectedVessels.length > 0) {
        const vName = s.vesselName?.trim().toUpperCase();
        if (!vName || !selectedVessels.includes(vName)) return false;
      }

      if (selectedStatuses.length > 0) {
        const status = (s.statusComex?.trim().toUpperCase()) || (s.status?.trim().toUpperCase()) || "UNKNOWN STATUS";
        if (!selectedStatuses.includes(status)) return false;
      }

      if (selectedIncoterms.length > 0) {
        const incoterm = (s.incoterm?.trim().toUpperCase()) || "UNKNOWN INCOTERM";
        if (!selectedIncoterms.includes(incoterm)) return false;
      }
      
      if (startDate || endDate) {
        const eta = s.ata || s.estimatedDelivery;
        if (!eta || !isValidDate(eta)) return (startDate === '' && endDate === '');
        
        if (startDate) {
          const sd = new Date(startDate);
          if (isValidDate(sd)) {
            sd.setUTCHours(0, 0, 0, 0);
            if (eta < sd) return false;
          }
        }
        if (endDate) {
          const ed = new Date(endDate);
          if (isValidDate(ed)) {
            ed.setUTCHours(23, 59, 59, 999);
            if (eta > ed) return false;
          }
        }
      }
      
      return true;
    });
  }, [shipments, selectedVessels, startDate, endDate, selectedStatuses, selectedIncoterms]);

  const matrixData = useMemo<VesselMatrixData>(() => {
    return calculateVesselMatrix(filteredShipments);
  }, [filteredShipments]);

  const warehouseSummary = useMemo(() => {
    const capacities: Record<string, number> = {
        'INTERMARITIMA': 1200,
        'TECON': 2000,
        'AG - INTER CDEX': 1500,
        'TPC': 1500,
        'CLIA': 300,
        'BUFFER - TERCAM': 350
    };

    const warehouseOrder = [
        "INTERMARITIMA",
        "TECON",
        "AG - INTER CDEX",
        "TPC",
        "CLIA",
        "BUFFER - TERCAM"
    ];

    const currentStatuses = ["CARGO PRESENCE", "RT DECLARATION", "CARGO CLEARED", "CARGO READY"];
    const futureStatuses = ["IN TRANSIT", "AT THE PORT"];

    const summary = warehouseOrder.reduce((acc, wh) => {
        acc[wh] = { capacity: capacities[wh] || 0, current: 0, future: 0 };
        return acc;
    }, {} as Record<string, { capacity: number, current: number, future: number }>);

    if (Array.isArray(filteredShipments)) {
      filteredShipments.forEach(s => {
          if (!s) return;
          let warehouse = s.bondedWarehouse && s.bondedWarehouse.toUpperCase() !== 'UNKNOWN' ? s.bondedWarehouse.trim().toUpperCase() : "";
          if (!warehouse) {
              warehouse = s.generalWarehouse ? s.generalWarehouse.trim().toUpperCase() : "";
          }
          
          let matchedWh: string | undefined = undefined;
          if (warehouse.includes('INTERMARITIMA') || warehouse.includes('INTER ARCO') || warehouse.includes('INTERMAR')) matchedWh = 'INTERMARITIMA';
          else if (warehouse.includes('TECON') || warehouse.includes('TECOM') || warehouse.includes('WILSON')) matchedWh = 'TECON';
          else if (warehouse.includes('AG') || warehouse.includes('SEDEX') || warehouse.includes('CDEX')) matchedWh = 'AG - INTER CDEX';
          else if (warehouse.includes('TPC')) matchedWh = 'TPC';
          else if (warehouse.includes('CLIA') || warehouse.includes('EMPORIO')) matchedWh = 'CLIA';
          else if (warehouse.includes('BUFFER') || warehouse.includes('TERCAM') || warehouse.includes('BUFFER-TERCAM')) matchedWh = 'BUFFER - TERCAM';

          if (!matchedWh) return;

          // If it has a delivery date, it's gone
          if (s.deliveryByd) return;

          const status = (s.statusComex && s.statusComex.trim() !== '') 
              ? s.statusComex.trim().toUpperCase() 
              : ((s.status && s.status.trim() !== '') ? s.status.trim().toUpperCase() : "UNKNOWN STATUS");

          // Ignore CARGO DELIVERED
          if (status === "CARGO DELIVERED" || status === "DELIVERED") return;

          const isCurrent = currentStatuses.includes(status);
          const isFuture = futureStatuses.includes(status);

          if (isCurrent) summary[matchedWh].current += 1;
          if (isFuture) summary[matchedWh].future += 1;
      });
    }

    let totalCap = 0; let totalCurr = 0; let totalFut = 0;
    
    const details = warehouseOrder.map(wh => {
        const item = summary[wh];
        totalCap += item.capacity; totalCurr += item.current; totalFut += item.future;
        
        const forecast = item.current + item.future;
        const utilization = item.capacity > 0 ? (forecast / item.capacity) * 100 : 0;
        let collapsePointStr = "-";
        
        if (item.capacity > 0) {
           const exceed = forecast - item.capacity;
           if (exceed > 0) {
               collapsePointStr = `+${exceed} (Colapso)`;
           } else {
               collapsePointStr = `Livre: ${item.capacity - forecast}`;
           }
        } else {
           if (forecast > 0) {
               collapsePointStr = "Sem Cap. Definida";
           }
        }

        return {
            terminal: wh,
            capacity: item.capacity,
            current: item.current,
            future: item.future,
            forecastValue: forecast,
            forecastStr: item.capacity > 0 ? `${utilization.toFixed(1)}% | ${collapsePointStr}` : collapsePointStr,
            isCollapsed: item.capacity > 0 && forecast > item.capacity
        };
    });

    const totalForecast = totalCurr + totalFut;
    const totalUtil = totalCap > 0 ? (totalForecast / totalCap) * 100 : 0;
    let totalCollapse = "-";
    if (totalCap > 0) {
       const exc = totalForecast - totalCap;
       totalCollapse = exc > 0 ? `+${exc} (Colapso)` : `Livre: ${totalCap - totalForecast}`;
    } else {
       totalCollapse = totalForecast > 0 ? "Sem Cap. Definida" : "-";
    }
    
    return {
        details,
        total: {
            capacity: totalCap,
            current: totalCurr,
            future: totalFut,
            forecastValue: totalForecast,
            forecastStr: totalCap > 0 ? `${totalUtil.toFixed(1)}% | ${totalCollapse}` : totalCollapse,
            isCollapsed: totalCap > 0 && totalForecast > totalCap
        }
    };
  }, [filteredShipments]);

  const matchingShipments = useMemo(() => {
    if (!modalConfig || !Array.isArray(filteredShipments)) return [];
    
    return filteredShipments.filter(s => {
      if (!s) return false;
      const vessel = s.vesselName && s.vesselName.trim() !== '' ? s.vesselName.trim().toUpperCase() : "UNKNOWN VESSEL";
      const etaDate = s.ata || s.estimatedDelivery;
      const etaStr = etaDate && isValidDate(etaDate) ? etaDate.toISOString().split('T')[0] : 'UNKNOWN_ETA';
      
      const sStatus = (s.statusComex && s.statusComex.trim() !== '') 
          ? s.statusComex.trim().toUpperCase() 
          : ((s.status && s.status.trim() !== '') ? s.status.trim().toUpperCase() : "UNKNOWN STATUS");
            
      let sWarehouse = s.bondedWarehouse && s.bondedWarehouse.toUpperCase() !== 'UNKNOWN' ? s.bondedWarehouse.trim().toUpperCase() : "";
      if (!sWarehouse) {
          sWarehouse = s.generalWarehouse ? s.generalWarehouse.trim().toUpperCase() : "";
      }
      if (!sWarehouse || sWarehouse === 'UNKNOWN') {
          sWarehouse = "UNKNOWN WAREHOUSE";
      }

      if (modalConfig.type === 'terminal_summary') {
         if (s.deliveryByd) return false;
         
         const currentStatuses = ["CARGO PRESENCE", "RT DECLARATION", "CARGO CLEARED", "CARGO READY"];
         const futureStatuses = ["IN TRANSIT", "AT THE PORT"];
         if (sStatus === "CARGO DELIVERED" || sStatus === "DELIVERED") return false;

         let matchedWh: string | undefined = undefined;
         if (sWarehouse.includes('INTERMARITIMA') || sWarehouse.includes('INTER ARCO') || sWarehouse.includes('INTERMAR')) matchedWh = 'INTERMARITIMA';
         else if (sWarehouse.includes('TECON') || sWarehouse.includes('TECOM') || sWarehouse.includes('WILSON')) matchedWh = 'TECON';
         else if (sWarehouse.includes('AG') || sWarehouse.includes('SEDEX') || sWarehouse.includes('CDEX')) matchedWh = 'AG - INTER CDEX';
         else if (sWarehouse.includes('TPC')) matchedWh = 'TPC';
         else if (sWarehouse.includes('CLIA') || sWarehouse.includes('EMPORIO')) matchedWh = 'CLIA';
         else if (sWarehouse.includes('BUFFER') || sWarehouse.includes('TERCAM') || sWarehouse.includes('BUFFER-TERCAM')) matchedWh = 'BUFFER - TERCAM';

         if (matchedWh !== modalConfig.terminalName) return false;

         if (modalConfig.terminalSummaryCategory === 'current' && !currentStatuses.includes(sStatus)) return false;
         if (modalConfig.terminalSummaryCategory === 'future' && !futureStatuses.includes(sStatus)) return false;
         
         return true;
      }

      const targetEtaStr = modalConfig.eta && isValidDate(modalConfig.eta) ? modalConfig.eta.toISOString().split('T')[0] : 'UNKNOWN_ETA';

      if (['vessel_total', 'vessel_status', 'vessel_warehouse'].includes(modalConfig.type)) {
         if (vessel !== modalConfig.vessel || etaStr !== targetEtaStr) return false;
      }

      if (['vessel_status', 'grand_status'].includes(modalConfig.type)) {
         if (sStatus !== modalConfig.status) return false;
      }

      if (['vessel_warehouse', 'grand_warehouse'].includes(modalConfig.type)) {
         let mappedWarehouse = sWarehouse;
         if (sWarehouse.includes('INTERMARITIMA') || sWarehouse.includes('INTER ARCO') || sWarehouse.includes('INTERMAR')) mappedWarehouse = 'INTERMARITIMA';
         else if (sWarehouse.includes('TECON') || sWarehouse.includes('TECOM') || sWarehouse.includes('WILSON')) mappedWarehouse = 'TECON';
         else if (sWarehouse.includes('AG') || sWarehouse.includes('SEDEX') || sWarehouse.includes('CDEX')) mappedWarehouse = 'AG - INTER CDEX';
         else if (sWarehouse.includes('TPC')) mappedWarehouse = 'TPC';
         else if (sWarehouse.includes('CLIA') || sWarehouse.includes('EMPORIO')) mappedWarehouse = 'CLIA';
         else if (sWarehouse.includes('BUFFER') || sWarehouse.includes('TERCAM') || sWarehouse.includes('BUFFER-TERCAM')) mappedWarehouse = 'BUFFER - TERCAM';

         if (mappedWarehouse !== modalConfig.warehouse) return false;
      }

      return true;
    });
  }, [modalConfig, filteredShipments]);

  if (!matrixData || !matrixData.rows || matrixData.rows.length === 0) {
    return (
      <div className="flex flex-col h-full glass rounded-[3.5rem] p-12 text-center items-center justify-center min-h-[400px]">
         <div className="bg-slate-100 p-8 rounded-full mb-6 text-slate-300">
            <span className="material-icons text-6xl">vessel</span>
         </div>
         <h2 className="text-3xl font-display font-black text-slate-800">No Maritime Data</h2>
         <p className="text-slate-400 mt-4 max-w-sm">Use the filters above to refine your search or upload a dataset to begin maritime matrix analysis.</p>
         <button onClick={handleClearFilters} className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all cursor-pointer">Reset Matrix View</button>
      </div>
    );
  }

  const { rows, uniqueStatuses, uniqueWarehouses, grandTotals } = matrixData;

  const formatDate = (date: Date | null) => {
    if (!date || !isValidDate(date)) return '-';
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy
  };

  const handleExportMatrix = () => {
    if (!shipments || shipments.length === 0) return;
    const csv = generateMarineFluxMatrix(shipments);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Marine_Flux_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-10"
    >
      {/* Terminal Infrastructure Summary - Bento View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12 glass p-10 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-5">
               <span className="material-icons text-9xl">warehouse</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
               <div>
                  <h3 className="text-2xl font-display font-black text-slate-800 flex items-center gap-4">
                     <span className="bg-indigo-600 text-white p-2 rounded-xl text-sm material-icons">inventory_2</span>
                     Terminal Infrastructure Load
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Active Utilization Benchmark</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Global Capacity</p>
                     <p className="text-2xl font-display font-black text-slate-800 tracking-tighter">{warehouseSummary.total.capacity}</p>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-200"></div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${warehouseSummary.total.isCollapsed ? 'bg-red-500' : 'bg-emerald-500'} text-white`}>
                     {warehouseSummary.total.isCollapsed ? 'System Saturated' : 'Optimized'}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6 relative z-10">
               {warehouseSummary.details.map((w) => (
                  <motion.div 
                     key={w.terminal}
                     whileHover={{ y: -5 }}
                     className={`glass-dark rounded-[2.5rem] p-6 ring-1 ring-white/30 transition-all ${w.isCollapsed ? 'bg-red-500/10 ring-red-500/30' : 'hover:ring-indigo-500/30'}`}
                  >
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 h-8 flex items-center leading-tight">{w.terminal}</p>
                     <div className="space-y-4">
                        <div className="flex items-end justify-between">
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Forecast</p>
                              <p className={`text-2xl font-display font-black tracking-tighter ${w.isCollapsed ? 'text-red-600' : 'text-slate-800'}`}>
                                 {w.forecastValue}
                              </p>
                           </div>
                           <span className="text-[9px] font-black text-slate-400 uppercase">{w.capacity} C</span>
                        </div>
                        <div className="relative h-2 bg-slate-200/50 rounded-full overflow-hidden">
                           <div 
                              className={`h-full rounded-full transition-all duration-1000 ${w.isCollapsed ? 'bg-red-500' : 'bg-indigo-500'}`} 
                              style={{ width: `${Math.min(100, w.capacity > 0 ? (w.forecastValue / w.capacity) * 100 : 0)}%` }}
                           />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter gap-2">
                           <span 
                             className="text-indigo-600 cursor-pointer hover:underline"
                             onClick={() => w.current > 0 && setModalConfig({ type: 'terminal_summary', terminalName: w.terminal, terminalSummaryCategory: 'current' })}
                           >
                             Actual: {w.current}
                           </span>
                           <span 
                             className="text-amber-600 cursor-pointer hover:underline"
                             onClick={() => w.future > 0 && setModalConfig({ type: 'terminal_summary', terminalName: w.terminal, terminalSummaryCategory: 'future' })}
                           >
                             Future: {w.future}
                           </span>
                        </div>
                     </div>
                  </motion.div>
               ))}
            </div>
         </div>
      </div>

      {/* Main Vessel Matrix */}
      <div className="glass p-12 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass min-h-[600px] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-12">
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-4xl font-display font-black text-slate-800 tracking-[-0.04em]">Maritime <span className="text-indigo-600">Flux</span> Matrix</h2>
              <button 
                  onClick={handleExportMatrix}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                  <span className="material-icons text-base">download</span>
                  Extract Matrix
              </button>
            </div>
            <p className="text-slate-400 font-bold mt-3 tracking-widest text-[11px] uppercase opacity-60">Deep Sea Strategy & Arrival Convergence</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 glass-dark p-4 rounded-[2.5rem] ring-1 ring-white/30">
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Vessel Filter</label>
              <select 
                className="bg-white/60 border-none rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 ring-1 ring-black/5 focus:ring-indigo-500 focus:outline-none backdrop-blur-md"
                value={selectedVessels.length === 1 ? selectedVessels[0] : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedVessels(val ? [val] : []);
                }}
              >
                <option value="">All Vessels</option>
                {uniqueVesselNames.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[140px] relative z-50">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Process Status</label>
              <div 
                className="bg-white/60 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 ring-1 ring-black/5 backdrop-blur-md cursor-pointer flex justify-between items-center"
                onClick={() => setIsStatusOpen(!isStatusOpen)}
              >
                  <span className="truncate">{selectedStatuses.length === 0 ? "Full Lifecycle" : `${selectedStatuses.length} Selected`}</span>
                  <span className="material-icons text-sm">{isStatusOpen ? 'expand_less' : 'expand_more'}</span>
              </div>
              
              {isStatusOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-[60] w-64 max-h-64 overflow-y-auto custom-scrollbar p-2">
                    <div 
                        className={`px-3 py-2 text-xs font-bold cursor-pointer rounded-xl ${selectedStatuses.length === 0 ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                        onClick={() => { setSelectedStatuses([]); setIsStatusOpen(false); }}
                    >
                        Full Lifecycle
                    </div>
                    {uniqueStatusesTotal.map(s => (
                        <div 
                           key={s}
                           className={`px-3 py-2 text-xs cursor-pointer rounded-xl flex items-center justify-between ${selectedStatuses.includes(s) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
                           onClick={() => {
                               setSelectedStatuses(prev => prev.includes(s) ? prev.filter(p => p !== s) : [...prev, s]);
                           }}
                        >
                           {s}
                           {selectedStatuses.includes(s) && <span className="material-icons text-sm">check</span>}
                        </div>
                    ))}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-1.5 min-w-[140px] relative z-50">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Incoterms</label>
              <div 
                className="bg-white/60 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 ring-1 ring-black/5 backdrop-blur-md cursor-pointer flex justify-between items-center"
                onClick={() => setIsIncotermsOpen(!isIncotermsOpen)}
              >
                  <span className="truncate">{selectedIncoterms.length === 0 ? "All Incoterms" : `${selectedIncoterms.length} Selected`}</span>
                  <span className="material-icons text-sm">{isIncotermsOpen ? 'expand_less' : 'expand_more'}</span>
              </div>
              
              {isIncotermsOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-[60] w-64 max-h-64 overflow-y-auto custom-scrollbar p-2">
                    <div 
                        className={`px-3 py-2 text-xs font-bold cursor-pointer rounded-xl ${selectedIncoterms.length === 0 ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                        onClick={() => { setSelectedIncoterms([]); setIsIncotermsOpen(false); }}
                    >
                        All Incoterms
                    </div>
                    {uniqueIncoterms.map(i => (
                        <div 
                           key={i}
                           className={`px-3 py-2 text-xs cursor-pointer rounded-xl flex items-center justify-between ${selectedIncoterms.includes(i) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
                           onClick={() => {
                               setSelectedIncoterms(prev => prev.includes(i) ? prev.filter(p => p !== i) : [...prev, i]);
                           }}
                        >
                           {i}
                           {selectedIncoterms.includes(i) && <span className="material-icons text-sm">check</span>}
                        </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 bg-white/40 p-2 rounded-2xl ring-1 ring-black/5">
               <input 
                 type="date" 
                 className="bg-transparent border-none text-[10px] font-black uppercase text-slate-600 focus:outline-none px-2"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
               />
               <span className="text-slate-300">→</span>
               <input 
                 type="date" 
                 className="bg-transparent border-none text-[10px] font-black uppercase text-slate-600 focus:outline-none px-2"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
               />
            </div>
            {(selectedVessels.length > 0 || selectedStatuses.length > 0 || selectedIncoterms.length > 0 || startDate || endDate) && (
              <button 
                onClick={handleClearFilters}
                className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm shadow-red-100 cursor-pointer"
              >
                <span className="material-icons text-lg font-black">close</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-30">
              <tr className="border-b-[4px] border-indigo-600/10">
                <th className="px-6 py-8 font-display font-black uppercase text-[11px] bg-white text-slate-800 sticky left-0 z-40 border-r border-slate-100 min-w-[200px]" colSpan={2}>
                  Global Convergence
                  <span className="block text-[8px] text-slate-400 font-bold mt-1 tracking-widest">{filteredShipments.length} UNITS TRACKED</span>
                </th>
                
                {uniqueStatuses.map(status => (
                  <th 
                    key={`gt-status-${status}`} 
                    className={`px-3 py-8 font-display font-black text-center bg-indigo-600 text-white border-r border-white/10 group ${(grandTotals.statuses[status] || 0) > 0 ? 'cursor-pointer' : ''}`}
                    onClick={() => (grandTotals.statuses[status] || 0) > 0 && setModalConfig({ type: 'grand_status', status })}
                  >
                    <div className="group-hover:scale-110 transition-transform">{grandTotals.statuses[status] || 0}</div>
                  </th>
                ))}
                
                <th className="bg-slate-900 w-3 px-0 py-0"></th>

                {uniqueWarehouses.map(wh => (
                  <th 
                    key={`gt-wh-${wh}`} 
                    className={`px-3 py-8 font-display font-black text-center bg-amber-500 text-slate-900 border-r border-white/10 group ${(grandTotals.warehouses[wh] || 0) > 0 ? 'cursor-pointer' : ''}`}
                    onClick={() => (grandTotals.warehouses[wh] || 0) > 0 && setModalConfig({ type: 'grand_warehouse', warehouse: wh })}
                  >
                    <div className="group-hover:scale-110 transition-transform">{grandTotals.warehouses[wh] || 0}</div>
                  </th>
                ))}
                
                <th className="bg-slate-900 w-3 px-0 py-0"></th>

                <th 
                  className={`px-6 py-8 font-display font-black text-center text-white bg-slate-900 rounded-tr-3xl ${grandTotals.total > 0 ? 'cursor-pointer hover:bg-black' : ''}`}
                  onClick={() => grandTotals.total > 0 && setModalConfig({ type: 'grand_total' })}
                >
                  {grandTotals.total}
                </th>
              </tr>

              <tr className="bg-slate-50/50 backdrop-blur-xl border-b border-slate-200">
                <th className="px-6 py-5 font-black text-[10px] tracking-widest uppercase text-slate-400 sticky left-0 bg-slate-50/80 z-40 border-r border-slate-100 leading-none">Vessel Logic</th>
                <th className="px-6 py-5 font-black text-[10px] tracking-widest uppercase text-slate-400 text-center border-r border-slate-100 leading-none">ETA Window</th>
                
                {uniqueStatuses.map(status => (
                  <th key={`th-status-${status}`} className="px-4 py-5 font-black text-[8px] tracking-[0.2em] uppercase text-center border-r border-slate-200/50 text-slate-500 max-w-[100px] leading-tight">
                    {status}
                  </th>
                ))}

                <th className="bg-slate-800 w-3 px-0 py-0 opacity-20"></th>

                {uniqueWarehouses.map((wh) => (
                  <th key={`th-wh-${wh}`} className="px-4 py-5 font-black text-[8px] tracking-[0.2em] uppercase text-center border-r border-slate-200/50 text-slate-500 max-w-[100px] leading-tight font-sans">
                    {wh}
                  </th>
                ))}

                <th className="bg-slate-800 w-3 px-0 py-0 opacity-20"></th>

                <th className="px-6 py-5 font-black text-[10px] tracking-widest uppercase text-center text-slate-500 leading-none">NET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <motion.tr 
                  key={`vessel-${idx}`} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-indigo-50/30 transition-colors group"
                >
                  <td className="px-6 py-4 font-display font-black text-sm text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] group-hover:text-indigo-600 transition-colors flex flex-col items-start gap-1">
                    {row.vessel}
                    <input
                      type="text"
                      placeholder="Add observation..."
                      className="text-[9px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2 py-1 w-full border-none focus:ring-1 focus:ring-indigo-500/50"
                      value={observations[row.vessel] || ''}
                      onChange={(e) => handleObservationChange(row.vessel, e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap border-r border-slate-100 text-center">
                    {formatDate(row.eta)}
                  </td>
                  
                  {uniqueStatuses.map(status => (
                    <td 
                      key={`td-status-${row.vessel}-${status}`} 
                      className={`px-4 py-4 text-center border-r border-slate-100/50 text-xs font-black transition-all ${row.statuses[status] > 0 ? 'cursor-pointer hover:bg-white hover:shadow-xl hover:scale-110 text-indigo-600' : 'text-slate-200'}`}
                      onClick={() => row.statuses[status] > 0 && setModalConfig({ type: 'vessel_status', vessel: row.vessel, eta: row.eta, status })}
                    >
                      {row.statuses[status] > 0 ? row.statuses[status] : "-"}
                    </td>
                  ))}

                  <td className="bg-slate-50/30 w-3 px-0 py-0"></td>

                  {uniqueWarehouses.map(wh => (
                    <td 
                      key={`td-wh-${row.vessel}-${wh}`} 
                      className={`px-4 py-4 text-center border-r border-slate-100/50 text-xs font-black transition-all ${row.warehouses[wh] > 0 ? 'cursor-pointer hover:bg-white hover:shadow-xl hover:scale-110 text-amber-600' : 'text-slate-200'}`}
                      onClick={() => row.warehouses[wh] > 0 && setModalConfig({ type: 'vessel_warehouse', vessel: row.vessel, eta: row.eta, warehouse: wh })}
                    >
                      {row.warehouses[wh] > 0 ? row.warehouses[wh] : "-"}
                    </td>
                  ))}

                  <td className="bg-slate-50/30 w-3 px-0 py-0"></td>

                  <td 
                    className={`px-6 py-4 text-center font-display font-black text-slate-800 transition-all ${row.total > 0 ? 'cursor-pointer hover:bg-slate-900 hover:text-white' : ''}`}
                    onClick={() => row.total > 0 && setModalConfig({ type: 'vessel_total', vessel: row.vessel, eta: row.eta })}
                  >
                    {row.total}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Premium Container Details Modal */}
      <AnimatePresence>
      {modalConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalConfig(null)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="bg-white/90 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative ring-1 ring-white/50"
          >
            <div className="px-12 py-10 border-b border-slate-200/50 flex justify-between items-center bg-white/40 sticky top-0 z-10">
              <div>
                <h3 className="text-3xl font-display font-black text-slate-800">Operational Drilldown</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mt-3 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                   {modalConfig.type === 'vessel_status' && `${modalConfig.vessel} // ${modalConfig.status}`}
                   {modalConfig.type === 'vessel_warehouse' && `${modalConfig.vessel} // ${modalConfig.warehouse}`}
                   {modalConfig.type === 'vessel_total' && `${modalConfig.vessel} // Net Global Flow`}
                   {modalConfig.type === 'grand_status' && `Aggregation // ${modalConfig.status}`}
                   {modalConfig.type === 'grand_warehouse' && `Aggregation // ${modalConfig.warehouse}`}
                   {modalConfig.type === 'grand_total' && `Aggregation // Intelligence Net`}
                   {modalConfig.type === 'terminal_summary' && `${modalConfig.terminalName} // ${modalConfig.terminalSummaryCategory === 'current' ? 'Active Stock' : 'Future Pipeline'}`}
                   {' '}({matchingShipments.length} UNITS)
                </p>
              </div>
              <button 
                onClick={() => setModalConfig(null)}
                className="bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-inner cursor-pointer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="overflow-y-auto p-12 flex-1 custom-scrollbar bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {matchingShipments.map((s, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass border border-white p-8 rounded-[2.5rem] shadow-glass hover:ring-2 hover:ring-indigo-500/20 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-6">
                       <span className="font-display font-black text-2xl text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tighter">{s.containerNumber || 'UNTITLED'}</span>
                    </div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master BL</span>
                          <span className="text-xs font-black text-slate-800">{s.billOfLading || (s as any).blNumber || '-'}</span>
                       </div>
                       <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Maritime Unit</span>
                          <span className="text-xs font-black text-slate-800 truncate max-w-[140px] text-right">{s.vesselName || '-'}</span>
                       </div>
                       <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Strategic Log</span>
                          <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter text-right leading-none">{s.statusComex || s.status || '-'}</span>
                       </div>
                       {s.deliveryByd && isValidDate(s.deliveryByd) && (
                         <div className="flex justify-between items-center pt-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Release Date</span>
                           <span className="text-xs font-black text-emerald-600">
                             {s.deliveryByd.toLocaleDateString('en-GB')}
                           </span>
                         </div>
                       )}
                    </div>
                  </motion.div>
                ))}
                
                {matchingShipments.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <span className="material-icons text-5xl text-slate-200 mb-4">search_off</span>
                    <h3 className="text-xl font-display font-black text-slate-400">Zero Units Found</h3>
                    <p className="text-slate-300 text-xs mt-2 font-bold uppercase tracking-widest">Mismatch in query parameters detected</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-12 py-8 bg-white border-t border-slate-100 flex justify-end sticky bottom-0 z-10">
               <button 
                 onClick={() => setModalConfig(null)}
                 className="px-12 py-4 bg-slate-900 hover:bg-black text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl transition-all active:scale-95 cursor-pointer"
               >
                 Close Protocol
               </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(VesselMatrix);