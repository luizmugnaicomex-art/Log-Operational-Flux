import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import { currencyFormatter } from '../utils/formatters';
import {
  Clock,
  AlertTriangle,
  ShieldAlert,
  Flame,
  CheckCircle2,
  TrendingDown,
  Warehouse,
  Truck,
  Send,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Sliders,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
  Hash,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  AreaChart,
  Area
} from 'recharts';

interface BondedDwellOptimizationProps {
  shipments: Shipment[];
  onDrilldown?: (title: string, shipments: Shipment[]) => void;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());
const toUTC = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

export const BondedDwellOptimization: React.FC<BondedDwellOptimizationProps> = ({
  shipments = [],
  onDrilldown
}) => {
  // --- View States ---
  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');
  const [selectedPeriodTier, setSelectedPeriodTier] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedShipowner, setSelectedShipowner] = useState<string>('all');
  const [scopeMode, setScopeMode] = useState<'active_in_yard' | 'all_arrived'>('active_in_yard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNumbersOnChart, setShowNumbersOnChart] = useState<boolean>(true);
  const [copiedBrokerMessage, setCopiedBrokerMessage] = useState<boolean>(false);
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);

  // Configurable thresholds for period jumps
  const [period1MaxDays, setPeriod1MaxDays] = useState<number>(7);
  const [jumpAlertMinDays, setJumpAlertMinDays] = useState<number>(5);
  const [period2MaxDays, setPeriod2MaxDays] = useState<number>(14);

  // Estimated daily storage tariff penalty in USD
  const ESTIMATED_PERIOD2_SURCHARGE_PER_DAY = 25; // Extra cost/day in 2nd period
  const ESTIMATED_PERIOD3_SURCHARGE_PER_DAY = 60; // Extra cost/day in 3rd period

  const today = useMemo(() => toUTC(new Date()), []);

  // --- High-Performance Aggregation ---
  const processedData = useMemo(() => {
    let activeYardList: (Shipment & { dwellDays: number; periodTier: 'safe' | 'jump_alert' | 'period_2' | 'period_3'; daysToJump: number; estimatedExcessCost: number })[] = [];
    let allArrivedList: (Shipment & { dwellDays: number; periodTier: 'safe' | 'jump_alert' | 'period_2' | 'period_3'; daysToJump: number; estimatedExcessCost: number })[] = [];

    const terminalsSet = new Set<string>();
    const shipownersSet = new Set<string>();

    const len = shipments.length;
    for (let i = 0; i < len; i++) {
      const s = shipments[i];
      if (!s) continue;

      if (s.ata && isValidDate(s.ata)) {
        const ataUTC = toUTC(s.ata);
        
        // Calculate dwell days
        let dwellDays = 0;
        const isDelivered = !!(s.deliveryByd && isValidDate(s.deliveryByd));

        if (!isDelivered) {
          dwellDays = Math.max(0, Math.floor((today.getTime() - ataUTC.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          const delUTC = toUTC(s.deliveryByd!);
          dwellDays = Math.max(0, Math.floor((delUTC.getTime() - ataUTC.getTime()) / (1000 * 60 * 60 * 24)));
        }

        // Determine Period Tier
        let periodTier: 'safe' | 'jump_alert' | 'period_2' | 'period_3' = 'safe';
        let daysToJump = 0;
        let estimatedExcessCost = 0;

        if (dwellDays < jumpAlertMinDays) {
          periodTier = 'safe';
          daysToJump = jumpAlertMinDays - dwellDays;
        } else if (dwellDays <= period1MaxDays) {
          periodTier = 'jump_alert';
          daysToJump = (period1MaxDays + 1) - dwellDays;
          // Projected risk if it jumps to 2nd period for 7 days
          estimatedExcessCost = 7 * ESTIMATED_PERIOD2_SURCHARGE_PER_DAY;
        } else if (dwellDays <= period2MaxDays) {
          periodTier = 'period_2';
          daysToJump = (period2MaxDays + 1) - dwellDays;
          const daysInP2 = dwellDays - period1MaxDays;
          estimatedExcessCost = daysInP2 * ESTIMATED_PERIOD2_SURCHARGE_PER_DAY;
        } else {
          periodTier = 'period_3';
          daysToJump = 0;
          const daysInP2 = period2MaxDays - period1MaxDays;
          const daysInP3 = dwellDays - period2MaxDays;
          estimatedExcessCost = (daysInP2 * ESTIMATED_PERIOD2_SURCHARGE_PER_DAY) + (daysInP3 * ESTIMATED_PERIOD3_SURCHARGE_PER_DAY);
        }

        const enhancedShipment = {
          ...s,
          dwellDays,
          periodTier,
          daysToJump,
          estimatedExcessCost
        };

        const term = s.bondedWarehouse || s.depot || s.carrier || 'TECON Salvador';
        terminalsSet.add(term);

        if (s.shipowner) shipownersSet.add(s.shipowner);

        allArrivedList.push(enhancedShipment);

        // Active in yard (arrived and not delivered yet)
        if (!isDelivered) {
          activeYardList.push(enhancedShipment);
        }
      }
    }

    return {
      activeYardList,
      allArrivedList,
      terminals: Array.from(terminalsSet).sort(),
      shipowners: Array.from(shipownersSet).sort()
    };
  }, [shipments, today, period1MaxDays, jumpAlertMinDays, period2MaxDays]);

  // Base list based on selected scope
  const targetList = scopeMode === 'active_in_yard' ? processedData.activeYardList : processedData.allArrivedList;

  // Filtered List
  const filteredList = useMemo(() => {
    return targetList.filter((s) => {
      // Terminal Filter
      if (selectedTerminal !== 'all') {
        const term = s.bondedWarehouse || s.depot || s.carrier || 'TECON Salvador';
        if (term !== selectedTerminal) return false;
      }

      // Period Tier Filter
      if (selectedPeriodTier !== 'all' && s.periodTier !== selectedPeriodTier) {
        return false;
      }

      // Channel Filter
      if (selectedChannel !== 'all') {
        const param = (s.parametrization || '').toLowerCase();
        if (selectedChannel === 'verde' && !param.includes('verd') && !param.includes('green')) return false;
        if (selectedChannel === 'amarelo' && !param.includes('amar') && !param.includes('yellow')) return false;
        if (selectedChannel === 'vermelho' && !param.includes('verm') && !param.includes('red')) return false;
        if (selectedChannel === 'pendente' && (param.includes('verd') || param.includes('amar') || param.includes('verm') || param.includes('green') || param.includes('yellow') || param.includes('red'))) return false;
      }

      // Shipowner Filter
      if (selectedShipowner !== 'all' && s.shipowner !== selectedShipowner) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesContainer = s.containerNumber?.toLowerCase().includes(q);
        const matchesBL = s.billOfLading?.toLowerCase().includes(q);
        const matchesCargo = (s.cargoModel || s.cargo || '')?.toLowerCase().includes(q);
        const matchesVessel = s.vesselName?.toLowerCase().includes(q);
        const matchesAnalyst = (s.analyst || s.technicianResponsibleChinaTeam || '')?.toLowerCase().includes(q);
        const matchesProcess = s.processNumber?.toLowerCase().includes(q);
        if (!matchesContainer && !matchesBL && !matchesCargo && !matchesVessel && !matchesAnalyst && !matchesProcess) {
          return false;
        }
      }

      return true;
    });
  }, [targetList, selectedTerminal, selectedPeriodTier, selectedChannel, selectedShipowner, searchQuery]);

  // --- Metrics Summary ---
  const summaryMetrics = useMemo(() => {
    let totalCount = filteredList.length;
    let safeCount = 0;
    let jumpAlertCount = 0;
    let period2Count = 0;
    let period3Count = 0;
    let totalDwellDays = 0;
    let totalPotentialSavingsUSD = 0;
    let greenCount = 0;
    let redYellowCount = 0;
    let pendingDICount = 0;

    const blsSet = new Set<string>();
    const brokerMap: Record<string, {
      name: string;
      total: number;
      jumpAlertCount: number;
      period2Count: number;
      period3Count: number;
      shipments: typeof filteredList;
      criticalBLs: Set<string>;
    }> = {};

    const terminalDistribution: Record<string, { name: string; safe: number; jumpAlert: number; period2: number; period3: number; total: number }> = {};

    const dwellBuckets = [
      { name: '1-2 dias', range: [1, 2], count: 0, color: '#10B981', tier: '1º Período (Seguro)' },
      { name: '3-4 dias', range: [3, 4], count: 0, color: '#059669', tier: '1º Período (Normal)' },
      { name: '5-7 dias (Alerta Salto)', range: [5, 7], count: 0, color: '#F59E0B', tier: 'Zona de Salto Tarifário' },
      { name: '8-10 dias', range: [8, 10], count: 0, color: '#F97316', tier: '2º Período (Tarifa Dupla)' },
      { name: '11-14 dias', range: [11, 14], count: 0, color: '#EF4444', tier: '2º Período (Risco Alto)' },
      { name: '15+ dias (Crítico)', range: [15, 9999], count: 0, color: '#7C3AED', tier: '3º Período+ (Crítico)' }
    ];

    for (let i = 0; i < totalCount; i++) {
      const s = filteredList[i];
      if (s.billOfLading && s.billOfLading !== 'N/A') blsSet.add(s.billOfLading);
      totalDwellDays += s.dwellDays;

      if (s.periodTier === 'safe') safeCount++;
      else if (s.periodTier === 'jump_alert') {
        jumpAlertCount++;
        totalPotentialSavingsUSD += s.estimatedExcessCost;
      } else if (s.periodTier === 'period_2') {
        period2Count++;
        totalPotentialSavingsUSD += s.estimatedExcessCost;
      } else if (s.periodTier === 'period_3') {
        period3Count++;
        totalPotentialSavingsUSD += s.estimatedExcessCost;
      }

      // Customs status
      const param = (s.parametrization || '').toLowerCase();
      if (param.includes('verd') || param.includes('green')) greenCount++;
      else if (param.includes('amar') || param.includes('verm') || param.includes('yellow') || param.includes('red')) redYellowCount++;
      else pendingDICount++;

      // Dwell histogram buckets
      for (const b of dwellBuckets) {
        if (s.dwellDays >= b.range[0] && s.dwellDays <= b.range[1]) {
          b.count++;
          break;
        }
      }

      // Terminal Breakdown
      const termName = s.bondedWarehouse || s.depot || s.carrier || 'TECON Salvador';
      if (!terminalDistribution[termName]) {
        terminalDistribution[termName] = { name: termName, safe: 0, jumpAlert: 0, period2: 0, period3: 0, total: 0 };
      }
      terminalDistribution[termName].total++;
      if (s.periodTier === 'safe') terminalDistribution[termName].safe++;
      else if (s.periodTier === 'jump_alert') terminalDistribution[termName].jumpAlert++;
      else if (s.periodTier === 'period_2') terminalDistribution[termName].period2++;
      else if (s.periodTier === 'period_3') terminalDistribution[termName].period3++;

      // Broker / Analyst Breakdown
      const brokerName = s.analyst || s.technicianResponsibleChinaTeam || s.agent || 'Equipe Despacho Descentralizado';
      if (!brokerMap[brokerName]) {
        brokerMap[brokerName] = {
          name: brokerName,
          total: 0,
          jumpAlertCount: 0,
          period2Count: 0,
          period3Count: 0,
          shipments: [],
          criticalBLs: new Set()
        };
      }
      brokerMap[brokerName].total++;
      brokerMap[brokerName].shipments.push(s);
      if (s.periodTier === 'jump_alert') {
        brokerMap[brokerName].jumpAlertCount++;
        if (s.billOfLading) brokerMap[brokerName].criticalBLs.add(s.billOfLading);
      } else if (s.periodTier === 'period_2') {
        brokerMap[brokerName].period2Count++;
        if (s.billOfLading) brokerMap[brokerName].criticalBLs.add(s.billOfLading);
      } else if (s.periodTier === 'period_3') {
        brokerMap[brokerName].period3Count++;
        if (s.billOfLading) brokerMap[brokerName].criticalBLs.add(s.billOfLading);
      }
    }

    const avgDwellDays = totalCount > 0 ? (totalDwellDays / totalCount).toFixed(1) : '0.0';
    const jumpRiskPct = totalCount > 0 ? (((jumpAlertCount + period2Count + period3Count) / totalCount) * 100).toFixed(1) : '0.0';

    const terminalChartData = Object.values(terminalDistribution).sort((a, b) => b.total - a.total);
    const brokerList = Object.values(brokerMap).sort((a, b) => (b.jumpAlertCount + b.period2Count + b.period3Count) - (a.jumpAlertCount + a.period2Count + a.period3Count));

    return {
      totalCount,
      uniqueBLsCount: blsSet.size,
      safeCount,
      jumpAlertCount,
      period2Count,
      period3Count,
      avgDwellDays,
      jumpRiskPct,
      totalPotentialSavingsUSD,
      greenCount,
      redYellowCount,
      pendingDICount,
      dwellBuckets,
      terminalChartData,
      brokerList
    };
  }, [filteredList]);

  // --- Generate Push Message for Customs Broker Team ---
  const generateBrokerPushText = () => {
    const criticalList = filteredList.filter(s => s.periodTier === 'jump_alert' || s.periodTier === 'period_2' || s.periodTier === 'period_3');
    
    // Group critical by BL
    const blGroupMap: Record<string, { bl: string; count: number; maxDwell: number; terminal: string; channel: string; containers: string[] }> = {};
    for (const s of criticalList) {
      const bl = s.billOfLading || 'S/BL';
      if (!blGroupMap[bl]) {
        blGroupMap[bl] = {
          bl,
          count: 0,
          maxDwell: s.dwellDays,
          terminal: s.bondedWarehouse || s.depot || s.carrier || 'TECON',
          channel: s.parametrization || 'Aguardando',
          containers: []
        };
      }
      blGroupMap[bl].count++;
      blGroupMap[bl].maxDwell = Math.max(blGroupMap[bl].maxDwell, s.dwellDays);
      blGroupMap[bl].containers.push(s.containerNumber);
    }

    const blsSorted = Object.values(blGroupMap).sort((a, b) => b.maxDwell - a.maxDwell);

    const dateStr = new Date().toLocaleDateString('pt-BR');

    let text = `🚨 *COBRANÇA URGENTE: OTIMIZAÇÃO DE PERÍODO ALFANDEGADO & SALTO DE TARIFA* 🚨\n`;
    text += `📅 *Data:* ${dateStr} | *Operação:* BYD Auto Logistics Camaçari\n`;
    text += `🎯 *Foco:* Prevenção imediata de salto para 2º/3º período de armazenagem portuária e cobrança prioritária de desembaraço.\n\n`;
    text += `📊 *Resumo de Exposição:* \n`;
    text += `• Total de Contêineres em Risco Iminente / Período 2+: *${criticalList.length} CNTRs*\n`;
    text += `• Contêineres no Alerta de Salto (Dias 5 a 7): *${summaryMetrics.jumpAlertCount} CNTRs* (RISCO IMINENTE DE VIRADA)\n`;
    text += `• Contêineres já no 2º Período (Dias 8 a 14): *${summaryMetrics.period2Count} CNTRs*\n`;
    text += `• Contêineres no 3º Período+ (15+ dias): *${summaryMetrics.period3Count} CNTRs*\n`;
    text += `• Economia Evitável Estimada: *${currencyFormatter.format(summaryMetrics.totalPotentialSavingsUSD)}*\n\n`;

    text += `⚡ *BLs PRIORITÁRIOS PARA AÇÃO IMEDIATA DO DESPACHANTE:* \n`;
    blsSorted.slice(0, 15).forEach((b, idx) => {
      const statusIcon = b.maxDwell >= 15 ? '🟣 3º PERÍODO' : b.maxDwell >= 8 ? '🔴 2º PERÍODO' : '⚠️ ALERTA SALTO';
      text += `${idx + 1}. *BL: ${b.bl}* (${b.count} CNTRs)\n`;
      text += `   • Terminal: ${b.terminal} | Dwell: *${b.maxDwell} dias* [${statusIcon}]\n`;
      text += `   • Status Aduaneiro: ${b.channel}\n`;
      text += `   • Contêineres: ${b.containers.slice(0, 4).join(', ')}${b.containers.length > 4 ? ` (+${b.containers.length - 4})` : ''}\n`;
      text += `   • *AÇÃO EXIGIDA:* ${b.channel.toLowerCase().includes('verd') ? 'Agendar carregamento imediato p/ retirar antes do salto.' : 'Priorizar registro de DI e liberação com urgência.'}\n\n`;
    });

    if (blsSorted.length > 15) {
      text += `... e mais ${blsSorted.length - 15} BLs com risco de salto tarifário.\n\n`;
    }

    text += `Solicitamos retorno urgente com o status de cada processo para evitar acréscimo tarifário portuário e custos desnecessários.\n`;
    text += `Equipe de Supervisão Logística BYD.`;

    return text;
  };

  const handleCopyBrokerPush = () => {
    const text = generateBrokerPushText();
    navigator.clipboard.writeText(text);
    setCopiedBrokerMessage(true);
    setTimeout(() => setCopiedBrokerMessage(false), 3000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Container',
      'BL',
      'Terminal',
      'Armador',
      'Modelo',
      'ATA',
      'Dwell Days',
      'Faixa Periodo',
      'Dias para Salto',
      'Parametrizacao',
      'Analista/Despachante',
      'Custo Adicional Estimado (USD)'
    ];

    const rows = filteredList.map(s => [
      s.containerNumber || '',
      s.billOfLading || '',
      s.bondedWarehouse || s.depot || s.carrier || 'TECON',
      s.shipowner || '',
      s.cargoModel || s.cargo || '',
      s.ata ? s.ata.toISOString().split('T')[0] : '',
      s.dwellDays,
      s.periodTier,
      s.daysToJump,
      s.parametrization || 'Pendente',
      s.analyst || s.technicianResponsibleChinaTeam || '',
      s.estimatedExcessCost
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dwell_Time_Otimizacao_Alfandegada_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* 1. Header Banner & Executive Actions */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl border border-indigo-900/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Dwell Time & Salto de Tarifa
              </span>
              <span className="px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Blindagem de Custos Portuários
              </span>
              <span className="px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Cobrança de Despachantes
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black tracking-tight text-white">
              Otimização de Período Alfandegado
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              Monitore os contêineres já atracados no porto, identifique as cargas que estão na <strong>Zona Crítica de Salto de Tarifa (Dias 5 a 7)</strong> antes de dobrar o custo de armazenagem portuária e execute cobrança ágil sobre a equipe de despachantes.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Generate Broker Escalation Message */}
            <button
              onClick={handleCopyBrokerPush}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title="Copiar mensagem pronta com lista de BLs críticos para cobrar despachante no WhatsApp/E-mail"
            >
              {copiedBrokerMessage ? <Check className="w-4 h-4 text-slate-950" /> : <Send className="w-4 h-4 text-slate-950" />}
              <span>{copiedBrokerMessage ? 'Cobrança Copiada!' : 'Cobrar Despachante'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-4 py-3 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 backdrop-blur-sm"
              title="Exportar base detalhada de dwell time e saltos tarifários"
            >
              <Download className="w-4 h-4 text-indigo-300" />
              <span>Exportar Base</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top 6 Executive Impact KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Contêineres no Pátio (Atracados) */}
        <div
          onClick={() => onDrilldown && onDrilldown('Contêineres Atracados no Porto', filteredList)}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              {scopeMode === 'active_in_yard' ? 'Em Pátio Alfandegado' : 'Total Atracados'}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-slate-900 font-mono">
            {summaryMetrics.totalCount.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-between">
            <span>{summaryMetrics.uniqueBLsCount} BLs Ativos</span>
            <span className="text-indigo-600 font-extrabold flex items-center">
              Detalhar <ArrowRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* KPI 2: Alerta de Salto Iminente (Dias 5 a 7) */}
        <div
          onClick={() => onDrilldown && onDrilldown('Alerta de Salto Iminente (Dias 5 a 7 - Risco de Virada)', filteredList.filter(s => s.periodTier === 'jump_alert'))}
          className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-3xl border-2 border-amber-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              Alerta Salto (5-7d)
            </span>
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl group-hover:scale-110 transition-transform font-bold">
              ⚠️
            </div>
          </div>
          <div className="text-2xl font-display font-black text-amber-900 font-mono">
            {summaryMetrics.jumpAlertCount.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] font-bold text-amber-700 mt-1 flex items-center justify-between">
            <span>Prestes a virar tarifa</span>
            <span className="font-extrabold underline">Cobrar Já</span>
          </div>
        </div>

        {/* KPI 3: 2º Período Ativo (Dias 8 a 14) */}
        <div
          onClick={() => onDrilldown && onDrilldown('Contêineres no 2º Período Alfandegado (Dias 8 a 14)', filteredList.filter(s => s.periodTier === 'period_2'))}
          className="bg-white p-5 rounded-3xl border border-orange-200 shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-orange-700">
              2º Período (8-14d)
            </span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-orange-600 font-mono">
            {summaryMetrics.period2Count.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-between">
            <span>Tarifa duplicada</span>
            <span className="text-orange-600 font-extrabold flex items-center">
              Ver lista <ArrowRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* KPI 4: 3º Período / Crítico (15+ dias) */}
        <div
          onClick={() => onDrilldown && onDrilldown('Contêineres Críticos no 3º Período+ (15+ dias)', filteredList.filter(s => s.periodTier === 'period_3'))}
          className="bg-white p-5 rounded-3xl border border-purple-200 shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-800">
              3º Período+ (15d+)
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-purple-700 font-mono">
            {summaryMetrics.period3Count.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-between">
            <span>Custo exponencial</span>
            <span className="text-purple-600 font-extrabold flex items-center">
              Auditar <ArrowRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* KPI 5: Dwell Time Médio */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Dwell Médio
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-slate-900 font-mono">
            {summaryMetrics.avgDwellDays} <span className="text-sm font-bold text-slate-400">dias</span>
          </div>
          <div className="text-[11px] font-bold text-emerald-600 mt-1">
            {summaryMetrics.safeCount} CNTRs no 1º período seguro
          </div>
        </div>

        {/* KPI 6: Economia Potencial com Ação */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5 rounded-3xl border border-emerald-500/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              Custo Evitável
            </span>
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-display font-black text-emerald-900 font-mono">
            {currencyFormatter.format(summaryMetrics.totalPotentialSavingsUSD)}
          </div>
          <div className="text-[11px] font-bold text-emerald-700 mt-1">
            Economia ao evitar viradas
          </div>
        </div>
      </div>

      {/* 3. Global Filters Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Scope Selector: Active in Yard vs All Arrived */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
            <button
              onClick={() => setScopeMode('active_in_yard')}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                scopeMode === 'active_in_yard'
                  ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Ativos em Pátio (Atracados)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${scopeMode === 'active_in_yard' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {processedData.activeYardList.length}
              </span>
            </button>
            <button
              onClick={() => setScopeMode('all_arrived')}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                scopeMode === 'all_arrived'
                  ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Histórico de Todos Atracados</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${scopeMode === 'all_arrived' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {processedData.allArrivedList.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Container, BL, Processo, Navio, Despachante..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Period Tier Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Faixa de Período
            </label>
            <select
              value={selectedPeriodTier}
              onChange={(e) => setSelectedPeriodTier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas as Faixas ({targetList.length})</option>
              <option value="jump_alert">⚠️ Alerta Salto (Dias 5-7)</option>
              <option value="period_2">🔴 2º Período (Dias 8-14)</option>
              <option value="period_3">🟣 3º Período+ (15+ dias)</option>
              <option value="safe">🟢 1º Período Seguro (1-4 dias)</option>
            </select>
          </div>

          {/* Terminal Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Terminal Alfandegado
            </label>
            <select
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Terminais ({processedData.terminals.length})</option>
              {processedData.terminals.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Customs Channel Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Canal Aduaneiro
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Canais</option>
              <option value="verde">🟢 Canal Verde (Desembaraçado)</option>
              <option value="amarelo">🟡 Canal Amarelo (Documental)</option>
              <option value="vermelho">🔴 Canal Vermelho (Físico)</option>
              <option value="pendente">⚪ Aguardando DI / Parametrização</option>
            </select>
          </div>

          {/* Shipowner Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Armador Marítimo
            </label>
            <select
              value={selectedShipowner}
              onChange={(e) => setSelectedShipowner(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Armadores ({processedData.shipowners.length})</option>
              {processedData.shipowners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Interactive Visualizations: Dwell Histogram & Terminal Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dwell Time Histogram with Direct Data Labels */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-display font-black text-slate-900">
                  Distribuição por Faixa de Dwell Time
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Contêineres agrupados por dias de permanência no terminal portuário desde a atracação (ATA).
              </p>
            </div>

            {/* Toggle Data Labels */}
            <button
              onClick={() => setShowNumbersOnChart(!showNumbersOnChart)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showNumbersOnChart
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showNumbersOnChart ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showNumbersOnChart ? 'Valores Visíveis' : 'Ocultar Valores'}</span>
            </button>
          </div>

          <div className="h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryMetrics.dwellBuckets} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '1rem', border: 'none', color: '#fff', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(val: any, name: any, item: any) => [
                    `${Number(val).toLocaleString()} CNTRs (${item?.payload?.tier})`,
                    'Volume'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  name="Contêineres" 
                  radius={[8, 8, 0, 0]}
                  onClick={(entry) => {
                    const bucket = entry;
                    if (bucket && onDrilldown) {
                      const matched = filteredList.filter(s => s.dwellDays >= bucket.range[0] && s.dwellDays <= bucket.range[1]);
                      onDrilldown(`Faixa de Dwell: ${bucket.name} (${bucket.tier})`, matched);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {summaryMetrics.dwellBuckets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  {showNumbersOnChart && (
                    <LabelList
                      dataKey="count"
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        if (value === undefined || value === null || Number(value) <= 0) return null;
                        const formatted = Number(value).toLocaleString('pt-BR');
                        const textWidth = Math.max(38, formatted.length * 6.5 + 10);
                        const bucket = summaryMetrics.dwellBuckets[index];

                        return (
                          <g key={`dwell-bar-lbl-${index}`}>
                            <rect
                              x={x + width / 2 - textWidth / 2}
                              y={y - 22}
                              width={textWidth}
                              height={18}
                              rx={4}
                              fill={bucket.color === '#F59E0B' ? '#78350F' : '#0F172A'}
                              stroke={bucket.color}
                              strokeWidth={1.5}
                              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                            />
                            <text
                              x={x + width / 2}
                              y={y - 11}
                              fill="#FFFFFF"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="800"
                            >
                              {formatted}
                            </text>
                          </g>
                        );
                      }}
                    />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Legend & Action Guide */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-900">
              <span className="text-[10px] font-black uppercase block">1º Período (1-4d)</span>
              <span className="text-xs font-extrabold">{summaryMetrics.safeCount} CNTRs (Seguro)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <span className="text-[10px] font-black uppercase block">Alerta Salto (5-7d)</span>
              <span className="text-xs font-extrabold">{summaryMetrics.jumpAlertCount} CNTRs (Cobrar DI)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-900">
              <span className="text-[10px] font-black uppercase block">2º Período (8-14d)</span>
              <span className="text-xs font-extrabold">{summaryMetrics.period2Count} CNTRs (Duplicado)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
              <span className="text-[10px] font-black uppercase block">3º Período (15d+)</span>
              <span className="text-xs font-extrabold">{summaryMetrics.period3Count} CNTRs (Crítico)</span>
            </div>
          </div>
        </div>

        {/* Terminal Distribution Matrix */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Warehouse className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-display font-black text-slate-900">
                Mix de Terminais & Risco de Salto
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Proporção de contêineres e criticidade em cada recinto alfandegado.
            </p>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryMetrics.terminalChartData.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#1E293B', fontSize: 10, fontWeight: 700 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '1rem', border: 'none', color: '#fff' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="safe" name="1º Período" fill="#10B981" stackId="term" radius={[0, 0, 0, 0]} />
                <Bar dataKey="jumpAlert" name="Alerta Salto" fill="#F59E0B" stackId="term" radius={[0, 0, 0, 0]} />
                <Bar dataKey="period2" name="2º Período" fill="#F97316" stackId="term" radius={[0, 0, 0, 0]} />
                <Bar dataKey="period3" name="3º Período+" fill="#7C3AED" stackId="term" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Terminal Principal:</span>
              <span className="text-indigo-700">{summaryMetrics.terminalChartData[0]?.name || 'TECON'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Contêineres em Risco no Terminal Líder:</span>
              <span className="font-extrabold text-amber-700">
                {((summaryMetrics.terminalChartData[0]?.jumpAlert || 0) + (summaryMetrics.terminalChartData[0]?.period2 || 0) + (summaryMetrics.terminalChartData[0]?.period3 || 0)).toLocaleString('pt-BR')} CNTRs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Central de Ação: Cobrança do Time de Despachantes (Broker Push Center) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <Send className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black text-slate-900">
                Painel de Cobrança por Despachante & Analista
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Identifique quem são os responsáveis pelos lotes em risco de salto tarifário e dispare a cobrança de desembaraço e carregamento.
            </p>
          </div>

          <button
            onClick={handleCopyBrokerPush}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {copiedBrokerMessage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
            <span>{copiedBrokerMessage ? 'Texto Copiado!' : 'Copiar Texto para Envio'}</span>
          </button>
        </div>

        {/* Broker Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaryMetrics.brokerList.slice(0, 6).map((b, idx) => {
            const hasCritical = (b.jumpAlertCount + b.period2Count + b.period3Count) > 0;
            return (
              <div
                key={b.name}
                className={`p-5 rounded-3xl border transition-all text-left space-y-3 ${
                  hasCritical 
                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500 hover:shadow-md' 
                    : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Responsável / Analista
                    </span>
                    <h4 className="text-sm font-black text-slate-900 line-clamp-1">
                      {b.name}
                    </h4>
                  </div>
                  {hasCritical ? (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-amber-500 text-slate-950">
                      {(b.jumpAlertCount + b.period2Count + b.period3Count)} em Risco
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg bg-emerald-100 text-emerald-800">
                      Regular
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/60">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Total</span>
                    <span className="text-xs font-black text-slate-800 font-mono">{b.total}</span>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-200/60">
                    <span className="text-[9px] font-bold text-amber-700 uppercase block">Salto (5-7d)</span>
                    <span className="text-xs font-black text-amber-800 font-mono">{b.jumpAlertCount}</span>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-xl border border-orange-200/60">
                    <span className="text-[9px] font-bold text-orange-700 uppercase block">2º / 3º Per.</span>
                    <span className="text-xs font-black text-orange-800 font-mono">{b.period2Count + b.period3Count}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold text-slate-500">
                    {b.criticalBLs.size} BLs críticos
                  </span>
                  <button
                    onClick={() => onDrilldown && onDrilldown(`Lotes do Despachante: ${b.name}`, b.shipments)}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Lotes</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Detailed Operational Table with Risk Status & Direct Actions */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-display font-black text-slate-900">
                Detalhamento Operacional de Contêineres Atracados
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Listagem individual com dwell time real, dias restantes para salto de período e ação recomendada de despacho.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">
              Exibindo <span className="text-slate-900 font-black">{Math.min(100, filteredList.length)}</span> de <span className="text-slate-900 font-black">{filteredList.length}</span> contêineres
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4">Contêiner</th>
                <th className="py-3.5 px-4">BL / Processo</th>
                <th className="py-3.5 px-4">Terminal / Pátio</th>
                <th className="py-3.5 px-4">ATA (Porto)</th>
                <th className="py-3.5 px-4 text-center">Dwell Atual</th>
                <th className="py-3.5 px-4 text-center">Faixa / Salto</th>
                <th className="py-3.5 px-4">Status Aduaneiro</th>
                <th className="py-3.5 px-4">Analista / Despachante</th>
                <th className="py-3.5 px-4 text-right">Ação Recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredList.slice(0, 100).map((s, idx) => {
                const isJumpAlert = s.periodTier === 'jump_alert';
                const isPeriod2 = s.periodTier === 'period_2';
                const isPeriod3 = s.periodTier === 'period_3';
                const param = (s.parametrization || '').toLowerCase();
                const isGreen = param.includes('verd') || param.includes('green');

                return (
                  <tr
                    key={`${s.containerNumber}-${idx}`}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isJumpAlert ? 'bg-amber-50/40 font-semibold' : isPeriod2 ? 'bg-orange-50/30' : isPeriod3 ? 'bg-purple-50/30' : ''
                    }`}
                  >
                    {/* Container Number */}
                    <td className="py-3 px-4 font-mono font-black text-slate-900">
                      {s.containerNumber}
                    </td>

                    {/* BL & Model */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-indigo-700 font-mono">{s.billOfLading || 'S/BL'}</div>
                      <div className="text-[10px] text-slate-400">{s.cargoModel || s.cargo || 'Veículos/Peças'}</div>
                    </td>

                    {/* Terminal */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{s.bondedWarehouse || s.depot || s.carrier || 'TECON'}</div>
                      <div className="text-[10px] text-slate-400">{s.shipowner || 'MSC'}</div>
                    </td>

                    {/* ATA */}
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {s.ata ? s.ata.toLocaleDateString('pt-BR') : '-'}
                    </td>

                    {/* Dwell Days */}
                    <td className="py-3 px-4 text-center font-mono font-black text-sm">
                      <span className={`px-2.5 py-1 rounded-xl ${
                        isPeriod3 ? 'bg-purple-100 text-purple-800' :
                        isPeriod2 ? 'bg-orange-100 text-orange-800' :
                        isJumpAlert ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {s.dwellDays} dias
                      </span>
                    </td>

                    {/* Period Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {isJumpAlert ? (
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-amber-500 text-slate-950 animate-pulse">
                          ⚠️ Salto em {s.daysToJump}d
                        </span>
                      ) : isPeriod2 ? (
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-orange-500 text-white">
                          🔴 2º Período
                        </span>
                      ) : isPeriod3 ? (
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-purple-600 text-white">
                          🟣 3º Período+
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg bg-emerald-100 text-emerald-800">
                          🟢 1º Período
                        </span>
                      )}
                    </td>

                    {/* Customs Channel */}
                    <td className="py-3 px-4">
                      {isGreen ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Canal Verde
                        </span>
                      ) : param.includes('amar') || param.includes('yellow') ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Canal Amarelo
                        </span>
                      ) : param.includes('verm') || param.includes('red') ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <ShieldAlert className="w-3.5 h-3.5" /> Canal Vermelho
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Aguardando DI</span>
                      )}
                    </td>

                    {/* Broker / Analyst */}
                    <td className="py-3 px-4 text-slate-700 font-bold">
                      {s.analyst || s.technicianResponsibleChinaTeam || 'Despacho Central'}
                    </td>

                    {/* Action Required */}
                    <td className="py-3 px-4 text-right">
                      {isJumpAlert && isGreen ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black uppercase">
                          Agendar Carregamento Já
                        </span>
                      ) : isJumpAlert ? (
                        <span className="px-2 py-1 bg-rose-100 text-rose-900 rounded-lg text-[10px] font-black uppercase">
                          Cobrar Registro DI
                        </span>
                      ) : isPeriod2 || isPeriod3 ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-900 rounded-lg text-[10px] font-black uppercase">
                          Prioridade Máxima
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">
                          Fluxo Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredList.length > 100 && (
          <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-500">
            Mostrando os primeiros 100 registros. Utilize a busca ou os filtros para refinar os resultados ou baixe o CSV completo.
          </div>
        )}
      </div>
    </div>
  );
};

export default BondedDwellOptimization;
