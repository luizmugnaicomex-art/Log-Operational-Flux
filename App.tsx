import React, { useState, useMemo, useEffect } from "react";

// KPI Dashboard Imports
import { motion, AnimatePresence } from "motion/react";
import FileUpload from "./components/FileUpload";
import KpiCard from "./components/KpiCard";
import DashboardFilters from "./components/DashboardFilters";
import ChartsGrid from "./components/ChartsGrid";
import ShipmentTable from "./components/ShipmentTable";
import ChartDetailsModal from "./components/ChartDetailsModal";
import OperationalLotGrid from "./components/OperationalLotGrid";
import PipelineAnalysis from "./components/PipelineAnalysis";
import GoodsAnalysis from "./components/GoodsAnalysis";
import VesselMatrix from "./components/VesselMatrix";
import { CurrentInventory } from "./components/CurrentInventory";
import { EmptyContainersPanel } from "./components/EmptyContainersPanel";
import PortYardOperationStatus from "./components/PortYardOperationStatus";
import { GeneralWarehouseDistribution } from "./components/GeneralWarehouseDistribution";
import { WarehouseDistribution } from "./components/WarehouseDistribution";
import { DeliveriesView } from "./components/DeliveriesView";

// Utils
import { processRawDataAsync, calculateDashboardData, toUTC, getISOWeek } from "./utils/dataProcessor";
import { currencyFormatter } from "./utils/formatters";
import { Shipment, SortConfig, PipelineWeek } from "./types";

type MainView = "performance" | "goods_analysis" | "current_inventory" | "vessel_matrix" | "port_yard_status" | "warehouse_distribution" | "general_warehouse_distribution" | "deliveries";

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

// Use debounce to prevent heavy filtering on every keystroke
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function App() {
  const [mainView, setMainView] = useState<MainView>("performance");
  const [mounted, setMounted] = useState(false);
  const [isStoragePanelMinimized, setIsStoragePanelMinimized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriersList, setCarriersList] = useState<string[]>([]);
  const [analystsList, setAnalystsList] = useState<string[]>([]);
  const [cargosList, setCargosList] = useState<string[]>([]);
  const [containerTypesList, setContainerTypesList] = useState<string[]>([]);
  const [incotermsList, setIncotermsList] = useState<string[]>([]);
  const [romaneioStatusesList, setRomaneioStatusesList] = useState<string[]>([]);
  const [yearsList, setYearsList] = useState<number[]>([]);
  const [statusComexList, setStatusComexList] = useState<string[]>([]);
  const [generalWarehouseList, setGeneralWarehouseList] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    carriers: [] as string[],
    analysts: [] as string[],
    cargos: [] as string[],
    containerTypes: [] as string[],
    incoterms: [] as string[],
    romaneioStatuses: [] as string[],
    year: "all",
    period: "all",
    month: "all",
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "ata", direction: "desc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [modalData, setModalData] = useState<{ isOpen: boolean; weekLabel: string; shipments: Shipment[]; groupedData?: Record<string, Record<string, string[]>> }>({
    isOpen: false,
    weekLabel: "",
    shipments: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ percent: number; message: string }>({ percent: 0, message: "" });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = React.useCallback(async (data: any[][]) => {
    setIsLoading(true);
    setLoadingProgress({ percent: 5, message: "Parsing spreadsheet structure..." });
    setError(null);

    try {
      const processed = await processRawDataAsync(data, (percent, message) => {
        setLoadingProgress({ percent, message });
      });

      setShipments(processed.shipments || []);
      setCarriersList(processed.carriers || []);
      setAnalystsList(processed.analysts || []);
      setCargosList(processed.cargos || []);
      setContainerTypesList(processed.containerTypes || []);
      setIncotermsList(processed.incoterms || []);
      setRomaneioStatusesList(processed.romaneioStatuses || []);
      setYearsList(processed.years || []);
      setStatusComexList(processed.statusComexList || []);
      setGeneralWarehouseList(processed.generalWarehouseList || []);
      setIsLoading(false);
      setLoadingProgress({ percent: 100, message: "Ready" });
      setError(null);
    } catch (err: any) {
      console.error("Data processing error:", err);
      setError(err.message || "Failed to process spreadsheet.");
      setIsLoading(false);
    }
  }, []);

  const handleExportPPT = async () => {
    if (!Array.isArray(shipments) || shipments.length === 0) return;
    setIsExporting(true);
    document.body.classList.add('is-exporting');

    try {
      const PptxGen = (window as any).PptxGenJS;
      const pptx = typeof PptxGen === 'function' ? new PptxGen() : new (PptxGen as any).default();
      
      pptx.layout = 'LAYOUT_16x9';

      const titleSlide = pptx.addSlide();
      titleSlide.addText("Logistics KPI Command Center", { 
        x: 0, y: '40%', w: '100%', align: 'center', fontSize: 36, bold: true, color: '363636', fontFace: 'Arial'
      });
      titleSlide.addText(`Executive Performance Report - ${new Date().toLocaleDateString()}`, { 
        x: 0, y: '55%', w: '100%', align: 'center', fontSize: 18, color: '888888', fontFace: 'Arial'
      });

      const SLIDE_W = 10;
      const SLIDE_H = 5.625;
      const MARGIN = 0.4;
      const MAX_W = SLIDE_W - (MARGIN * 2);
      const MAX_H = SLIDE_H - (MARGIN * 2);

      const sections = document.querySelectorAll('.export-section');
      
      for (const section of Array.from(sections)) {
        const canvas = await (window as any).html2canvas(section as HTMLElement, {
          scale: 2.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc: Document) => {
             const elementId = section.getAttribute('id');
             const selector = elementId ? `#${elementId}` : '.export-section';
             const el = clonedDoc.querySelector(selector);
             
             if (el) {
                const htmlEl = el as HTMLElement;
                htmlEl.style.width = '1200px';
                htmlEl.style.height = 'auto';
                htmlEl.style.padding = '40px';
                htmlEl.style.borderRadius = '0';
                htmlEl.style.boxShadow = 'none';
                htmlEl.style.border = 'none';
             }
          }
        });
        
        const imageData = canvas.toDataURL('image/png', 1.0);
        const slide = pptx.addSlide();

        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const imgAspectRatio = canvasH / canvasW;

        let finalW = MAX_W;
        let finalH = MAX_W * imgAspectRatio;

        if (finalH > MAX_H) {
          finalH = MAX_H;
          finalW = MAX_H / imgAspectRatio;
        }
        
        slide.addImage({ 
          data: imageData, 
          x: (SLIDE_W - finalW) / 2, 
          y: (SLIDE_H - finalH) / 2, 
          w: finalW, 
          h: finalH
        });
      }

      await pptx.writeFile({ fileName: `Logistics_Executive_Report_${new Date().toISOString().split('T')[0]}.pptx` });
    } catch (err) {
      console.error("PPT Export failed:", err);
      setError("Failed to generate PowerPoint presentation. Please check console for details.");
    } finally {
      setIsExporting(false);
      document.body.classList.remove('is-exporting');
    }
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredShipments = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    return shipments.filter((s) => {
      if (!s) return false;
      const matchCarrier = filters.carriers.length === 0 || (s.carrier && filters.carriers.includes(s.carrier));
      const matchAnalyst = filters.analysts.length === 0 || (s.analyst && filters.analysts.includes(s.analyst));
      const matchCargo = filters.cargos.length === 0 || (s.cargo && filters.cargos.includes(s.cargo));
      const matchType = filters.containerTypes.length === 0 || (s.containerType && filters.containerTypes.includes(s.containerType));
      const matchIncoterm = filters.incoterms.length === 0 || (s.incoterm && filters.incoterms.includes(s.incoterm));
      const matchRomaneio = filters.romaneioStatuses.length === 0 || (s.madeRomaneio && filters.romaneioStatuses.includes(s.madeRomaneio));
      
      const date = (s.deliveryByd && isValidDate(s.deliveryByd)) ? s.deliveryByd : ((s.ata && isValidDate(s.ata)) ? s.ata : null);
      const matchYear = filters.year === "all" || (date && isValidDate(date) && date.getFullYear().toString() === filters.year);
      
      let matchPeriod = true;
      if (filters.period !== "all" && date && isValidDate(date)) {
        const month = date.getMonth();
        if (filters.period === "H1") matchPeriod = month < 6;
        else if (filters.period === "H2") matchPeriod = month >= 6;
        else if (filters.period === "Q1") matchPeriod = month < 3;
        else if (filters.period === "Q2") matchPeriod = month >= 3 && month < 6;
        else if (filters.period === "Q3") matchPeriod = month >= 6 && month < 9;
        else if (filters.period === "Q4") matchPeriod = month >= 9;
      }

      const matchMonth = filters.month === "all" || (date && isValidDate(date) && date.getMonth().toString() === filters.month);
      const matchSearch = !debouncedSearchTerm || [s.containerNumber, s.carrier, s.vesselName, s.shipper, s.billOfLading].some(v => String(v || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

      return matchCarrier && matchAnalyst && matchCargo && matchType && matchIncoterm && matchRomaneio && matchYear && matchPeriod && matchMonth && matchSearch;
    });
  }, [shipments, filters, debouncedSearchTerm]);

  const sortedShipments = useMemo(() => {
    return [...filteredShipments].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const res = valA < valB ? -1 : 1;
      return sortConfig.direction === "asc" ? res : -res;
    });
  }, [filteredShipments, sortConfig]);

  const { kpis, charts } = useMemo(() => calculateDashboardData(filteredShipments), [filteredShipments]);
  const paginatedShipments = sortedShipments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const resetFilters = React.useCallback(() => {
    setFilters({ carriers: [], analysts: [], cargos: [], containerTypes: [], incoterms: [], romaneioStatuses: [], year: "all", period: "all", month: "all" });
  }, []);

  const handleLotClick = React.useCallback((model: string, dateLabel: string, batchNumber: string) => {
    const matchingShipments = filteredShipments.filter(s => {
      if (!s || !s.deliveryByd || !isValidDate(s.deliveryByd)) return false;
      const sDateStr = s.deliveryByd.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      return sDateStr === dateLabel && s.batchNumber === batchNumber && s.cargoModel === model;
    });
    setModalData({
      isOpen: true,
      weekLabel: `LOT ${batchNumber} (${model}) - ${dateLabel}`,
      shipments: matchingShipments
    });
  }, [filteredShipments]);

  const handlePipelineWeekClick = (week: PipelineWeek) => {
    const matchingShipments = filteredShipments.filter(s => {
        if (!s) return false;
        const date = s.ata || s.estimatedDelivery;
        if (!isValidDate(date)) return false;
        
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        if (!isValidDate(d)) return false;
        
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        
        return weekNo === week.weekNum && d.getUTCFullYear() === week.year;
    });

    setModalData({
        isOpen: true,
        weekLabel: `WEEK DRILLDOWN: ${week.period}`,
        shipments: matchingShipments
    });
  };

  const isWeekFormat = (label: string) => /^W\d+\s*-/i.test(label);

  const getWeekRange = (label: string): { start: number, end: number } | null => {
      const parts = label.split(' - ');
      if (parts.length !== 2) return null;
      const weekPattern = parseInt(parts[0].replace('W', ''), 10);
      const yearPattern = parseInt(parts[1], 10);
      
      const yearStart = new Date(Date.UTC(yearPattern, 0, 1));
      const dayNum = yearStart.getUTCDay() || 7;
      
      let startOfSelectedWeek = new Date(yearStart.getTime() + (weekPattern - 1) * 7 * 86400000);
      const adjustDays = 1 - (startOfSelectedWeek.getUTCDay() || 7);
      startOfSelectedWeek = new Date(startOfSelectedWeek.getTime() + adjustDays * 86400000);
      
      const endOfSelectedWeek = new Date(startOfSelectedWeek.getTime() + 6 * 86400000 + 86399999);

      return { start: startOfSelectedWeek.getTime(), end: endOfSelectedWeek.getTime() };
  };

  const handleLeadTimeClick = (d: any) => {
    const targetDate = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s || !s.deliveryByd || !isValidDate(s.deliveryByd)) return false;
      return s.deliveryByd.toISOString().split('T')[0] === targetDate;
    });
    setModalData({ isOpen: true, weekLabel: d.label, shipments: matching });
  };

  const handleCargoReadyClick = (d: any) => {
    const targetDate = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s || !s.cargoReadyDate || !isValidDate(s.cargoReadyDate)) return false;
      return s.cargoReadyDate.toISOString().split('T')[0] === targetDate;
    });
    setModalData({
      isOpen: true,
      weekLabel: `Cargo Ready - ${d.label}`,
      shipments: matching
    });
  };

  const handleAtaClick = (d: any) => {
    const targetDate = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s || !s.ata || !isValidDate(s.ata)) return false;
      return s.ata.toISOString().split('T')[0] === targetDate;
    });
    setModalData({
      isOpen: true,
      weekLabel: `Vessel Arrivals (ATA) - ${d.label}`,
      shipments: matching
    });
  };

  const handleRampUpClick = (d: any) => {
    const period = d?.period || d?.payload?.period;
    if (!period) return;
    const matching = filteredShipments.filter(s => {
      if (!s) return false;
      const date = s.ata || s.estimatedDelivery;
      if (!date || !isValidDate(date)) return false;
      const { week, year } = getISOWeek(date);
      return `W${week} - ${year}` === period;
    });
    setModalData({
      isOpen: true,
      weekLabel: `Ramp-Up Plan - ${period}`,
      shipments: matching
    });
  };

  const handleBondedInventoryClick = (d: any, type: string) => {
    const todayUTC = toUTC(new Date());

    const matching = filteredShipments.filter(s => {
      if (!s || s.bondedWarehouse !== d.name || !s.ata || !isValidDate(s.ata) || s.deliveryByd) return false;
      const isFuture = toUTC(s.ata).getTime() > todayUTC.getTime();
      if (type === 'futureArrivals') return isFuture;
      if (type === 'arrivedNotPicked') return !isFuture;
      return true;
    });
    const groupedData = matching.reduce((acc, s) => {
      if (!s) return acc;
      const vessel = s.vesselName || 'Unknown Vessel';
      const bl = s.billOfLading || 'Unknown BL';
      if (!acc[vessel]) acc[vessel] = {};
      if (!acc[vessel][bl]) acc[vessel][bl] = [];
      if (s.containerNumber) acc[vessel][bl].push(s.containerNumber);
      return acc;
    }, {} as Record<string, Record<string, string[]>>);
    
    const labelSuffix = type === 'futureArrivals' ? 'Future Arrivals' : type === 'arrivedNotPicked' ? 'Arrived Already' : 'Arrived & Not Picked';
    
    setModalData({
      isOpen: true,
      weekLabel: `${labelSuffix} - ${d.name}`,
      shipments: matching,
      groupedData
    });
  };

  const handleCargoReadyInflowClick = (d: any) => {
    const isWeek = isWeekFormat(d.label);
    const weekRange = isWeek ? getWeekRange(d.label) : null;
    const targetDateStr = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s || !s.cargoReadyDate || !isValidDate(s.cargoReadyDate)) return false;
       if (isWeek && weekRange) {
            const t = s.cargoReadyDate.getTime();
            return t >= weekRange.start && t <= weekRange.end;
       }
       return s.cargoReadyDate.toISOString().split('T')[0] === targetDateStr;
    });
    setModalData({
      isOpen: true,
      weekLabel: `WEEK DRILLDOWN: Cargo Ready (${d.label})`,
      shipments: matching
    });
  };

  const handleDrainLineClick = (d: any) => {
    const isWeek = isWeekFormat(d.label);
    const weekRange = isWeek ? getWeekRange(d.label) : null;
    const targetDateStr = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s || !s.deliveryByd || !isValidDate(s.deliveryByd)) return false;
       if (isWeek && weekRange) {
            const t = s.deliveryByd.getTime();
            return t >= weekRange.start && t <= weekRange.end;
       }
       return s.deliveryByd.toISOString().split('T')[0] === targetDateStr;
    });
    setModalData({
      isOpen: true,
      weekLabel: `WEEK DRILLDOWN: Delivered/Drain (${d.label})`,
      shipments: matching
    });
  };

  const handleVesselArrivalClick = (d: any) => {
    const isWeek = isWeekFormat(d.label);
    const weekRange = isWeek ? getWeekRange(d.label) : null;
    const targetDateStr = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s || !s.ata || !isValidDate(s.ata)) return false;
       if (isWeek && weekRange) {
            const t = s.ata.getTime();
            return t >= weekRange.start && t <= weekRange.end;
       }
       return s.ata.toISOString().split('T')[0] === targetDateStr;
    });
    setModalData({
      isOpen: true,
      weekLabel: `WEEK DRILLDOWN: Vessel Arrivals (${d.label})`,
      shipments: matching
    });
  };

  const handleInventoryClick = (d: any) => {
    const targetDateEndStr = d?.date && isValidDate(new Date(d.date)) ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDateEndStr) return;

    const matching = filteredShipments.filter(s => {
      if (!s || !s.ata || !isValidDate(s.ata)) return false; 
      const isWeek = isWeekFormat(d.label);
      if (isWeek) {
          const weekRange = getWeekRange(d.label);
          if (!weekRange) return false;
          const arrivedTime = s.ata.getTime();
          const pickedTime = s.deliveryByd && isValidDate(s.deliveryByd) ? s.deliveryByd.getTime() : null;
          return arrivedTime <= weekRange.end && (!pickedTime || pickedTime > weekRange.end);
      }
      
      const arrivedDate = s.ata.toISOString().split('T')[0];
      const pickedDate = s.deliveryByd && isValidDate(s.deliveryByd) ? s.deliveryByd.toISOString().split('T')[0] : null;

      return arrivedDate <= targetDateEndStr && (!pickedDate || pickedDate > targetDateEndStr);
    });

    setModalData({
      isOpen: true,
      weekLabel: `WEEK DRILLDOWN: Inventory (${d.label})`,
      shipments: matching
    });
  };

  return (
    <div className={`min-h-screen font-sans antialiased print:bg-white overflow-x-clip ${isExporting ? 'is-exporting' : ''}`}>
      <div className="flex w-full min-h-screen relative">
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] lg:hidden no-export" 
            onClick={() => setMobileMenuOpen(false)} 
          />
        )}

        {/* Premium Left Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-[285px] bg-slate-900 border-r border-slate-800 text-white z-[90] flex flex-col justify-between no-export shrink-0 transition-transform duration-300 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-4 px-6 py-8 border-b border-slate-800 bg-slate-950/20">
              <div className="bg-indigo-600 w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                <span className="material-icons text-white text-xl">insights</span>
              </div>
              <div>
                <h1 className="text-base font-display font-black leading-none tracking-tight text-white flex items-center gap-1">
                  Operational <span className="text-indigo-400">Flux</span>
                </h1>
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.25em] mt-1.5 leading-none">Intelligence v4.0</p>
              </div>
            </div>

            <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
              {[
                { id: 'performance', label: 'Dashboard', icon: 'grid_view' },
                { id: 'goods_analysis', label: 'Flow', icon: 'auto_graph' },
                { id: 'current_inventory', label: 'Stock', icon: 'warehouse' },
                { id: 'vessel_matrix', label: 'Maritime', icon: 'sailing' },
                { id: 'port_yard_status', label: 'Port & Yard', icon: 'precision_manufacturing' },
                { id: 'warehouse_distribution', label: 'Warehouse Dist', icon: 'domain' },
                { id: 'general_warehouse_distribution', label: 'General Warehouse', icon: 'business' },
                { id: 'deliveries', label: 'Deliveries', icon: 'local_shipping' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMainView(item.id as MainView);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left text-[11px] font-black uppercase tracking-wider transition-all relative cursor-pointer ${mainView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-extrabold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
                >
                  <span className="material-icons text-lg shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-5 border-t border-slate-800 space-y-3 bg-slate-950/40">
            {shipments.length > 0 && (
              <div className="no-export">
                <FileUpload 
                  onFileUpload={handleFileUpload} 
                  onError={setError} 
                  setIsLoading={setIsLoading} 
                  customClass="w-full inline-flex items-center justify-center px-4 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer transition-colors border border-slate-700 hover:border-slate-600"
                />
              </div>
            )}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportPPT} 
              disabled={isExporting || shipments.length === 0}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer ${isExporting ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-955/20 disabled:opacity-50'}`}
            >
              <span className={`material-icons text-base shrink-0 ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'sync' : 'auto_graph'}
              </span>
              <span>{isExporting ? 'Exporting...' : 'Export PPT'}</span>
            </motion.button>
          </div>
        </aside>

        {/* Main Workspace Frame */}
        <div className={`flex-1 w-full transition-all flex flex-col ${isExporting ? '' : `lg:pl-[285px] ${isStoragePanelMinimized ? 'pr-[80px]' : '2xl:pr-[360px] pr-[360px]'}`}`}>
          <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40 no-export shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                <span className="material-icons text-white text-base">insights</span>
              </div>
              <h1 className="text-sm font-display font-black leading-none text-slate-800">
                Operational <span className="text-indigo-600">Flux</span>
              </h1>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-indigo-600 transition-colors focus:outline-none cursor-pointer"
            >
              <span className="material-icons text-2xl">menu</span>
            </button>
          </header>

      <main className="mx-auto max-w-[1440px] p-8 main-content w-full relative">
        {error && shipments.length > 0 && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center justify-between no-export">
            <div className="flex items-center gap-3">
              <span className="material-icons text-lg text-rose-500">error_outline</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 transition-colors cursor-pointer">
              <span className="material-icons text-lg">close</span>
            </button>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {mainView === "performance" ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-12"
            >
              {shipments.length === 0 ? (
                <div className="bg-white/40 backdrop-blur-xl border border-dashed border-slate-300/50 rounded-[4rem] py-40 text-center shadow-inner no-export">
                   {error && (
                     <div className="max-w-md mx-auto mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-3 justify-center">
                        <span className="material-icons text-lg text-rose-500">error_outline</span>
                        <span>{error}</span>
                     </div>
                   )}
                   <div className="bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200">
                      <span className="material-icons text-white text-5xl">cloud_upload</span>
                   </div>
                   <h3 className="text-4xl font-display font-black text-slate-800 tracking-tight">Deploy Intelligence</h3>
                   <p className="text-slate-400 max-w-md mx-auto mt-4 text-base font-medium leading-relaxed">
                     Upload your operational datasets to activate the flux engine and unlock deep neural insights.
                   </p>
                   <div className="mt-12 inline-block">
                      <FileUpload onFileUpload={handleFileUpload} onError={setError} setIsLoading={setIsLoading} />
                   </div>
                </div>
              ) : (
                  <div className="flex flex-col gap-10">
                   <div className="no-export">
                      <DashboardFilters 
                          carriers={carriersList} analysts={analystsList} cargos={cargosList} containerTypes={containerTypesList} incoterms={incotermsList} romaneioStatuses={romaneioStatusesList} years={yearsList}
                          selectedCarriers={filters.carriers} selectedAnalysts={filters.analysts} selectedCargos={filters.cargos} selectedContainerTypes={filters.containerTypes} selectedIncoterms={filters.incoterms} selectedRomaneioStatuses={filters.romaneioStatuses}
                          selectedYear={filters.year} selectedPeriod={filters.period} selectedMonth={filters.month}
                          onCarrierChange={(val) => setFilters(f => ({...f, carriers: val}))}
                          onAnalystChange={(val) => setFilters(f => ({...f, analysts: val}))}
                          onCargoChange={(val) => setFilters(f => ({...f, cargos: val}))}
                          onContainerTypeChange={(val) => setFilters(f => ({...f, containerTypes: val}))}
                          onIncotermChange={(val) => setFilters(f => ({...f, incoterms: val}))}
                          onRomaneioStatusChange={(val) => setFilters(f => ({...f, romaneioStatuses: val}))}
                          onYearChange={(val) => setFilters(f => ({...f, year: val}))}
                          onPeriodChange={(val) => setFilters(f => ({...f, period: val}))}
                          onMonthChange={(val) => setFilters(f => ({...f, month: val}))}
                          onReset={resetFilters}
                      />
                   </div>

                   <section id="pipeline-analysis" className="export-section">
                      <PipelineAnalysis data={charts.pipeline} onWeekClick={handlePipelineWeekClick} />
                   </section>

                   <div className="space-y-8">
                       <ChartsGrid 
                         data={charts} 
                         shipments={filteredShipments}
                         onLeadTimeClick={handleLeadTimeClick}
                         onCargoReadyClick={handleCargoReadyClick}
                         onAtaClick={handleAtaClick}
                         onRampUpClick={handleRampUpClick}
                         onBondedInventoryClick={handleBondedInventoryClick}
                         onInventoryClick={handleInventoryClick}
                         onCargoReadyInflowClick={handleCargoReadyInflowClick}
                         onDrainLineClick={handleDrainLineClick}
                         onVesselArrivalClick={handleVesselArrivalClick}
                       />
                       <section id="lot-grid" className="export-section">
                          <OperationalLotGrid shipments={filteredShipments} onLotClick={handleLotClick} />
                       </section>
                   </div>


                </div>
              )}
            </motion.div>
          ) : mainView === "goods_analysis" ? (
            <GoodsAnalysis data={charts} shipments={filteredShipments} />
          ) : mainView === "current_inventory" ? (
            <CurrentInventory shipments={filteredShipments} />
        ) : mainView === "vessel_matrix" ? (
          <div className="space-y-6 flex-1 min-h-[500px] flex flex-col">
            <VesselMatrix shipments={filteredShipments} />
          </div>
        ) : mainView === "port_yard_status" ? (
          <PortYardOperationStatus shipments={filteredShipments} />
        ) : mainView === "warehouse_distribution" ? (
          <WarehouseDistribution shipments={filteredShipments} />
        ) : mainView === "general_warehouse_distribution" ? (
          <GeneralWarehouseDistribution shipments={filteredShipments} />
        ) : mainView === "deliveries" ? (
          <DeliveriesView shipments={filteredShipments} />
        ) : null}
        </AnimatePresence>
      </main>

      <ChartDetailsModal 
        isOpen={modalData.isOpen} 
        weekLabel={modalData.weekLabel} 
        shipments={modalData.shipments} 
        groupedData={modalData.groupedData}
        avgDrainRate={parseFloat(kpis.avgWeekdayVolume) || 1}
        onClose={() => setModalData(d => ({...d, isOpen: false}))} 
      />

      <AnimatePresence>
        {isLoading && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 animate-bounce">
                <span className="material-icons text-3xl">cloud_sync</span>
              </div>
              <h3 className="text-xl font-display font-black text-slate-800">Processing Dataset</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 mb-6">
                {loadingProgress.message || "Ingesting and calculating operational metrics..."}
              </p>
              
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 mb-3 border border-slate-200/50">
                <motion.div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, loadingProgress.percent)}%` }}
                />
              </div>

              <div className="flex justify-between w-full text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>Optimized Engine</span>
                <span className="text-indigo-600 font-bold">{loadingProgress.percent}%</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
      {!isExporting && <EmptyContainersPanel isMinimized={isStoragePanelMinimized} onToggleMinimize={() => setIsStoragePanelMinimized(!isStoragePanelMinimized)} />}
      </div>
    </div>
  );
}