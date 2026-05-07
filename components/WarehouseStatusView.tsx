import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';

interface WarehouseStatusViewProps {
  shipments: Shipment[];
  statusComexList: string[];
  generalWarehouseList: string[];
}

export function WarehouseStatusView({
  shipments,
  statusComexList,
  generalWarehouseList,
}: WarehouseStatusViewProps) {
  // --- Filter States ---
  const [selectedPO, setSelectedPO] = useState<string[]>([]);
  const [selectedNavio, setSelectedNavio] = useState<string[]>([]);
  const [selectedStatusCarga, setSelectedStatusCarga] = useState<string[]>([]);
  const [selectedTipoCarga, setSelectedTipoCarga] = useState<string[]>([]);
  const [selectedTipoMercadoria, setSelectedTipoMercadoria] = useState<string[]>([]);
  const [selectedBatchChina, setSelectedBatchChina] = useState<string[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string[]>([]);
  const [selectedGeneralWarehouse, setSelectedGeneralWarehouse] = useState<string[]>([]);
  const [selectedBondedWarehouse, setSelectedBondedWarehouse] = useState<string[]>([]);

  // Text Input States
  const [searchPO, setSearchPO] = useState<string>('');
  const [searchNavio, setSearchNavio] = useState<string>('');
  const [searchBL, setSearchBL] = useState<string>('');
  const [searchBroker, setSearchBroker] = useState<string>('');

  // Date Range States
  const [chegadaStart, setChegadaStart] = useState<string>('');
  const [chegadaEnd, setChegadaEnd] = useState<string>('');
  const [freeTimeStart, setFreeTimeStart] = useState<string>('');
  const [freeTimeEnd, setFreeTimeEnd] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Apply filters trigger state
  const [appliedFilters, setAppliedFilters] = useState({
    selectedPO: [] as string[],
    selectedNavio: [] as string[],
    selectedStatusCarga: [] as string[],
    selectedTipoCarga: [] as string[],
    selectedTipoMercadoria: [] as string[],
    selectedBatchChina: [] as string[],
    selectedBroker: [] as string[],
    selectedGeneralWarehouse: [] as string[],
    selectedBondedWarehouse: [] as string[],
    searchPO: '',
    searchNavio: '',
    searchBL: '',
    searchBroker: '',
    chegadaStart: '',
    chegadaEnd: '',
    freeTimeStart: '',
    freeTimeEnd: ''
  });

  // --- Dynamic Option Lists ---
  const uniquePOs = useMemo(() => Array.from(new Set(shipments.map((s) => s.processNumber || s.lotNumber).filter(Boolean))).sort(), [shipments]);
  const uniqueNavios = useMemo(() => Array.from(new Set(shipments.map((s) => s.vesselName).filter(Boolean))).sort(), [shipments]);
  const uniqueStatusCarga = statusComexList; 
  const uniqueTipoCarga = useMemo(() => Array.from(new Set(shipments.map((s) => s.containerType).filter(Boolean))).sort(), [shipments]);
  const uniqueTipoMercadoria = useMemo(() => Array.from(new Set(shipments.map((s) => s.cargo).filter(Boolean))).sort(), [shipments]);
  const uniqueBatchChina = useMemo(() => Array.from(new Set(shipments.map((s) => s.batchNumber).filter(Boolean))).sort(), [shipments]);
  const uniqueBrokers = useMemo(() => Array.from(new Set(shipments.map((s) => s.agent).filter(Boolean))).sort(), [shipments]); 
  const uniqueGeneralWarehouses = generalWarehouseList;
  const uniqueBondedWarehouses = useMemo(() => Array.from(new Set(shipments.map((s) => s.bondedWarehouse).filter(Boolean))).sort(), [shipments]);

  // --- Handlers ---
  const handleApplyFilters = React.useCallback(() => {
    setCurrentPage(1);
    setAppliedFilters({
      selectedPO,
      selectedNavio,
      selectedStatusCarga,
      selectedTipoCarga,
      selectedTipoMercadoria,
      selectedBatchChina,
      selectedBroker,
      selectedGeneralWarehouse,
      selectedBondedWarehouse,
      searchPO,
      searchNavio,
      searchBL,
      searchBroker,
      chegadaStart,
      chegadaEnd,
      freeTimeStart,
      freeTimeEnd
    });
    setIsFilterExpanded(false);
  }, [
    selectedPO, selectedNavio, selectedStatusCarga, selectedTipoCarga, selectedTipoMercadoria, 
    selectedBatchChina, selectedBroker, selectedGeneralWarehouse, selectedBondedWarehouse, 
    searchPO, searchNavio, searchBL, searchBroker, 
    chegadaStart, chegadaEnd, freeTimeStart, freeTimeEnd
  ]);

  const handleClearFilters = React.useCallback(() => {
    setCurrentPage(1);
    setSelectedPO([]);
    setSelectedNavio([]);
    setSelectedStatusCarga([]);
    setSelectedTipoCarga([]);
    setSelectedTipoMercadoria([]);
    setSelectedBatchChina([]);
    setSelectedBroker([]);
    setSelectedGeneralWarehouse([]);
    setSelectedBondedWarehouse([]);
    setSearchPO('');
    setSearchNavio('');
    setSearchBL('');
    setSearchBroker('');
    setChegadaStart('');
    setChegadaEnd('');
    setFreeTimeStart('');
    setFreeTimeEnd('');

    setAppliedFilters({
      selectedPO: [],
      selectedNavio: [],
      selectedStatusCarga: [],
      selectedTipoCarga: [],
      selectedTipoMercadoria: [],
      selectedBatchChina: [],
      selectedBroker: [],
      selectedGeneralWarehouse: [],
      selectedBondedWarehouse: [],
      searchPO: '',
      searchNavio: '',
      searchBL: '',
      searchBroker: '',
      chegadaStart: '',
      chegadaEnd: '',
      freeTimeStart: '',
      freeTimeEnd: ''
    });
  }, []);

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const dataPO = s.processNumber || s.lotNumber || '';
      const dataNavio = s.vesselName || '';
      const dataStatusCarga = s.statusComex || '';
      const dataTipoCarga = s.containerType || '';
      const dataTipoMercadoria = s.cargo || '';
      const dataBatchChina = s.batchNumber || '';
      const dataBroker = s.agent || '';
      const dataBL = s.billOfLading || '';
      const dataGeneralWarehouse = s.generalWarehouse || '';
      const dataBondedWarehouse = s.bondedWarehouse || '';

      if (appliedFilters.selectedPO.length > 0 && !appliedFilters.selectedPO.includes(dataPO)) return false;
      if (appliedFilters.selectedNavio.length > 0 && !appliedFilters.selectedNavio.includes(dataNavio)) return false;
      if (appliedFilters.selectedStatusCarga.length > 0 && !appliedFilters.selectedStatusCarga.includes(dataStatusCarga)) return false;
      if (appliedFilters.selectedTipoCarga.length > 0 && !appliedFilters.selectedTipoCarga.includes(dataTipoCarga)) return false;
      if (appliedFilters.selectedTipoMercadoria.length > 0 && !appliedFilters.selectedTipoMercadoria.includes(dataTipoMercadoria)) return false;
      if (appliedFilters.selectedBatchChina.length > 0 && !appliedFilters.selectedBatchChina.includes(dataBatchChina)) return false;
      if (appliedFilters.selectedBroker.length > 0 && !appliedFilters.selectedBroker.includes(dataBroker)) return false;
      if (appliedFilters.selectedGeneralWarehouse.length > 0 && !appliedFilters.selectedGeneralWarehouse.includes(dataGeneralWarehouse)) return false;
      if (appliedFilters.selectedBondedWarehouse.length > 0 && !appliedFilters.selectedBondedWarehouse.includes(dataBondedWarehouse)) return false;

      if (appliedFilters.searchPO && !dataPO.toLowerCase().includes(appliedFilters.searchPO.toLowerCase())) return false;
      if (appliedFilters.searchNavio && !dataNavio.toLowerCase().includes(appliedFilters.searchNavio.toLowerCase())) return false;
      if (appliedFilters.searchBL && !dataBL.toLowerCase().includes(appliedFilters.searchBL.toLowerCase())) return false;
      if (appliedFilters.searchBroker && !dataBroker.toLowerCase().includes(appliedFilters.searchBroker.toLowerCase())) return false;

      if (appliedFilters.chegadaStart || appliedFilters.chegadaEnd) {
        if (!s.ata) return false;
        const ataTime = s.ata.getTime();
        if (appliedFilters.chegadaStart && ataTime < new Date(appliedFilters.chegadaStart).getTime()) return false;
        if (appliedFilters.chegadaEnd && ataTime > new Date(appliedFilters.chegadaEnd).getTime()) return false;
      }

      if (appliedFilters.freeTimeStart || appliedFilters.freeTimeEnd) {
        if (!s.freeTime) return false;
        const ftTime = s.freeTime.getTime();
        if (appliedFilters.freeTimeStart && ftTime < new Date(appliedFilters.freeTimeStart).getTime()) return false;
        if (appliedFilters.freeTimeEnd && ftTime > new Date(appliedFilters.freeTimeEnd).getTime()) return false;
      }

      if (s.deliveryByd) return false;

      return true;
    });
  }, [shipments, appliedFilters]);

  // UI Components mapping
  const dropdownFilters = [
    { label: "Purchase Orders", state: selectedPO, setter: setSelectedPO, options: uniquePOs },
    { label: "Vessels", state: selectedNavio, setter: setSelectedNavio, options: uniqueNavios },
    { label: "Execution Status", state: selectedStatusCarga, setter: setSelectedStatusCarga, options: uniqueStatusCarga },
    { label: "Container Class", state: selectedTipoCarga, setter: setSelectedTipoCarga, options: uniqueTipoCarga },
    { label: "Cargo Protocol", state: selectedTipoMercadoria, setter: setSelectedTipoMercadoria, options: uniqueTipoMercadoria },
    { label: "Global Batch", state: selectedBatchChina, setter: setSelectedBatchChina, options: uniqueBatchChina },
    { label: "Agency/Broker", state: selectedBroker, setter: setSelectedBroker, options: uniqueBrokers },
    { label: "General Depots", state: selectedGeneralWarehouse, setter: setSelectedGeneralWarehouse, options: uniqueGeneralWarehouses },
    { label: "Bonded Sector", state: selectedBondedWarehouse, setter: setSelectedBondedWarehouse, options: uniqueBondedWarehouses },
  ];

  const totalItems = filteredShipments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItemIndex = (currentPage - 1) * itemsPerPage;
  const currentShipments = filteredShipments.slice(startItemIndex, startItemIndex + itemsPerPage);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Header Bento Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 glass p-12 rounded-[3.5rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass">
            <div className="absolute -right-10 -bottom-10 opacity-5">
               <span className="material-icons text-[15rem] font-black">inventory</span>
            </div>
            <div className="relative z-10">
               <h2 className="text-5xl font-display font-black text-slate-800 tracking-[-0.06em]">Warehouse<br/><span className="text-indigo-600">Inventory</span> Flow</h2>
               <p className="text-slate-400 font-bold mt-6 tracking-widest text-[11px] uppercase opacity-60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                  Static Inventory Analysis Protocol
               </p>
            </div>
         </div>
         <div className="glass h-full p-10 rounded-[3.5rem] flex flex-col justify-center items-center text-center group ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-50 to-transparent">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Current Network Load</p>
            <div className="text-7xl font-display font-black text-slate-800 tracking-tighter group-hover:scale-110 transition-transform">
               {filteredShipments.length}
            </div>
            <p className="text-xs font-bold text-indigo-600 mt-2 uppercase tracking-widest">Active Units</p>
         </div>
      </div>

      {/* Modern Filter Toggle */}
      <div className="flex justify-center">
         <button 
           onClick={() => setIsFilterExpanded(!isFilterExpanded)}
           className="glass-dark px-10 py-4 rounded-full flex items-center gap-4 group ring-1 ring-white/30 hover:ring-indigo-500/40 transition-all shadow-xl shadow-indigo-100/20 active:scale-95"
         >
            <span className={`material-icons text-indigo-400 transition-transform duration-500 ${isFilterExpanded ? 'rotate-180' : ''}`}>tune</span>
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">{isFilterExpanded ? 'Close Filter Protocol' : 'Activate Search Filters'}</span>
            <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] text-white">
               {Object.values(appliedFilters).filter(v => Array.isArray(v) ? v.length > 0 : v !== '').length}
            </div>
         </button>
      </div>

      <AnimatePresence>
        {isFilterExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="glass p-12 rounded-[4rem] ring-1 ring-white/50 shadow-glass-heavy space-y-12 bg-white/40 backdrop-blur-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {dropdownFilters.map((df, idx) => (
                  <div key={idx} className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-4">{df.label}</label>
                    <div className="glass-dark border-none ring-1 ring-black/5 rounded-[2.5rem] p-4 h-48 overflow-y-auto custom-scrollbar shadow-inner">
                      {df.options.map((opt) => (
                        <label key={opt} className="group flex items-center gap-4 px-4 py-2.5 rounded-2xl cursor-pointer hover:bg-white hover:shadow-sm transition-all whitespace-nowrap">
                          <input 
                            type="checkbox" 
                            checked={df.state.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) df.setter([...df.state, opt]);
                              else df.setter(df.state.filter((item: string) => item !== opt));
                            }}
                            className="w-4 h-4 rounded-lg border-none ring-1 ring-black/10 text-indigo-600 focus:ring-indigo-500" 
                          />
                          <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 leading-tight">
                             {opt || '(Blank Protocol)'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Text Filters Protocol */}
                <div className="space-y-8 lg:col-span-1">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-4">Identifier Search</label>
                      <input
                        type="text"
                        placeholder="Search PO / BL / Vessel..."
                        value={searchPO}
                        onChange={(e) => setSearchPO(e.target.value)}
                        className="w-full glass-dark border-none ring-1 ring-black/5 rounded-2xl px-6 py-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300"
                      />
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-4">ATA Window</label>
                      <div className="flex items-center gap-3">
                         <input type="date" value={chegadaStart} onChange={(e) => setChegadaStart(e.target.value)} className="w-full glass-dark border-none ring-1 ring-black/5 rounded-2xl px-4 py-3 text-[10px] font-black text-slate-500" />
                         <span className="text-slate-300 font-bold">→</span>
                         <input type="date" value={chegadaEnd} onChange={(e) => setChegadaEnd(e.target.value)} className="w-full glass-dark border-none ring-1 ring-black/5 rounded-2xl px-4 py-3 text-[10px] font-black text-slate-500" />
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex justify-end gap-6 pt-10 border-t border-slate-200/50">
                 <button 
                   onClick={handleClearFilters}
                   className="px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                 >
                   Purge System Cache
                 </button>
                 <button 
                   onClick={handleApplyFilters}
                   className="px-12 py-4 bg-slate-900 hover:bg-black text-white rounded-full font-black uppercase text-[10px] tracking-[0.4em] shadow-2xl shadow-slate-200 transition-all active:scale-95"
                 >
                   Execute Filter Process
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Dataset Display */}
      <div className="glass rounded-[3.5rem] ring-1 ring-white/50 shadow-glass overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-slate-900/5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                <th className="px-10 py-8 sticky left-0 bg-white/10 backdrop-blur-3xl z-10 border-r border-white/5">Container</th>
                <th className="px-8 py-8">Process Context</th>
                <th className="px-8 py-8">Bill of Lading</th>
                <th className="px-8 py-8">Vessel Unit</th>
                <th className="px-8 py-8">Operational Status</th>
                <th className="px-8 py-8">Depot Sectors</th>
                <th className="px-8 py-8">Arrival (ATA)</th>
                <th className="px-8 py-8 text-right pr-10">FreeTime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentShipments.length > 0 ? (
                currentShipments.map((s, idx) => (
                  <motion.tr 
                    key={idx} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: (idx % 10) * 0.03 }}
                    className="group hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-10 py-6 font-display font-black text-slate-800 drop-shadow-none whitespace-nowrap sticky left-0 bg-white/90 backdrop-blur-3xl z-10 border-r border-slate-100 group-hover:text-indigo-600 transition-colors">
                       {s.containerNumber}
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-xs font-bold text-slate-500 uppercase">{s.processNumber || s.lotNumber || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-6 font-mono text-xs text-slate-400 font-medium">
                       {s.billOfLading || s.blNumber || '-'}
                    </td>
                    <td className="px-8 py-6 max-w-[150px] truncate" title={s.vesselName}>
                       <span className="text-xs font-black text-slate-700 group-hover:text-slate-900 transition-colors">{s.vesselName || '-'}</span>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                             s.statusComex?.includes('CLEARED') ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                             s.statusComex?.includes('READY') ? 'bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]' : 'bg-slate-300'
                          }`}></div>
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            {s.statusComex || 'Pending Protocol'}
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase leading-none">{s.bondedWarehouse || '-'}</span>
                          <span className="text-[8px] font-bold text-indigo-400 uppercase italic leading-none">{s.generalWarehouse || ''}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                       <span className="text-[10px] font-black text-slate-500">
                          {s.ata ? s.ata.toLocaleDateString('en-GB') : '-'}
                       </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right pr-10">
                       <span className={`text-[10px] font-black ${
                          s.freeTime && s.freeTime.getTime() < Date.now() ? 'text-red-500' : 'text-slate-400'
                       }`}>
                          {s.freeTime ? s.freeTime.toLocaleDateString('en-GB') : '-'}
                       </span>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-10 py-32 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                       <div className="bg-slate-50 p-10 rounded-full mb-8">
                          <span className="material-icons text-6xl text-slate-200">dashboard_customize</span>
                       </div>
                       <h3 className="text-2xl font-display font-black text-slate-400 uppercase tracking-tighter">Query Matrix Empty</h3>
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mt-4 leading-relaxed max-w-xs mx-auto">
                          The current filter array yielded no active dataset. Adjust targeting parameters.
                       </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Modern Pagination Section */}
        {totalPages > 1 && (
          <nav className="px-12 py-10 bg-slate-50/50 backdrop-blur-xl flex items-center justify-between border-t border-slate-100" aria-label="Pagination">
            <div className="hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Displaying <span className="text-slate-800">{startItemIndex + 1}</span> to <span className="text-slate-800">{Math.min(startItemIndex + itemsPerPage, totalItems)}</span> // <span className="text-indigo-600">{totalItems} Total Registry</span>
              </p>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <span className="material-icons">chevron_left</span>
              </button>
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-slate-800 uppercase tabular-nums">{currentPage}</span>
                 <div className="w-8 h-[1px] bg-slate-200"></div>
                 <span className="text-[10px] font-black text-slate-300 uppercase tabular-nums">{totalPages}</span>
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <span className="material-icons">chevron_right</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </motion.div>
  );
}
