
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
import { WarehouseStatusView } from "./components/WarehouseStatusView";
import VesselMatrix from "./components/VesselMatrix";
import { DemurrageControl } from "./components/DemurrageControl";
import { CurrentInventory } from "./components/CurrentInventory";
import { EmptyContainersPanel } from "./components/EmptyContainersPanel";

// Utils
import { processRawData, calculateDashboardData, toUTC, getISOWeek } from "./utils/dataProcessor";
import { currencyFormatter } from "./utils/formatters";
import { Shipment, SortConfig, PipelineWeek } from "./types";

type MainView = "performance" | "goods_analysis" | "current_inventory" | "warehouse_status" | "vessel_matrix" | "demurrage_control";

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
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = React.useCallback((data: any[][]) => {
    try {
      const processed = processRawData(data);
      setShipments(processed.shipments);
      setCarriersList(processed.carriers);
      setAnalystsList(processed.analysts);
      setCargosList(processed.cargos);
      setContainerTypesList(processed.containerTypes);
      setIncotermsList(processed.incoterms);
      setRomaneioStatusesList(processed.romaneioStatuses);
      setYearsList(processed.years);
      setStatusComexList(processed.statusComexList);
      setGeneralWarehouseList(processed.generalWarehouseList);
      setIsLoading(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  const handleExportPPT = async () => {
    if (shipments.length === 0) return;
    setIsExporting(true);
    document.body.classList.add('is-exporting');

    try {
      // Robust library detection for different build environments
      const PptxGen = (window as any).PptxGenJS;
      const pptx = typeof PptxGen === 'function' ? new PptxGen() : new (PptxGen as any).default();
      
      pptx.layout = 'LAYOUT_16x9';

      // 1. Title Slide
      const titleSlide = pptx.addSlide();
      titleSlide.addText("Logistics KPI Command Center", { 
        x: 0, y: '40%', w: '100%', align: 'center', fontSize: 36, bold: true, color: '363636', fontFace: 'Arial'
      });
      titleSlide.addText(`Executive Performance Report - ${new Date().toLocaleDateString()}`, { 
        x: 0, y: '55%', w: '100%', align: 'center', fontSize: 18, color: '888888', fontFace: 'Arial'
      });

      // Slide workspace dimensions (inches) for 16:9 is 10 x 5.625
      const SLIDE_W = 10;
      const SLIDE_H = 5.625;
      const MARGIN = 0.4;
      const MAX_W = SLIDE_W - (MARGIN * 2);
      const MAX_H = SLIDE_H - (MARGIN * 2);

      // Select sections to capture
      const sections = document.querySelectorAll('.export-section');
      
      for (const section of Array.from(sections)) {
        const canvas = await (window as any).html2canvas(section as HTMLElement, {
          scale: 2.5, // High resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc: Document) => {
             // Find the specific element in the cloned document
             const elementId = section.getAttribute('id');
             const selector = elementId ? `#${elementId}` : '.export-section';
             const el = clonedDoc.querySelector(selector);
             
             if (el) {
                const htmlEl = el as HTMLElement;
                // Standardize layout for export
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

        // Calculate aspect ratio to prevent stretching
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const imgAspectRatio = canvasH / canvasW;

        let finalW = MAX_W;
        let finalH = MAX_W * imgAspectRatio;

        // If height is too much, scale down by height instead
        if (finalH > MAX_H) {
          finalH = MAX_H;
          finalW = MAX_H / imgAspectRatio;
        }
        
        // Center the image in the slide
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
    return shipments.filter((s) => {
      const matchCarrier = filters.carriers.length === 0 || (s.carrier && filters.carriers.includes(s.carrier));
      const matchAnalyst = filters.analysts.length === 0 || (s.analyst && filters.analysts.includes(s.analyst));
      const matchCargo = filters.cargos.length === 0 || (s.cargo && filters.cargos.includes(s.cargo));
      const matchType = filters.containerTypes.length === 0 || (s.containerType && filters.containerTypes.includes(s.containerType));
      const matchIncoterm = filters.incoterms.length === 0 || (s.incoterm && filters.incoterms.includes(s.incoterm));
      const matchRomaneio = filters.romaneioStatuses.length === 0 || (s.madeRomaneio && filters.romaneioStatuses.includes(s.madeRomaneio));
      
      const date = s.deliveryByd || s.ata;
      const matchYear = filters.year === "all" || (date && date.getFullYear().toString() === filters.year);
      
      let matchPeriod = true;
      if (filters.period !== "all" && date) {
        const month = date.getMonth();
        if (filters.period === "H1") matchPeriod = month < 6;
        else if (filters.period === "H2") matchPeriod = month >= 6;
        else if (filters.period === "Q1") matchPeriod = month < 3;
        else if (filters.period === "Q2") matchPeriod = month >= 3 && month < 6;
        else if (filters.period === "Q3") matchPeriod = month >= 6 && month < 9;
        else if (filters.period === "Q4") matchPeriod = month >= 9;
      }

      const matchMonth = filters.month === "all" || (date && date.getMonth().toString() === filters.month);
      const matchSearch = !debouncedSearchTerm || [s.containerNumber, s.carrier, s.vesselName, s.shipper, s.billOfLading].some(v => String(v || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

      return matchCarrier && matchAnalyst && matchCargo && matchType && matchIncoterm && matchRomaneio && matchYear && matchPeriod && matchMonth && matchSearch;
    });
  }, [shipments, filters, debouncedSearchTerm]);

  const sortedShipments = useMemo(() => {
    return [...filteredShipments].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === valB) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
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
      if (!s || !s.deliveryByd) return false;
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
    // Filter shipments that arrive in this specific ISO week
    const matchingShipments = filteredShipments.filter(s => {
        if (!s) return false;
        const date = s.ata || s.estimatedDelivery;
        if (!isValidDate(date)) return false;
        
        // Exact same logic as getISOWeek in dataProcessor.ts
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

  // --- Drill-down Handlers for KPI Cards ---
  const handleDemurrageClick = () => {
    const demurrageShipments = filteredShipments.filter(s => s.demurrageCost > 0);
    setModalData({
      isOpen: true,
      weekLabel: "Demurrage Cost Analysis",
      shipments: demurrageShipments
    });
  };

  const handleOnTimeClick = () => {
    const onTimeShipments = filteredShipments.filter(s => s.deliveryByd && (s.clientDeliveryVariance || 0) <= 0);
    setModalData({
      isOpen: true,
      weekLabel: "On-Time Deliveries",
      shipments: onTimeShipments
    });
  };

  const handleAtRiskClick = () => {
    const atRiskShipments = filteredShipments.filter(s => s.detentionRisk !== null && s.detentionRisk > 0);
    setModalData({
      isOpen: true,
      weekLabel: "Containers at Detention Risk",
      shipments: atRiskShipments
    });
  };

  const handleFlaggedClick = () => {
    const todayUTC = new Date();
    todayUTC.setHours(0,0,0,0);
    const flaggedShipments = filteredShipments.filter(s => {
        if (s.actualDepotReturnDate || !s.freeTimeDate) return false;
        const freeTimeUTC = new Date(s.freeTimeDate);
        freeTimeUTC.setHours(0,0,0,0);
        const diffTime = freeTimeUTC.getTime() - todayUTC.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 15;
    });
    setModalData({
      isOpen: true,
      weekLabel: "Flagged Containers (15 Days to Free Time)",
      shipments: flaggedShipments
    });
  };

  const handleProjectedClick = () => {
    const todayUTC = toUTC(new Date());
    const avgDrainRate = parseFloat(kpis.avgWeekdayVolume) || 1;
    
    const backlog = filteredShipments.filter(s => !s.deliveryByd).sort((a, b) => {
        const dateA = a.cargoReadyDate || a.ata || new Date(0);
        const dateB = b.cargoReadyDate || b.ata || new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    const projectedShipments = backlog.filter((s, index) => {
        const startDate = s.cargoReadyDate || s.ata;
        if (!startDate) return false;
        const daysAlreadyInBacklog = (todayUTC.getTime() - toUTC(startDate).getTime()) / (1000 * 60 * 60 * 24);
        const estimatedDaysToDrain = index / avgDrainRate;
        return (daysAlreadyInBacklog + estimatedDaysToDrain) > 10;
    });

    setModalData({
      isOpen: true,
      weekLabel: "Projected > 10 Days in Backlog",
      shipments: projectedShipments
    });
  };

  const handleClearanceClick = () => {
    const clearanceShipments = filteredShipments.filter(s => s.totalClearanceTime !== null);
    setModalData({
      isOpen: true,
      weekLabel: "Customs Clearance Performance",
      shipments: clearanceShipments
    });
  };

  const isWeekFormat = (label: string) => /^W\d+\s*-/i.test(label);

  const getWeekRange = (label: string): { start: number, end: number } | null => {
      // Find the matched week by date in charts (if we can)
      const parts = label.split(' - ');
      if (parts.length !== 2) return null;
      const weekPattern = parseInt(parts[0].replace('W', ''), 10);
      const yearPattern = parseInt(parts[1], 10);
      
      const yearStart = new Date(Date.UTC(yearPattern, 0, 1));
      const dayNum = yearStart.getUTCDay() || 7;
      
      // Calculate start of the requested week
      let startOfSelectedWeek = new Date(yearStart.getTime() + (weekPattern - 1) * 7 * 86400000);
      // Adjust if it doesn't land on Monday perfectly
      const adjustDays = 1 - (startOfSelectedWeek.getUTCDay() || 7);
      startOfSelectedWeek = new Date(startOfSelectedWeek.getTime() + adjustDays * 86400000);
      
      const endOfSelectedWeek = new Date(startOfSelectedWeek.getTime() + 6 * 86400000 + 86399999); // end of sunday

      return { start: startOfSelectedWeek.getTime(), end: endOfSelectedWeek.getTime() };
  };

  const isDateInPeriod = (targetDate: Date | null, d: any) => {
    // This is the optimized version that doesn't instantiate lots of objects
    if (!targetDate || !d.date) return false;
    // We already handle this optimally dynamically inline so we won't rewrite it fully 
    // Actually, we can just replace usage with the optimized block. Let's keep it here for compatibility if used elsewhere.
    if (isWeekFormat(d.label)) {
        const { week, year } = getISOWeek(targetDate);
        return d.label === `W${week} - ${year}`;
    }
    const dTarget = new Date(d.date).toISOString().split('T')[0];
    return targetDate.toISOString().split('T')[0] === dTarget;
  };

  const handleLeadTimeClick = (d: any) => {
    const targetDate = d.date ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s.deliveryByd) return false;
      return s.deliveryByd.toISOString().split('T')[0] === targetDate;
    });
    setModalData({ isOpen: true, weekLabel: d.label, shipments: matching });
  };

  const handleCargoReadyClick = (d: any) => {
    const targetDate = d.date ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s.cargoReadyDate) return false;
      return s.cargoReadyDate.toISOString().split('T')[0] === targetDate;
    });
    setModalData({
      isOpen: true,
      weekLabel: `Cargo Ready - ${d.label}`,
      shipments: matching
    });
  };

  const handleAtaClick = (d: any) => {
    const targetDate = d.date ? new Date(d.date).toISOString().split('T')[0] : null;
    if (!targetDate) return;
    const matching = filteredShipments.filter(s => {
      if (!s.ata) return false;
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
      const date = s.ata || s.estimatedDelivery;
      if (!date) return false;
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
      if (s.bondedWarehouse !== d.name || !s.ata || s.deliveryByd) return false;
      const isFuture = toUTC(s.ata).getTime() > todayUTC.getTime();
      if (type === 'futureArrivals') return isFuture;
      if (type === 'arrivedNotPicked') return !isFuture;
      return true;
    });
    const groupedData = matching.reduce((acc, s) => {
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
    const targetDateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s.cargoReadyDate) return false;
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
    const targetDateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s.deliveryByd) return false;
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
    const targetDateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : null;

    const matching = filteredShipments.filter(s => {
       if (!s.ata) return false;
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
    // Inventory = Arrived - Delivered / Picked
    const targetDateEndStr = d.date ? new Date(d.date).toISOString().split('T')[0] : null;

    if (!targetDateEndStr) return;

    const matching = filteredShipments.filter(s => {
      if (!s.ata) return false; 
      // We need to compare correctly if week range is active
      const isWeek = isWeekFormat(d.label);
      if (isWeek) {
         const weekRange = getWeekRange(d.label);
         if (!weekRange) return false;
         const arrivedTime = s.ata.getTime();
         const pickedTime = s.deliveryByd ? s.deliveryByd.getTime() : null;
         return arrivedTime <= weekRange.end && (!pickedTime || pickedTime > weekRange.end);
      }
      
      const arrivedDate = s.ata.toISOString().split('T')[0];
      const pickedDate = s.deliveryByd ? s.deliveryByd.toISOString().split('T')[0] : null;

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
      <div className="flex w-full min-h-screen">
        <div className={`flex-1 w-full transition-all flex flex-col ${isExporting ? '' : isStoragePanelMinimized ? 'pr-[80px]' : '2xl:pr-[360px] pr-[360px]'}`}>
          {/* Premium Header / Sticky Dock */}
          <header className="sticky top-0 z-[100] px-8 pt-6 no-export pointer-events-none">
            <div className="mx-auto max-w-[1440px] flex items-center justify-between p-2 glass rounded-[2.5rem] ring-1 ring-white/40 shadow-2xl backdrop-blur-3xl pointer-events-auto">
          <div className="flex items-center gap-6 pl-6">
            <div className="bg-indigo-600 w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-200 ring-1 ring-white/20">
               <span className="material-icons text-white text-2xl">insights</span>
            </div>
            <div>
              <h1 className="text-xl font-display font-black leading-none tracking-tight text-slate-800">Operational <span className="text-indigo-600">Flux</span></h1>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 opacity-60">Intelligence v4.0</p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 p-1.5 glass-dark rounded-[1.75rem]">
            {[
              { id: 'performance', label: 'Dashboard', icon: 'grid_view' },
              { id: 'goods_analysis', label: 'Flow', icon: 'auto_graph' },
              { id: 'current_inventory', label: 'Stock', icon: 'warehouse' },
              { id: 'warehouse_status', label: 'Assets', icon: 'inventory_2' },
              { id: 'vessel_matrix', label: 'Maritime', icon: 'vessel' },
              { id: 'demurrage_control', label: 'Chronos', icon: 'schedule' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setMainView(item.id as MainView)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.1em] transition-all relative ${mainView === item.id ? 'bg-white text-indigo-600 shadow-xl ring-1 ring-black/5 scale-[1.03]' : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'}`}
              >
                {mainView === item.id && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-indigo-500/10 rounded-[1.25rem] blur-xl" />}
                <span className="material-icons text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 pr-2">
            {shipments.length > 0 && (
              <div className="no-export">
                <FileUpload onFileUpload={handleFileUpload} onError={setError} setIsLoading={setIsLoading} />
              </div>
            )}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportPPT} 
              disabled={isExporting || shipments.length === 0}
              className={`flex items-center gap-3 px-8 py-3 rounded-[1.75rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${isExporting ? 'bg-slate-700 text-slate-300' : 'bg-slate-900 hover:bg-black text-white shadow-indigo-100 disabled:opacity-50'}`}
            >
              <span className={`material-icons text-base ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'sync' : 'auto_graph'}
              </span>
              {isExporting ? 'Export PPT' : 'Generate Intelligence'}
            </motion.button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-8 main-content w-full relative">
        
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
              {/* Initial State / Welcome */}
              {shipments.length === 0 ? (
                <div className="bg-white/40 backdrop-blur-xl border border-dashed border-slate-300/50 rounded-[4rem] py-40 text-center shadow-inner no-export">
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
                   {/* Filters */}
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

                   {/* Main Pipeline Analysis */}
                   <section id="pipeline-analysis" className="export-section">
                      <PipelineAnalysis data={charts.pipeline} onWeekClick={handlePipelineWeekClick} />
                   </section>

                   {/* Main Charts & Operational Grid */}
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

                   {/* Table at the bottom */}
                   <section id="system-table" className="no-export scroll-mt-32">
                     <ShipmentTable 
                        shipments={paginatedShipments} sortConfig={sortConfig} onSort={setSortConfig} searchTerm={searchTerm} onSearch={setSearchTerm}
                        currentPage={currentPage} totalItems={sortedShipments.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage}
                     />
                   </section>
                </div>
              )}
            </motion.div>
          ) : mainView === "goods_analysis" ? (
            <GoodsAnalysis data={charts} shipments={filteredShipments} />
          ) : mainView === "current_inventory" ? (
            <CurrentInventory shipments={filteredShipments} />
        ) : mainView === "warehouse_status" ? (
          <WarehouseStatusView 
            shipments={shipments} 
            statusComexList={statusComexList} 
            generalWarehouseList={generalWarehouseList} 
          />
        ) : mainView === "vessel_matrix" ? (
          <div className="space-y-6 flex-1 min-h-[500px] flex flex-col">
            <VesselMatrix shipments={filteredShipments} />
          </div>
        ) : mainView === "demurrage_control" ? (
          <DemurrageControl shipments={filteredShipments} />
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
      </div>
      {!isExporting && <EmptyContainersPanel isMinimized={isStoragePanelMinimized} onToggleMinimize={() => setIsStoragePanelMinimized(!isStoragePanelMinimized)} />}
      </div>
    </div>
  );
}
