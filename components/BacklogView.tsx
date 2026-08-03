import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shipment } from '../types';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { 
    TrendingUp, 
    Anchor,
    Gauge,
    AlertCircle,
    CheckCircle2,
    Sliders,
    Database,
    FileText,
    HelpCircle,
    Activity
} from 'lucide-react';

interface BacklogViewProps {
    shipments: Shipment[];
}

interface LocationCount {
    id: string;
    name: string;
    emptyCount: number;
    fullCount: number;
}

interface StorageData {
    bondedArea: LocationCount[];
    warehouse: LocationCount[];
    buffer: LocationCount[];
}

export const BacklogView: React.FC<BacklogViewProps> = ({ shipments = [] }) => {
    // 1. HARDENED: Calculate active un-cleared backlog from excel shipments
    // Accepts any shipment that has an ATA, estimated delivery, or cargo ready date, but is NOT yet delivered to BYD.
    const activeBacklogItems = useMemo(() => {
        if (!Array.isArray(shipments)) return [];
        return shipments.filter(s => {
            if (!s) return false;
            const hasArrivalOrReadyDate = Boolean(s.ata || s.estimatedDelivery || s.cargoReadyDate);
            return hasArrivalOrReadyDate && !s.deliveryByd;
        });
    }, [shipments]);

    // 2. Load manual storage inventory safely
    const [manualStorage, setManualStorage] = useState<StorageData>({
        bondedArea: [],
        warehouse: [],
        buffer: []
    });

    const fetchManualStorage = () => {
        const stored = localStorage.getItem('emptyContainersDataV3');
        if (stored) {
            try {
                setManualStorage(JSON.parse(stored));
            } catch (e) {
                console.error("Failed parsing emptyContainersDataV3 in BacklogView", e);
            }
        }
    };

    useEffect(() => {
        fetchManualStorage();
        const interval = setInterval(fetchManualStorage, 2500);
        return () => clearInterval(interval);
    }, []);

    const manualStockTotal = useMemo(() => {
        if (!manualStorage) return 0;
        const bonded = (manualStorage.bondedArea || []).reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
        const warehouse = (manualStorage.warehouse || []).reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
        const buffer = (manualStorage.buffer || []).reduce((acc, loc) => acc + (loc.fullCount || 0) + (loc.emptyCount || 0), 0);
        return bonded + warehouse + buffer;
    }, [manualStorage]);

    // Slider state for clearance forecast scenario
    const [dailyClearanceLimit, setDailyClearanceLimit] = useState<number>(150);

    // 3. Extract and group Weekly inbound ramp up plan
    const rampUpDataWithScenarios = useMemo(() => {
        if (!Array.isArray(shipments) || shipments.length === 0) return [];
        const weeklyMap = new Map<string, { weekNum: number; actualArrivals: number; projectedArrivals: number }>();
        
        const getISOWeek = (date: Date) => {
            if (!(date instanceof Date) || isNaN(date.getTime())) return 1;
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };

        shipments.forEach(s => {
            if (!s) return;
            const date = s.ata || s.estimatedDelivery || s.cargoReadyDate;
            if (date && date instanceof Date && !isNaN(date.getTime())) {
                const year = date.getFullYear();
                const week = getISOWeek(date);
                const key = `W${week} - ${year}`;
                
                if (!weeklyMap.has(key)) {
                    weeklyMap.set(key, { weekNum: week, actualArrivals: 0, projectedArrivals: 0 });
                }
                
                const wk = weeklyMap.get(key)!;
                if (s.ata) {
                    wk.actualArrivals++;
                } else {
                    wk.projectedArrivals++;
                }
            }
        });

        const sortedWeeks = Array.from(weeklyMap.entries())
            .sort((a, b) => a[1].weekNum - b[1].weekNum)
            .map(([period, data]) => ({
                period,
                arrivals: data.actualArrivals + data.projectedArrivals,
                actualArrivals: data.actualArrivals,
                projectedArrivals: data.projectedArrivals
            }))
            .slice(-8);

        let accumulativeBacklog = activeBacklogItems.length;
        let cumulativeArrivals = 0;
        let cumulativeDelivered = 0;

        return sortedWeeks.map(wk => {
            cumulativeArrivals += wk.arrivals;
            const weeklyCapacity = dailyClearanceLimit * 5;
            const delivered = Math.min(weeklyCapacity, accumulativeBacklog + wk.arrivals);
            
            accumulativeBacklog = Math.max(0, accumulativeBacklog + wk.arrivals - delivered);
            cumulativeDelivered += delivered;

            return {
                ...wk,
                capacity: weeklyCapacity,
                delivered,
                backlogProjection: accumulativeBacklog,
                cumulativeArrivals,
                cumulativeDelivered
            };
        });
    }, [shipments, activeBacklogItems, dailyClearanceLimit]);

    const simulatedCumulativeVariance = useMemo(() => {
        if (rampUpDataWithScenarios.length === 0) return 0;
        const lastEstBacklog = rampUpDataWithScenarios[rampUpDataWithScenarios.length - 1]?.backlogProjection || 0;
        return manualStockTotal - lastEstBacklog;
    }, [rampUpDataWithScenarios, manualStockTotal]);

    const systemBacklogCount = activeBacklogItems.length;

    const supervisorInsight = useMemo(() => {
        const tolerance = 50;
        const diff = Math.abs(systemBacklogCount - manualStockTotal);
        
        if (systemBacklogCount === 0 && manualStockTotal === 0) {
            return {
                type: 'SUCCESS',
                text: "Estações de trabalho perfeitamente balanceadas. Zero pendências de desalfandegamento ou mercadorias retidas em pátio.",
                recommendation: "Procurement pode auditar os lançamentos sem riscos de multas adicionais por estadia."
            };
        }
        
        if (diff <= tolerance) {
            return {
                type: 'STABLE',
                text: `Os dados da planilha (${systemBacklogCount} faturados/arribados) estão em excelente concordância operacional com o estoque físico lançado manualmente (${manualStockTotal}). Desvio menor que ${tolerance} unidades.`,
                recommendation: "Mantenha o ritmo atual de liberação física de pátio na escala de " + dailyClearanceLimit + " containers/dia."
            };
        } else if (systemBacklogCount > manualStockTotal) {
            return {
                type: 'WARNING',
                text: `Alerta de Gargalo em Processamento: Há mais containers registrados no sistema (${systemBacklogCount}) do que declarados nos pátios físicos (${manualStockTotal}). Diferença de ${systemBacklogCount - manualStockTotal} unidades sem presença física confirmada.`,
                recommendation: "Solicitar inspeção alfandegária urgente ou confirmar romaneios de estorno de transporte."
            };
        } else {
            return {
                type: 'DANGER',
                text: `Falta de Registro no Sistema: Excesso de estoque manual detectado nos pátios (${manualStockTotal} declarados) vs apenas ${systemBacklogCount} pendentes no Excel. Indica possíveis faturamentos atrasados ou mercadoras sem lançamento DI.`,
                recommendation: "Fale com o time de Procurement / Despachantes para assegurar que todas as Notas Fiscais e DI dos armadores estejam atualizadas e em conformidade."
            };
        }
    }, [systemBacklogCount, manualStockTotal, dailyClearanceLimit]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 pb-20 w-full"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 glass p-12 rounded-[3.5rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-indigo-50/50 to-transparent">
                  <div className="absolute -right-6 -bottom-6 opacity-5">
                     <span className="material-icons text-[15rem] font-black">trending_up</span>
                  </div>
                  <div className="relative z-10">
                     <h2 className="text-5xl font-display font-black text-slate-800 tracking-[-0.06em]">Backlog <span className="text-byd-red">Projections</span></h2>
                     <p className="text-slate-400 font-bold mt-6 tracking-widest text-[11px] uppercase opacity-70 flex items-center gap-2 font-display">
                        <span className="w-2.5 h-2.5 rounded-full bg-byd-red animate-pulse"></span>
                        Inbound Capacity Ramp-Up Plan & Physical Inventory Reconciliation
                     </p>
                  </div>
               </div>

               <div className="glass p-10 rounded-[3.5rem] flex flex-col justify-center bg-slate-900 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/20">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <span className="material-icons text-6xl">gauge</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 font-display">Real-time Stock Discrepancy</p>
                  <div className={`text-5xl font-display font-black tracking-tighter ${simulatedCumulativeVariance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                     {simulatedCumulativeVariance > 0 ? `+${simulatedCumulativeVariance}` : simulatedCumulativeVariance}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest leading-none">Simulated Week-8 Variance</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">A - SYSTEM ACTIVE BACKLOG</span>
                    <div>
                        <span className="text-4xl font-extrabold text-slate-850 font-mono">{systemBacklogCount}</span>
                        <span className="text-xs text-slate-400 font-bold ml-2">Containers</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">Derived from Excel uploaded data (Undelivered units arrived at Port/Bonded area).</p>
                </div>

                <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">B - PHYSICAL YARD REGISTER</span>
                    <div>
                        <span className="text-4xl font-extrabold text-slate-850 font-mono">{manualStockTotal}</span>
                        <span className="text-xs text-slate-400 font-bold ml-2">Containers</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">Declared manually inside your bottom "Storage Inventory" drawer panel.</p>
                </div>

                <div className="bg-slate-50 border rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block mb-2">C - WEEKLY CLEARANCE SPEED</span>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-slate-700">Daily Target Cap</span>
                            <span className="text-sm font-black text-indigo-600 font-mono">{dailyClearanceLimit} / day</span>
                        </div>
                        <input 
                            type="range" 
                            min="50" 
                            max="300" 
                            step="10"
                            value={dailyClearanceLimit} 
                            onChange={(e) => setDailyClearanceLimit(Number(e.target.value))}
                            className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2" 
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed font-semibold">Slide this bar to predict different capacity scenarios (Weekly limit = {dailyClearanceLimit * 5} units).</p>
                </div>
            </div>

            <div className="glass p-10 rounded-[3.5rem] border-none shadow-glass ring-1 ring-white/40 bg-white/70">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-display font-black text-slate-850 tracking-tight">Capacity Ramp-Up & Inbound Projections</h3>
                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1.5">Simulation of active backlog depletion based on {dailyClearanceLimit} unit/day limit</p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rampUpDataWithScenarios} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                                dataKey="period" 
                                tick={{ fontSize: 10, fontWeight: 750, fill: '#64748b' }} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <YAxis tick={{ fontSize: 10, fontWeight: 750, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '15px' }} />
                            <Bar dataKey="arrivals" name="Inbound Arrivals" fill="#1e293b" radius={[6, 6, 0, 0]} maxBarSize={30} />
                            <Line type="monotone" dataKey="backlogProjection" name="Estimated Backlog" stroke="#DC2626" strokeWidth={3} dot={{ r: 5, fill: '#DC2626' }} />
                            <Line type="monotone" strokeDasharray="5 5" dataKey="delivered" name="Simulated Drain" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className={`border p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row gap-6 items-start ${supervisorInsight.type === 'SUCCESS' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' : supervisorInsight.type === 'STABLE' ? 'bg-blue-50/55 border-blue-200 text-blue-950' : 'bg-rose-50/50 border-rose-200 text-rose-950'}`}>
                <div className={`p-4 rounded-2xl ${supervisorInsight.type === 'SUCCESS' ? 'bg-emerald-100' : supervisorInsight.type === 'STABLE' ? 'bg-blue-100' : 'bg-rose-100'}`}>
                    <Gauge className={`w-8 h-8 ${supervisorInsight.type === 'SUCCESS' ? 'text-emerald-700' : supervisorInsight.type === 'STABLE' ? 'text-blue-700' : 'text-rose-700'}`} />
                </div>
                <div className="space-y-3 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-pulse" />
                        BYD SUPERVISOR ADVICE ENGINE
                    </span>
                    <h4 className="font-extrabold text-lg leading-snug tracking-tight">{supervisorInsight.text}</h4>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-85">RECOMENDAÇÃO: <span className="underline">{supervisorInsight.recommendation}</span></p>
                </div>
            </div>
        </motion.div>
    );
};