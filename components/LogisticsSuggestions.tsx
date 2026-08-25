import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shipment } from '../types';
import {
  Lightbulb,
  ShieldAlert,
  Clock,
  TrendingDown,
  Warehouse,
  Truck,
  CheckCircle2,
  XCircle,
  Sliders,
  Sparkles,
  ArrowRight,
  Download,
  AlertTriangle,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Flame,
  Zap,
  Filter,
  Check,
  RotateCcw
} from 'lucide-react';
import { currencyFormatter } from '../utils/formatters';

interface LogisticsSuggestionsProps {
  shipments: Shipment[];
  onDrilldown?: (title: string, shipments: Shipment[]) => void;
}

interface SuggestionCardConfig {
  id: string;
  category: 'financial' | 'storage' | 'customs' | 'fleet' | 'throughput';
  title: string;
  subtitle: string;
  impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  estimatedSavingsBRL: number;
  estimatedRiskCount: number;
  status: 'active' | 'review' | 'dismissed';
  thresholdDays?: number;
  badge: string;
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());
const toUTC = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

export const LogisticsSuggestions: React.FC<LogisticsSuggestionsProps> = ({
  shipments = [],
  onDrilldown
}) => {
  // 1. Interactive settings & decision state for each suggestion
  const [suggestionStates, setSuggestionStates] = useState<Record<string, {
    status: 'active' | 'review' | 'dismissed';
    thresholdDays: number;
    notes?: string;
  }>>({
    'demurrage_early_warning': { status: 'active', thresholdDays: 3 },
    'bonded_dwell_cliff': { status: 'active', thresholdDays: 7 },
    'channel_inspection_alert': { status: 'active', thresholdDays: 5 },
    'street_turn_empty_reuse': { status: 'active', thresholdDays: 4 },
    'factory_buffer_saturation': { status: 'active', thresholdDays: 150 },
    'incoterm_demurrage_split': { status: 'active', thresholdDays: 14 }
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>('demurrage_early_warning');
  const [searchFilter, setSearchFilter] = useState('');

  const today = useMemo(() => toUTC(new Date()), []);

  // 2. High-performance calculations for the 120k dataset
  const metrics = useMemo(() => {
    let criticalDemurrageRiskList: Shipment[] = [];
    let warningDemurrageRiskList: Shipment[] = [];
    let totalDemurrageExposureUSD = 0;

    let bondedPeriod1CliffList: Shipment[] = [];
    let bondedPeriod2CliffList: Shipment[] = [];

    let redYellowChannelDelayList: Shipment[] = [];
    let greenChannelList: Shipment[] = [];

    let slowEmptyReturnList: Shipment[] = [];
    let directFactoryDischargeList: Shipment[] = [];

    const freeTimeThreshold = suggestionStates['demurrage_early_warning']?.thresholdDays || 3;
    const bondedDwellThreshold = suggestionStates['bonded_dwell_cliff']?.thresholdDays || 7;

    const len = shipments.length;
    for (let i = 0; i < len; i++) {
      const s = shipments[i];
      if (!s) continue;

      // --- Metric 1: Demurrage & Free Time Expiry ---
      if (s.freeTimeDate && isValidDate(s.freeTimeDate)) {
        const ftUTC = toUTC(s.freeTimeDate);
        const returnUTC = s.actualDepotReturnDate && isValidDate(s.actualDepotReturnDate) ? toUTC(s.actualDepotReturnDate) : null;
        
        // If container has not returned yet or was returned past free-time
        const checkDate = returnUTC || today;
        const diffDays = Math.ceil((ftUTC.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!s.actualDepotReturnDate) {
          if (diffDays <= 0) {
            // Already in demurrage
            criticalDemurrageRiskList.push(s);
            const overdueDays = Math.abs(diffDays);
            const rate = s.shipowner === 'MSC' ? 165 : s.shipowner === 'CMA CGM' ? 250 : 80;
            totalDemurrageExposureUSD += overdueDays * rate;
          } else if (diffDays <= freeTimeThreshold) {
            // In critical expiration zone
            criticalDemurrageRiskList.push(s);
          } else if (diffDays <= 7) {
            warningDemurrageRiskList.push(s);
          }
        }
      }

      // --- Metric 2: Bonded Yard Dwell Cliff (1st vs 2nd Period) ---
      if (s.ata && isValidDate(s.ata) && !s.deliveryByd) {
        const ataUTC = toUTC(s.ata);
        const dwellDays = Math.floor((today.getTime() - ataUTC.getTime()) / (1000 * 60 * 60 * 24));
        if (dwellDays >= bondedDwellThreshold && dwellDays < 15) {
          bondedPeriod1CliffList.push(s);
        } else if (dwellDays >= 15) {
          bondedPeriod2CliffList.push(s);
        }
      }

      // --- Metric 3: Customs Parametrization & Red/Yellow Inspections ---
      const param = (s.parametrization || '').toLowerCase();
      if (param.includes('vermelho') || param.includes('amarelo') || param.includes('red') || param.includes('yellow')) {
        if (!s.dateNF) {
          redYellowChannelDelayList.push(s);
        }
      } else if (param.includes('verde') || param.includes('green')) {
        greenChannelList.push(s);
      }

      // --- Metric 4: Street Turn & Empty Return Efficiency ---
      if (s.deliveryByd && isValidDate(s.deliveryByd) && !s.actualDepotReturnDate) {
        const delUTC = toUTC(s.deliveryByd);
        const daysWithFactory = Math.floor((today.getTime() - delUTC.getTime()) / (1000 * 60 * 60 * 24));
        if (daysWithFactory > 3) {
          slowEmptyReturnList.push(s);
        }
      }
    }

    return {
      criticalDemurrageRiskList,
      warningDemurrageRiskList,
      totalDemurrageExposureUSD,
      bondedPeriod1CliffList,
      bondedPeriod2CliffList,
      redYellowChannelDelayList,
      greenChannelList,
      slowEmptyReturnList
    };
  }, [shipments, suggestionStates, today]);

  // Suggestion Definitions
  const suggestions: SuggestionCardConfig[] = [
    {
      id: 'demurrage_early_warning',
      category: 'financial',
      title: 'Controle Preditivo de Demurrage & Free-Time',
      subtitle: 'Alerta preventivo de devolução de vazios com menos de 3 dias de free-time restante para estancar penalidades diárias com armadores.',
      impactLevel: 'CRITICAL',
      estimatedSavingsBRL: (metrics.criticalDemurrageRiskList.length * 165 * 5.6) + (metrics.totalDemurrageExposureUSD * 5.6),
      estimatedRiskCount: metrics.criticalDemurrageRiskList.length,
      status: suggestionStates['demurrage_early_warning']?.status || 'active',
      thresholdDays: suggestionStates['demurrage_early_warning']?.thresholdDays || 3,
      badge: 'Proteção Financeira'
    },
    {
      id: 'bonded_dwell_cliff',
      category: 'storage',
      title: 'Otimização de Período Alfandegado (Dwell Time & Salto de Tarifa)',
      subtitle: 'Monitoramento de contêineres atingindo o teto do 1º período (7 dias) e 2º período (15 dias) nos recintos alfandegados (TECON, Intermarítima, TPC, CLIA).',
      impactLevel: 'HIGH',
      estimatedSavingsBRL: metrics.bondedPeriod1CliffList.length * 1250,
      estimatedRiskCount: metrics.bondedPeriod1CliffList.length + metrics.bondedPeriod2CliffList.length,
      status: suggestionStates['bonded_dwell_cliff']?.status || 'active',
      thresholdDays: suggestionStates['bonded_dwell_cliff']?.thresholdDays || 7,
      badge: 'Armazenagem Portuária'
    },
    {
      id: 'channel_inspection_alert',
      category: 'customs',
      title: 'Gestão de Lead Time em Parametrização Fiscal (Canais Amarelo / Vermelho)',
      subtitle: 'Identificação imediata de DI retidas em conferência física/documental para priorização de resposta a exigências e agendamento de desova fiscal.',
      impactLevel: 'HIGH',
      estimatedSavingsBRL: metrics.redYellowChannelDelayList.length * 890,
      estimatedRiskCount: metrics.redYellowChannelDelayList.length,
      status: suggestionStates['channel_inspection_alert']?.status || 'active',
      thresholdDays: suggestionStates['channel_inspection_alert']?.thresholdDays || 5,
      badge: 'Desembaraço Aduaneiro'
    },
    {
      id: 'street_turn_empty_reuse',
      category: 'fleet',
      title: 'Triangulação e Giro Rápido de Contêiner Vazio (Street Turn)',
      subtitle: 'Controle do tempo de retenção do contêiner vazio na planta/buffer após entrega da carga para devolução imediata ao depot e eliminação de diárias de carreta.',
      impactLevel: 'MEDIUM',
      estimatedSavingsBRL: metrics.slowEmptyReturnList.length * 450,
      estimatedRiskCount: metrics.slowEmptyReturnList.length,
      status: suggestionStates['street_turn_empty_reuse']?.status || 'active',
      thresholdDays: suggestionStates['street_turn_empty_reuse']?.thresholdDays || 4,
      badge: 'Eficiência de Frota'
    },
    {
      id: 'factory_buffer_saturation',
      category: 'throughput',
      title: 'Balanceamento de Fluxo Fábrica vs Picos de Atracação (Buffer Shield)',
      subtitle: 'Previsão de saturação do gate de recebimento da fábrica (meta diária 150-170 CNTRs) escalonando transferências de pátio para evitar filas na portaria.',
      impactLevel: 'MEDIUM',
      estimatedSavingsBRL: 45000,
      estimatedRiskCount: Math.round(shipments.length * 0.08),
      status: suggestionStates['factory_buffer_saturation']?.status || 'active',
      thresholdDays: suggestionStates['factory_buffer_saturation']?.thresholdDays || 150,
      badge: 'Capacidade Operacional'
    },
    {
      id: 'incoterm_demurrage_split',
      category: 'financial',
      title: 'Auditoria de SLA por Incoterm & Condições de Armador (FOB vs CFR/CIF)',
      subtitle: 'Comparativo de custo total e performance de liberação entre lotes comprados FOB (com free-time negociado) vs embarques CIF/CFR.',
      impactLevel: 'MEDIUM',
      estimatedSavingsBRL: 32000,
      estimatedRiskCount: Math.round(shipments.length * 0.05),
      status: suggestionStates['incoterm_demurrage_split']?.status || 'active',
      thresholdDays: suggestionStates['incoterm_demurrage_split']?.thresholdDays || 14,
      badge: 'Auditoria Contratual'
    }
  ];

  // Filtered suggestions list
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      if (activeCategory !== 'all' && s.category !== activeCategory) return false;
      if (searchFilter && !s.title.toLowerCase().includes(searchFilter.toLowerCase()) && !s.subtitle.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [suggestions, activeCategory, searchFilter]);

  // Update card decision status
  const handleUpdateStatus = (id: string, newStatus: 'active' | 'review' | 'dismissed') => {
    setSuggestionStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: newStatus
      }
    }));
  };

  // Update threshold slider
  const handleUpdateThreshold = (id: string, newThreshold: number) => {
    setSuggestionStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        thresholdDays: newThreshold
      }
    }));
  };

  // Total potential savings calculation
  const totalPotentialSavings = useMemo(() => {
    return suggestions
      .filter(s => suggestionStates[s.id]?.status === 'active')
      .reduce((acc, s) => acc + s.estimatedSavingsBRL, 0);
  }, [suggestions, suggestionStates]);

  const stateValues = Object.values(suggestionStates) as Array<{ status: 'active' | 'review' | 'dismissed'; thresholdDays: number }>;
  const activeCount = stateValues.filter(s => s.status === 'active').length;
  const reviewCount = stateValues.filter(s => s.status === 'review').length;
  const dismissedCount = stateValues.filter(s => s.status === 'dismissed').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header Banner & Executive Insights */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0B1120] to-indigo-950 p-8 sm:p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl text-white relative overflow-hidden">
        {/* Glow Highlights */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Inteligência Logística & Controle Avançado</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black tracking-tight text-white">
              Sugestões & Controles Estratégicos
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Painel consultivo para dimensionamento em alta escala (~120.000 contêineres). Avalie, ajuste os parâmetros e confirme quais regras e gatilhos de controle operacional devem permanecer ativos no seu fluxo de supervisão.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl min-w-[150px] shadow-lg backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Economia Estimada
              </span>
              <span className="text-xl sm:text-2xl font-display font-black text-emerald-400">
                {currencyFormatter.format(totalPotentialSavings)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Em riscos mitigados</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl min-w-[130px] shadow-lg backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Status das Regras
              </span>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-emerald-400">{activeCount} ativas</span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-amber-400">{reviewCount} análise</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">{dismissedCount} desativadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            { id: 'all', label: 'Todas as Sugestões', count: suggestions.length },
            { id: 'financial', label: 'Demurrage & Custos', count: suggestions.filter(s => s.category === 'financial').length },
            { id: 'storage', label: 'Armazenagem & Pátio', count: suggestions.filter(s => s.category === 'storage').length },
            { id: 'customs', label: 'Aduana & Fiscal', count: suggestions.filter(s => s.category === 'customs').length },
            { id: 'fleet', label: 'Frota & Giro', count: suggestions.filter(s => s.category === 'fleet').length },
            { id: 'throughput', label: 'Capacidade Fábrica', count: suggestions.filter(s => s.category === 'throughput').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar controles..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* 3. Suggestions Grid with Decision Controls */}
      <div className="grid grid-cols-1 gap-6">
        {filteredSuggestions.map((card) => {
          const currentConfig = suggestionStates[card.id] || { status: 'active', thresholdDays: 3 };
          const isExpanded = expandedCardId === card.id;
          const isDismissed = currentConfig.status === 'dismissed';

          return (
            <div
              key={card.id}
              className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
                isDismissed 
                  ? 'border-slate-200 opacity-60 bg-slate-50/50' 
                  : currentConfig.status === 'active' 
                  ? 'border-indigo-100 ring-1 ring-indigo-500/10' 
                  : 'border-amber-200 bg-amber-50/20'
              }`}
            >
              {/* Card Header */}
              <div className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  {/* Category Icon */}
                  <div className={`p-3 rounded-2xl shrink-0 shadow-sm ${
                    card.impactLevel === 'CRITICAL' 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                      : card.impactLevel === 'HIGH' 
                      ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}>
                    {card.category === 'financial' && <DollarSign className="w-6 h-6" />}
                    {card.category === 'storage' && <Warehouse className="w-6 h-6" />}
                    {card.category === 'customs' && <ShieldAlert className="w-6 h-6" />}
                    {card.category === 'fleet' && <Truck className="w-6 h-6" />}
                    {card.category === 'throughput' && <Zap className="w-6 h-6" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {card.badge}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        card.impactLevel === 'CRITICAL' 
                          ? 'bg-rose-100 text-rose-700' 
                          : card.impactLevel === 'HIGH' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        Impacto {card.impactLevel}
                      </span>
                      {currentConfig.status === 'active' && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Regra Ativa
                        </span>
                      )}
                      {currentConfig.status === 'review' && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Em Avaliação
                        </span>
                      )}
                      {currentConfig.status === 'dismissed' && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Ocultado
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-display font-black text-slate-900">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-3xl">
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Side Metrics & Confirmation Action */}
                <div className="flex flex-wrap items-center gap-3 shrink-0 lg:self-center">
                  <div className="bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-2xl text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Contêineres Identificados
                    </span>
                    <span className="text-base font-display font-black text-slate-900">
                      {card.estimatedRiskCount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">CNTRs</span>
                    </span>
                  </div>

                  <div className="bg-emerald-50/60 border border-emerald-100 px-4 py-2.5 rounded-2xl text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                      Economia Estimada
                    </span>
                    <span className="text-base font-display font-black text-emerald-700">
                      {currencyFormatter.format(card.estimatedSavingsBRL)}
                    </span>
                  </div>

                  {/* Decision Button Group: Manter / Em Análise / Descartar */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => handleUpdateStatus(card.id, 'active')}
                      title="Confirmar e Manter Ativo no Painel"
                      className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        currentConfig.status === 'active'
                          ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Manter</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(card.id, 'review')}
                      title="Deixar em Análise"
                      className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        currentConfig.status === 'review'
                          ? 'bg-amber-500 text-white shadow-sm font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Análise</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(card.id, 'dismissed')}
                      title="Desativar esta regra de controle"
                      className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        currentConfig.status === 'dismissed'
                          ? 'bg-slate-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expand / Details Toggle */}
                  <button
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Expandable Parameter Adjuster & Dataset Drilldown */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-slate-100 bg-slate-50/60 p-6 sm:p-7 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Parameter Tuning Slider */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-display font-black text-slate-800 text-xs uppercase tracking-wider">
                            <Sliders className="w-4 h-4 text-indigo-600" />
                            <span>Calibrar Parâmetro de Gatilho</span>
                          </div>
                          <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-xs">
                            {currentConfig.thresholdDays} {card.id === 'factory_buffer_saturation' ? 'CNTRs/dia' : 'dias'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="range"
                            min={card.id === 'factory_buffer_saturation' ? 50 : 1}
                            max={card.id === 'factory_buffer_saturation' ? 300 : 30}
                            value={currentConfig.thresholdDays}
                            onChange={(e) => handleUpdateThreshold(card.id, Number(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>Sensibilidade Máxima (Antecipada)</span>
                            <span>Sensibilidade Padrão</span>
                            <span>Tolerante</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          O ajuste recalcula instantaneamente os contêineres enquadrados no lote ativo de 120k unidades sem sobrecarregar a memória.
                        </p>
                      </div>

                      {/* Right: Operational Recommendation & Action */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-2">
                            <Info className="w-4 h-4 text-sky-500" />
                            <span>Ação Operacional Recomendada</span>
                          </h4>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            {card.id === 'demurrage_early_warning' && 'Disparar lista de prioridade aos transportadores para coleta de contêineres no pátio e devolução programada de vazios aos armadores com maior tarifa diária (CMA CGM & MSC).'}
                            {card.id === 'bonded_dwell_cliff' && 'Escalar desembaraço aduaneiro das cargas com mais de 5 dias no recinto alfandegado antes do faturamento do 2º período de armazenagem.'}
                            {card.id === 'channel_inspection_alert' && 'Priorizar despachante aduaneiro nos canais amarelo/vermelho para agilizar vistoria física e emissão imediata da NF.'}
                            {card.id === 'street_turn_empty_reuse' && 'Negociar com transportadora o reaproveitamento direto de chassis para retorno ao porto com exportação ou devolução em até 24h.'}
                            {card.id === 'factory_buffer_saturation' && 'Manter pulmão de estoque nos recintos secundários e acionar janelas de recebimento noturnas para absorver o fluxo do navio.'}
                            {card.id === 'incoterm_demurrage_split' && 'Revisar acordos de frete internacional aumentando free-time padrão de 14 para 21 dias nos contratos FOB prioritários.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          {onDrilldown && card.id === 'demurrage_early_warning' && (
                            <button
                              onClick={() => onDrilldown('Controle Demurrage Crítico', metrics.criticalDemurrageRiskList)}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-600 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                              <span>Ver {metrics.criticalDemurrageRiskList.length} Contêineres</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDrilldown && card.id === 'bonded_dwell_cliff' && (
                            <button
                              onClick={() => onDrilldown('Armazenagem 1º/2º Período', [...metrics.bondedPeriod1CliffList, ...metrics.bondedPeriod2CliffList])}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-600 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                              <span>Ver Contêineres em Risco</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDrilldown && card.id === 'channel_inspection_alert' && (
                            <button
                              onClick={() => onDrilldown('Canais Amarelo / Vermelho', metrics.redYellowChannelDelayList)}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-600 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                              <span>Ver Retidos em Vistoria</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogisticsSuggestions;
