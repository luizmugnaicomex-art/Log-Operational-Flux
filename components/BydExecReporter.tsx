import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shipment } from "../types";
import { generateHtmlFile, ExportData } from "../utils/htmlExporter";
import { 
  Download, 
  Presentation, 
  FileText, 
  Database, 
  Sliders, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Calendar, 
  TrendingUp, 
  Moon, 
  Sun,
  ShieldCheck,
  Lightbulb,
  Check,
  Copy,
  AlertTriangle
} from "lucide-react";

interface BydExecReporterProps {
  shipments: Shipment[];
}

export default function BydExecReporter({ shipments }: BydExecReporterProps) {
  // Live previews active sub-tab switching
  const [activeTab, setActiveTab] = useState<"slides" | "mom" | "database" | "advisor">("slides");
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // 1. Terminal Stocks States
  const [teconStock, setTeconStock] = useState<number>(1253);
  const [tpcStock, setTpcStock] = useState<number>(431);
  const [intermaritimaStock, setIntermaritimaStock] = useState<number>(671);

  // 2. Capacity Projection States
  const [capacityLimit, setCapacityLimit] = useState<number>(6850);

  // 3. MOM States
  const [momSubject, setMomSubject] = useState<string>("Diagnóstico de Capacidade de Pátio & Liberação de Carga / 堆场容量诊断与货物放行");
  const [momDate, setMomDate] = useState<string>("21/05/2026");
  const [momAttendees, setMomAttendees] = useState<string>("BYD Logistics Team, TECON representative, MSC and CMA Ops / 比亚迪物流团队、TECON代表、MSC和CMA团队");
  const [momSummary, setMomSummary] = useState<string>(
    "1. Avalvação de gargalo operacional no TECON com risco elevado de demurrage.\n2. Priorização de remessa de contêineres e coordenação com frotas de transporte rodoviário.\n3. Acordo de ampliação de isenções (Free-time).\n\n1. 评估了TECON的高堆积及逾期箱风险。\n2. 优先安排集装箱调拨并协调公路货运车队。\n3. 与船东达成进一步免箱期延长协议。"
  );
  
  const [momActions, setMomActions] = useState<Array<{ task: string; owner: string; deadline: string; status: string }>>([
    { task: "Priorização de liberação no TPC / 优先安排TPC清关放行", owner: "L. Mugnai (BYD)", deadline: "22/05/2026", status: "Em Andamento / 进行中" },
    { task: "Reunião emergencial com Armadores / 紧急召集船东会议", owner: "Supply Chain Director", deadline: "21/05/2026", status: "Concluído / 已完成" },
    { task: "Faturamento e DTA para CDEX / 海关调拨与CDEX发票跟进", owner: "Logistics Admin Team", deadline: "24/05/2026", status: "Pendente / 待处理" }
  ]);

  // Temporary action states for add row
  const [newTask, setNewTask] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newStatus, setNewStatus] = useState("Em Andamento / 进行中");

  // 4. Containers database
  const containersList = useMemo(() => {
    if (shipments && shipments.length > 0) {
      // Map active uploaded shipments!
      return shipments.map(s => {
        let mappedWarehouse = "TECON";
        if (s.bondedWarehouse) {
          const upperWh = s.bondedWarehouse.toUpperCase();
          if (upperWh.includes("TPC")) mappedWarehouse = "TPC";
          else if (upperWh.includes("INTERMARITIMA") || upperWh.includes("INTER")) mappedWarehouse = "INTERMARITIMA";
          else if (upperWh.includes("CDEX") || upperWh.includes("AG -")) mappedWarehouse = "CDEX INTER";
          else if (upperWh.includes("CLIA") || upperWh.includes("EMPORIO")) mappedWarehouse = "CLIA EMPORIO";
        }
        
        return {
          number: s.containerNumber || "BYDU" + Math.floor(Math.random() * 900000 + 100000),
          carrier: (s.shipowner || s.carrier || "MSC").toUpperCase().includes("CMA") ? "CMA CGM" : "MSC",
          vessel: s.vesselName || "MSC BRUNELLA",
          terminal: mappedWarehouse,
          type: s.containerType || "40HC",
          status: s.statusComex || s.status || "IN TRANSIT"
        };
      });
    }

    // Default top-quality executive sample list
    return [
      { number: 'BYDU5820192', carrier: 'MSC', vessel: 'MSC BRUNELLA', terminal: 'TECON', type: '40HC', status: 'IN TRANSIT' },
      { number: 'BYDU9302811', carrier: 'MSC', vessel: 'MSC COLETTE', terminal: 'INTERMARITIMA', type: '40HC', status: 'IN TRANSIT' },
      { number: 'CMAU2819385', carrier: 'CMA CGM', vessel: 'CMA CGM CHENNAI', terminal: 'TECON', type: '40HC', status: 'IN TRANSIT' },
      { number: 'BYDU0029318', carrier: 'MSC', vessel: 'MSC BRUNELLA', terminal: 'TPC', type: '40HC', status: 'IN TRANSIT' },
      { number: 'BYDU4720193', carrier: 'MSC', vessel: 'MSC ALTAIR', terminal: 'TECON', type: '40HC', status: 'IN TRANSIT' },
      { number: 'CMAU9930281', carrier: 'CMA CGM', vessel: 'CMA CGM TIGRIS', terminal: 'INTERMARITIMA', type: '40HC', status: 'IN TRANSIT' },
      { number: 'BYDU8820311', carrier: 'MSC', vessel: 'MSC COLETTE', terminal: 'TECON', type: '40HC', status: 'IN TRANSIT' },
      { number: 'BYDU4429381', carrier: 'CMA CGM', vessel: 'CMA CGM TIGRIS', terminal: 'TPC', type: '40HC', status: 'IN TRANSIT' },
      { number: 'MSCU7782910', carrier: 'MSC', vessel: 'MSC ALTAIR', terminal: 'TECON', type: '40HC', status: 'IN TRANSIT' },
      { number: 'CMAU1128394', carrier: 'CMA CGM', vessel: 'CMA CGM CHENNAI', terminal: 'TECON', type: '45HC', status: 'IN TRANSIT' }
    ];
  }, [shipments]);

  // Auto calculate stocks from loaded shipments if empty to populate defaults
  useEffect(() => {
    if (shipments && shipments.length > 0) {
      const tecon = shipments.filter(s => (s.bondedWarehouse || '').toUpperCase().includes('TECON')).length;
      const tpc = shipments.filter(s => (s.bondedWarehouse || '').toUpperCase().includes('TPC')).length;
      const inter = shipments.filter(s => (s.bondedWarehouse || '108').toUpperCase().includes('INTER')).length;

      // Only override if they make sense
      if (tecon > 0) setTeconStock(tecon);
      if (tpc > 0) setTpcStock(tpc);
      if (inter > 0) setIntermaritimaStock(inter);
    }
  }, [shipments]);

  // 5. Build dynamic carrier vessels distribution
  const carrierVessels = useMemo(() => {
    const vesselsMap: Record<string, { carrier: string; vessel: string; count: number; status: string }> = {};
    
    // Group from active containers list
    containersList.forEach(c => {
      const key = `${c.carrier}-${c.vessel}`;
      if (!vesselsMap[key]) {
        vesselsMap[key] = {
          carrier: c.carrier,
          vessel: c.vessel,
          count: 0,
          status: c.status
        };
      }
      vesselsMap[key].count++;
    });

    return Object.values(vesselsMap);
  }, [containersList]);

  // DB search & filters preview states inside our React app
  const [dbSearch, setDbSearch] = useState("");
  const [dbCarrier, setDbCarrier] = useState("ALL");
  const [dbTerminal, setDbTerminal] = useState("ALL");

  const filteredPreviewContainers = useMemo(() => {
    return containersList.filter(c => {
      const matchesSearch = !dbSearch || 
        c.number.toLowerCase().includes(dbSearch.toLowerCase()) ||
        c.vessel.toLowerCase().includes(dbSearch.toLowerCase()) ||
        c.terminal.toLowerCase().includes(dbSearch.toLowerCase());
      
      const matchesCarrier = dbCarrier === "ALL" || c.carrier === dbCarrier;
      const matchesTerminal = dbTerminal === "ALL" || c.terminal.toUpperCase().includes(dbTerminal.toUpperCase());

      return matchesSearch && matchesCarrier && matchesTerminal;
    });
  }, [containersList, dbSearch, dbCarrier, dbTerminal]);

  // Handle Export extraction to a beautiful bilingue standalone file
  const handleExportHtml = () => {
    const dataToExport: ExportData = {
      terminalStocks: {
        TECON: teconStock,
        TPC: tpcStock,
        INTERMARITIMA: intermaritimaStock
      },
      carrierVessels,
      capacityProjection: {
        capacity: capacityLimit,
        current: teconStock + tpcStock + intermaritimaStock,
        planned: carrierVessels.reduce((acc, v) => acc + v.count, 0)
      },
      momDetails: {
        subject: momSubject,
        date: momDate,
        attendees: momAttendees,
        summary: momSummary,
        actions: momActions
      },
      containers: containersList
    };

    const htmlContent = generateHtmlFile(dataToExport);
    
    // Trigger download
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "estoque_terminais.html");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentTotalStock = teconStock + tpcStock + intermaritimaStock;
  const enRouteTotalCount = carrierVessels.reduce((acc, v) => acc + v.count, 0);
  const projectedTotalCount = currentTotalStock + enRouteTotalCount;
  const utilizationPercentage = ((projectedTotalCount / capacityLimit) * 100).toFixed(0);

  // MOM actions logic
  const handleAddAction = () => {
    if (!newTask) return;
    setMomActions([...momActions, {
      task: newTask,
      owner: newOwner || "Unassigned",
      deadline: newDeadline || "TBA",
      status: newStatus
    }]);
    setNewTask("");
    setNewOwner("");
    setNewDeadline("");
  };

  const handleRemoveAction = (idx: number) => {
    setMomActions(momActions.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Visual Identity Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-100 p-8 rounded-[2.5rem] border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-byd-blue w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg text-white font-black text-xl leading-none">
            BYD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">BYD Logistics Solutions Engine</h2>
              <span className="text-[10px] font-black uppercase text-byd-red bg-byd-red/10 border border-byd-red/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> SENIOR ADVISOR
              </span>
            </div>
            <p className="text-slate-500 font-bold tracking-wide text-xs mt-1 uppercase opacity-80">
              Gerador Executivo • Slide Presentation (PPT) • MOM (Português/Chines) • Carga database
            </p>
          </div>
        </div>

        <button
          onClick={handleExportHtml}
          className="flex items-center gap-2.5 px-8.5 py-4.5 bg-byd-blue hover:bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
        >
          <Download className="w-5.5 h-5.5 text-byd-red" />
          Extract STOCK_TERMINAIS.HTML
        </button>
      </div>

      {/* Main double column Workspace GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left column: Parameters Overrides and fine tuning configuration board */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2.25rem] p-6 shadow-sm">
            <button
              onClick={() => setShowOverridePanel(!showOverridePanel)}
              className="w-full flex items-center justify-between border-b pb-4 mb-4"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-byd-blue" />
                <span className="font-extrabold text-sm uppercase text-slate-800 dark:text-slate-200">Filtros & Inputs</span>
              </div>
              <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-full font-black text-slate-500">
                {showOverridePanel ? "COLLAPSE" : "EXPAND"}
              </span>
            </button>

            <div className="space-y-5">
              {/* Terminal stock overrides */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-byd-blue uppercase tracking-wider">Estoque Atual nos Parques (Pátio)</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-600">TECON Terminal</label>
                    <input 
                      type="number" 
                      value={teconStock} 
                      onChange={(e) => setTeconStock(Number(e.target.value))} 
                      className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-600">TPC Operador</label>
                    <input 
                      type="number" 
                      value={tpcStock} 
                      onChange={(e) => setTpcStock(Number(e.target.value))} 
                      className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-600">INTERMARITIMA</label>
                    <input 
                      type="number" 
                      value={intermaritimaStock} 
                      onChange={(e) => setIntermaritimaStock(Number(e.target.value))} 
                      className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Total Capacity Parameter */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-black text-slate-700 uppercase text-[10px]">Capacidade Max Pátio (TEUs)</label>
                  <input 
                    type="number" 
                    value={capacityLimit} 
                    onChange={(e) => setCapacityLimit(Number(e.target.value))} 
                    className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-850"
                  />
                </div>
              </div>

              {/* MOM Details override board */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-[11px] font-black text-byd-blue uppercase tracking-wider">Ata Executiva (MOM Settings)</h4>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400">Assunto / Subject</span>
                    <input 
                      type="text" 
                      value={momSubject} 
                      onChange={(e) => setMomSubject(e.target.value)} 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400">Data / Date</span>
                    <input 
                      type="text" 
                      value={momDate} 
                      onChange={(e) => setMomDate(e.target.value)} 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-855"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400">Participantes / Attendees</span>
                    <input 
                      type="text" 
                      value={momAttendees} 
                      onChange={(e) => setMomAttendees(e.target.value)} 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400">Sumário Executivo / Summary</span>
                    <textarea 
                      rows={4} 
                      value={momSummary} 
                      onChange={(e) => setMomSummary(e.target.value)} 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Actions row creator */}
              <div className="space-y-2 pt-4 border-t text-xs">
                <span className="text-[11px] font-black text-byd-blue uppercase tracking-wider block">Adicionar Ação MOM / Add MOM Action</span>
                <input 
                  type="text" 
                  placeholder="Task bilingue" 
                  value={newTask} 
                  onChange={(e) => setNewTask(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Owner" 
                    value={newOwner} 
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px]"
                  />
                  <input 
                    type="text" 
                    placeholder="Deadline" 
                    value={newDeadline} 
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px]"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px]"
                  >
                    <option value="Em Andamento / 进行中">Progress</option>
                    <option value="Concluído / 已完成">Completed</option>
                    <option value="Pendente / 待处理">Pending</option>
                  </select>
                  <button 
                    onClick={handleAddAction}
                    className="p-2 bg-byd-blue text-white hover:bg-black rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: The interactive dashboard / preview board */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Tabs switch */}
          <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 p-2 rounded-[2rem] shadow-sm gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setActiveTab("slides")}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === "slides" ? "bg-byd-blue text-white shadow-md shadow-slate-100" : "text-slate-500 hover:text-slate-850"}`}
              >
                <Presentation className="w-4 h-4" />
                Slideshow PPT Preview
              </button>
              <button
                onClick={() => setActiveTab("mom")}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === "mom" ? "bg-byd-blue text-white shadow-md shadow-slate-100" : "text-slate-500 hover:text-slate-850"}`}
              >
                <FileText className="w-4 h-4 text-byd-red" />
                Executive MOM
              </button>
              <button
                onClick={() => setActiveTab("database")}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === "database" ? "bg-byd-blue text-white shadow-md shadow-slate-100" : "text-slate-500 hover:text-slate-850"}`}
              >
                <Database className="w-4 h-4" />
                Freight Explorer Data
              </button>
              <button
                onClick={() => setActiveTab("advisor")}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === "advisor" ? "bg-byd-blue text-white shadow-md shadow-slate-100" : "text-slate-500 hover:text-slate-850"}`}
              >
                <Lightbulb className="w-4 h-4 text-amber-500 animate-bounce" />
                Weekly Report Advisory
              </button>
            </div>

            <span className="text-[10px] font-black text-slate-400 pr-4 uppercase tracking-widest hidden md:inline">
              Bilingue Live Preview Simulator
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 min-h-[500px] flex flex-col justify-between shadow-sm relative overflow-hidden">
            
            <AnimatePresence mode="wait">
              {/* TAB 1: SLIDESHOW */}
              {activeTab === "slides" && (
                <motion.div
                  key="slideshow-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col justify-between min-h-[460px]"
                >
                  <div className="flex justify-between items-center border-b pb-4 border-slate-100">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                      PPT Executive Presentation Simulator
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => currentSlide > 1 && setCurrentSlide(currentSlide - 1)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-650 transition-all"
                      >
                        ← Prev
                      </button>
                      <span className="text-xs font-mono font-bold px-3 text-byd-blue">
                        {currentSlide} / 5
                      </span>
                      <button 
                        onClick={() => currentSlide < 5 && setCurrentSlide(currentSlide + 1)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-650 transition-all"
                      >
                        Next →
                      </button>
                    </div>
                  </div>

                  {/* SLIDES viewport */}
                  <div className="my-auto py-10 relative h-[250px] flex items-center">
                    
                    {/* Slide 1 Cover */}
                    {currentSlide === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4 w-full text-center sm:text-left"
                      >
                        <span className="text-[9px] font-black uppercase text-byd-red tracking-widest border border-byd-red/20 bg-byd-red/5 px-3 py-1.5 rounded-full inline-block">
                          BYD Supply Chain Brasil
                        </span>
                        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                          Diagnóstico Integrado: <br />
                          Terminais & Planeamento de Chegadas
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                          Consolidação executiva de pátio na malha multimodal bilingue em conformidade com as diretrizes da equipe chinesa de Supply Chain de pátio.
                        </p>
                      </motion.div>
                    )}

                    {/* Slide 2 Terminal Stocks */}
                    {currentSlide === 2 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-4"
                      >
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Estoque Atual em Pátio de Terminais</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 block tracking-widest uppercase mb-1">TECON Alfandegado</span>
                            <span className="text-3xl font-extrabold text-byd-blue font-mono">{teconStock}</span>
                            <span className="text-[9px] font-bold text-slate-430 block">CONTÊINERES DISPONÍVEIS</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 block tracking-widest uppercase mb-1">TPC Operador</span>
                            <span className="text-3xl font-extrabold text-indigo-600 font-mono">{tpcStock}</span>
                            <span className="text-[9px] font-bold text-slate-430 block">CONTÊINERES DISPONÍVEIS</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 block tracking-widest uppercase mb-1">INTERMARITIMA</span>
                            <span className="text-3xl font-extrabold text-[#0ea5e9] font-mono">{intermaritimaStock}</span>
                            <span className="text-[9px] font-bold text-slate-430 block">CONTÊINERES DISPONÍVEIS</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Slide 3 Carrier vessels */}
                    {currentSlide === 3 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-4"
                      >
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Previsão e Cargas no Mar</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100">
                            <div className="flex justify-between border-b pb-2 mb-2 border-blue-150">
                              <span className="font-extrabold text-xs text-blue-700">CMA CGM Line</span>
                              <span className="font-mono text-xs font-bold">
                                {carrierVessels.filter(v => v.carrier === 'CMA CGM').reduce((acc, v) => acc + v.count, 0)} TEUs
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 space-y-1">
                              {carrierVessels.filter(v => v.carrier === 'CMA CGM').map((v, i) => (
                                <div key={i} className="flex justify-between font-medium">
                                  <span>{v.vessel}</span>
                                  <span className="font-mono font-bold text-slate-700">{v.count} cont.</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100">
                            <div className="flex justify-between border-b pb-2 mb-2 border-amber-150">
                              <span className="font-extrabold text-xs text-amber-700">MSC Suisse Line</span>
                              <span className="font-mono text-xs font-bold">
                                {carrierVessels.filter(v => v.carrier === 'MSC').reduce((acc, v) => acc + v.count, 0)} TEUs
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 space-y-1">
                              {carrierVessels.filter(v => v.carrier === 'MSC').map((v, i) => (
                                <div key={i} className="flex justify-between font-medium">
                                  <span>{v.vessel}</span>
                                  <span className="font-mono font-bold text-slate-700">{v.count} cont.</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Slide 4 Physical Destinations */}
                    {currentSlide === 4 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-4"
                      >
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Planeamento Físico de Destinação</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-slate-55 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-indigo-500 block uppercase">TECON S.A.</span>
                            <span className="text-xl font-extrabold text-slate-800 tracking-tight mt-1 inline-block">
                              {containersList.filter(c => c.terminal === "TECON").length} TEUs
                            </span>
                          </div>
                          <div className="bg-slate-55 bg-pink-50/50 p-4 border border-pink-100 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-pink-500 block uppercase">TPC</span>
                            <span className="text-xl font-extrabold text-slate-800 tracking-tight mt-1 inline-block">
                              {containersList.filter(c => c.terminal === "TPC").length} TEUs
                            </span>
                          </div>
                          <div className="bg-slate-55 bg-sky-50/50 p-4 border border-sky-100 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-sky-500 block uppercase">INTERMARITIMA</span>
                            <span className="text-xl font-extrabold text-slate-800 tracking-tight mt-1 inline-block">
                              {containersList.filter(c => c.terminal === "INTERMARITIMA").length} TEUs
                            </span>
                          </div>
                          <div className="bg-slate-55 bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-emerald-500 block uppercase">CDEX & OUTROS</span>
                            <span className="text-xl font-extrabold text-slate-800 tracking-tight mt-1 inline-block">
                              {containersList.filter(c => c.terminal === "CDEX INTER" || c.terminal.includes("CLIA")).length} TEUs
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Slide 5 Projections limits */}
                    {currentSlide === 5 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-4"
                      >
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Projeção Dinâmica de Ocupação de Pátio</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 bg-slate-50 border p-5 rounded-2xl flex flex-col justify-between">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-extrabold text-slate-800">Cálculo de Fluxo Projetado</span>
                              <span className="font-bold text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">STOCK SEQUENCE</span>
                            </div>
                            <div className="flex justify-between items-center bg-white border p-3 rounded-xl mt-3 text-xs font-semibold">
                              <div>Estoque: <span className="font-bold text-slate-800">{currentTotalStock}</span></div>
                              <span className="text-slate-350">+</span>
                              <div>E. Rota: <span className="text-byd-blue font-bold">{enRouteTotalCount}</span></div>
                              <span className="text-slate-350">=</span>
                              <div>Total: <span className="text-emerald-600 font-black">{projectedTotalCount}</span></div>
                            </div>
                          </div>
                          
                          <div className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between">
                            <div>
                              <span className="text-[8px] font-black text-emerald-600 tracking-widest uppercase block mb-1">CAPACIDADE DO SISTEMA</span>
                              <span className="text-2xl font-black text-slate-800 font-mono">{capacityLimit}</span>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase mt-1">Limite Máximo (TEUs)</span>
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                <span>Utilização</span>
                                <span>{utilizationPercentage}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(Number(utilizationPercentage), 100)}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Dot Indicators */}
                  <div className="flex items-center justify-between border-t pt-4 border-slate-100">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      BYD Supply Chain Diagnostics v4.2
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setCurrentSlide(s)}
                          className={`w-2 h-2 rounded-full transition-all ${currentSlide === s ? "bg-byd-red w-5" : "bg-slate-200 hover:bg-slate-300"}`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: MOM */}
              {activeTab === "mom" && (
                <motion.div
                  key="mom-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="border-l-4 border-byd-red pl-4">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span>会议纪要 / Minutes of Meeting</span>
                      <span className="text-[9px] bg-byd-red/10 text-byd-red font-black px-2 py-0.5 rounded-full">BIYADI CORPORATE STYLE</span>
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Supply Chain Diretoria de Operações</p>
                  </div>

                  {/* Metadata inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border p-5 rounded-2xl">
                    <div className="text-xs">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider">会议主题 / Subject</span>
                      <span className="font-bold text-slate-750 mt-1 block leading-tight">{momSubject}</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider">会议日期 / Date</span>
                      <span className="font-mono font-bold text-slate-700 mt-1 block">{momDate}</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider">参会人员 / Attendees</span>
                      <span className="font-medium text-slate-700 mt-1 block">{momAttendees}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-byd-blue uppercase tracking-wider block">会议概要 / Executive Summary</span>
                    <div className="bg-slate-50 p-5 rounded-2xl border text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {momSummary}
                    </div>
                  </div>

                  {/* Actions list table */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-byd-blue uppercase tracking-wider block">具体任务 / Action Task list</span>
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-250">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-450 tracking-wider text-left">
                          <tr>
                            <th className="px-5 py-3">具体任务 / Action Task</th>
                            <th className="px-5 py-3">负责人 / Owner</th>
                            <th className="px-5 py-3">截止日期 / Deadline</th>
                            <th className="px-5 py-3">状态 / Status</th>
                            <th className="px-5 py-3 text-center">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {momActions.map((act, index) => {
                            let statusBadge = "bg-slate-100 text-slate-600";
                            if (act.status.includes("Conclu") || act.status.includes("Done") || act.status.includes("已")) {
                              statusBadge = "bg-emerald-100 text-emerald-800";
                            } else if (act.status.includes("Andam") || act.status.includes("Progress") || act.status.includes("进")) {
                              statusBadge = "bg-blue-100 text-blue-800";
                            } else if (act.status.includes("Atra") || act.status.includes("Delay") || act.status.includes("待")) {
                              statusBadge = "bg-byd-red/10 text-byd-red";
                            }

                            return (
                              <tr key={index} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 text-slate-800 font-medium">{act.task}</td>
                                <td className="px-5 py-3 text-slate-600 font-bold uppercase">{act.owner}</td>
                                <td className="px-5 py-3 text-slate-500 font-mono">{act.deadline}</td>
                                <td className="px-5 py-3">
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${statusBadge}`}>
                                    {act.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <button onClick={() => handleRemoveAction(index)} className="text-red-500 hover:text-red-700 transition-colors">
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: DATABASE EXPLORER */}
              {activeTab === "database" && (
                <motion.div
                  key="database-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">智能货物浏览器 / Freight Explorer</h3>
                    <p className="text-slate-400 text-xs font-semibold">Consolidação e busca instantânea de contêineres do banco de dados.</p>
                  </div>

                  {/* Filters preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-5 border rounded-2xl text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-400 tracking-wider">Search Box</span>
                      <input 
                        type="text" 
                        value={dbSearch} 
                        onChange={(e) => setDbSearch(e.target.value)} 
                        placeholder="Container, Vessel, BL..." 
                        className="px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-400 tracking-wider">Carrier</span>
                      <select 
                        value={dbCarrier} 
                        onChange={(e) => setDbCarrier(e.target.value)} 
                        className="px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs font-bold font-sans"
                      >
                        <option value="ALL">ALL CARRIERS</option>
                        <option value="CMA CGM">CMA CGM</option>
                        <option value="MSC">MSC</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-400 tracking-wider">Terminal Destination</span>
                      <select 
                        value={dbTerminal} 
                        onChange={(e) => setDbTerminal(e.target.value)} 
                        className="px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs font-bold font-sans"
                      >
                        <option value="ALL">ALL TERMINALS</option>
                        <option value="TECON">TECON S.A.</option>
                        <option value="TPC">TPC</option>
                        <option value="INTERMARITIMA">INTERMARITIMA</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                    <div>
                      Found: <span className="text-byd-blue bg-slate-100 font-mono text-sm px-3 py-1 rounded-full ml-1">{filteredPreviewContainers.length}</span>
                      <span className="opacity-50 ml-1">of {containersList.length} total TEUs</span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-[2rem] border">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 text-left">
                        <tr>
                          <th className="px-5 py-3">箱号 / Container</th>
                          <th className="px-5 py-3">船东 / Carrier</th>
                          <th className="px-5 py-3">箱型 / Type</th>
                          <th className="px-5 py-3">母船 / Vessel</th>
                          <th className="px-5 py-3">目的港 / Terminal</th>
                          <th className="px-5 py-3">当前状态 / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono text-[11px]">
                        {filteredPreviewContainers.slice(0, 10).map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-2.5 font-bold text-slate-800">{c.number}</td>
                            <td className={`px-5 py-2.5 font-sans font-black ${c.carrier === "MSC" ? "text-amber-600" : "text-blue-600"}`}>{c.carrier}</td>
                            <td className="px-5 py-2.5 text-slate-400 font-bold">{c.type}</td>
                            <td className="px-5 py-2.5 text-slate-600">{c.vessel}</td>
                            <td className="px-5 py-2.5 font-bold text-slate-705">{c.terminal}</td>
                            <td className="px-5 py-2.5">
                              <span className="bg-slate-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredPreviewContainers.length > 10 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-3 text-center text-slate-400 font-bold uppercase select-none">
                              + {filteredPreviewContainers.length - 10} additional containers in database
                            </td>
                          </tr>
                        )}
                        {filteredPreviewContainers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-6 text-center text-slate-400 font-bold uppercase select-none">
                              No results found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: SUPERVISOR WEEKLY REPORT ADVISORY */}
              {activeTab === "advisor" && (
                <motion.div
                  key="advisor-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 flex-1 flex flex-col justify-between min-h-[460px]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#E11D48] block">
                        Enterprise Supervisor Advisory
                      </span>
                      <h4 className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">
                        Supervisor Weekly Report Draft Generator 
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        const totalActive = shipments.length;
                        const delivered = shipments.filter(s => s.deliveryByd).length;
                        const pendingVal = totalActive - delivered;
                        const demurCount = shipments.filter(s => s.demurrageCost > 0).length;
                        const demurSum = Math.round(shipments.reduce((acc, curr) => acc + (curr.demurrageCost || 0), 0));

                        const text = `BYD LOGISTICS OPERATIONS WEEKLY STATUS REPORT
======================================================
Evaluation Period: May 21, 2026 (Live Audit Update)

1. CONTAINER VOLUMES & STATUS BREAKDOWN:
   • Total Active Shipments: ${totalActive} containers
   • Safely Delivered to BYD Buffer: ${delivered} units
   • Pending Yard Clearance: ${pendingVal} units
   • Average Daily Delivery Rate: ${Math.round(delivered / 12 || 22)} units/day

2. DEMURRAGE EXPOSURE & FINANCIAL MITIGATION:
   • Active Demurrage/Detention Alarms: ${demurCount} units exceeding Free Time
   • Cumulative Demurrage Risk Value: USD ${demurSum}
   • Major Bottleneck Carrier: MSC (requires immediate custom protocol support)

3. STRATEGIC SUPERVISOR RECOMMENDATIONS:
   • Leverage priority clearance and DTA protocols for CDEX / CLIA depots to bypass TECON bottlenecks.
   • Synchronize yard pickup times with empty container return schedules to lower logistics overhead.`;

                        navigator.clipboard.writeText(text);
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      }}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Text Draft!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Weekly Report Summary
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start my-auto">
                     {/* Text preview block */}
                     <div className="bg-slate-900 rounded-3xl p-6 shadow-md text-white border border-slate-800 font-mono text-[11px] leading-relaxed space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <p className="text-emerald-400 font-bold border-b border-white/10 pb-2"># WEEKLY OPERATIONS HIGHLIGHTS REPORT</p>
                        <p><strong>1. VOLUMES & YARD INVENTORY:</strong><br/>
                        • Total Active Database: {shipments.length} containers listed.<br/>
                        • Safely delivered & completed: {shipments.filter(s => s.deliveryByd).length} units.<br/>
                        • Active pending clearance: {shipments.filter(s => !s.deliveryByd).length} units.<br/>
                        • Average daily volume: {Math.round(shipments.filter(s => s.deliveryByd).length / 15 || 25)} units/day.
                        </p>
                        <p><strong>2. COMPLIANCE & BOTTLENECK ANALYSIS:</strong><br/>
                        • Demurrage warnings: {shipments.filter(s => s.demurrageCost > 0).length} units at risk.<br/>
                        • Accrued Demurrage Fee exposure: USD {Math.round(shipments.reduce((acc, curr) => acc + (curr.demurrageCost || 0), 0)).toLocaleString()}<br/>
                        • Active Bonded depots used: CDEX, INTERMARITIMA, CLIA, TPC, TECON S.A.
                        </p>
                        <p><strong>3. IMMEDIATE DEPLOYMENT DIRECTIVES:</strong><br/>
                        • Prioritize documents collection for the next 7-day arrivals loop.<br/>
                        • Double-check general warehouse allocations to balance paint shop and assembly line yards.
                        </p>
                     </div>

                     {/* Strategic advice columns */}
                     <div className="space-y-4 text-xs font-semibold text-slate-700 leading-relaxed">
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4.5 rounded-2xl">
                           <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                           <div>
                              <h5 className="font-extrabold uppercase text-amber-800">Yard Demurrage Exposure Warning</h5>
                              <p className="text-amber-700 mt-1">
                                 The current database registers active demurrage penalty accumulations. Urge customs brokers to process the DI (Import Declaration) packets for high-risk carrier lots within 48 hours.
                              </p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-150 p-4.5 rounded-2xl">
                           <Lightbulb className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
                           <div>
                              <h5 className="font-extrabold uppercase text-indigo-800">Supplier & General Yard Optimization</h5>
                              <p className="text-indigo-700 mt-1">
                                 Compare manually declared inventory buffers with incoming carrier schedules to schedule pickup trucks and avoid port queue over-charges.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-4">
                     Auto-compiled based on live uploaded database telemetry.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </div>
        </div>
      </div>
    </div>
  );
}
