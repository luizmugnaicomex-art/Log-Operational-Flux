
import React from 'react';
import { PipelineWeek } from '../types';

interface PipelineAnalysisProps {
    data: PipelineWeek[];
    onWeekClick: (week: PipelineWeek) => void;
}

const PipelineAnalysis: React.FC<PipelineAnalysisProps> = ({ data, onWeekClick }) => {
    if (!data || data.length === 0) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PRAZO VENCIDO': return 'bg-red-50 text-red-600 border-red-100';
            case 'TIME COLLISION': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'SAFE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    return (
        <div className="glass rounded-[2.5rem] border-none shadow-glass overflow-hidden mb-12 ring-1 ring-white/40">
            <div className="p-8 border-b border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.25em] flex items-center gap-3">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                            <span className="material-icons text-indigo-600 text-sm">view_week</span>
                        </div>
                        Strategic Supply Pipeline
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-1 opacity-80">
                        Arrival forecast vs processing capacity bottlenecks
                    </p>
                </div>
                <div className="flex gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest glass-dark px-8 py-3 rounded-2xl ring-1 ring-white/50">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"/>GATE: 170/D</span>
                    <span className="opacity-20">|</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"/>FACTORY: 150/D</span>
                    <span className="opacity-20">|</span>
                    <span className="text-slate-800 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>GOAL: 10 DIAS</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/10 glass-dark">
                            <th className="px-8 py-5">Period Cycle</th>
                            <th className="px-6 py-5">Vessel Matrix</th>
                            <th className="px-6 py-5 text-center">Net Volume</th>
                            <th className="px-6 py-5 text-center">Velocity Status</th>
                            <th className="px-6 py-5 text-center">Gate Drain</th>
                            <th className="px-6 py-5 text-center">Factory Drain</th>
                            <th className="px-8 py-5 text-right">Health</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {data.map((week, idx) => {
                            const isCompleted = week.deliveredCount === week.volume && week.volume > 0;
                            const pickupPercentage = week.volume > 0 ? (week.deliveredCount / week.volume) * 100 : 0;

                            return (
                                <tr 
                                    key={idx} 
                                    onClick={() => {
                                        onWeekClick(week);
                                    }}
                                    className="hover:bg-white/40 cursor-pointer transition-all group relative"
                                >
                                    <td className="px-8 py-6 font-black text-slate-800 text-sm tracking-tight">{week.period}</td>
                                    <td className="px-6 py-6 text-[11px] font-bold text-slate-500 max-w-[200px] truncate group-hover:text-indigo-600 transition-colors">
                                        {week.vessels.length > 0 ? week.vessels.join(', ') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <span className="text-sm font-black text-indigo-600 group-hover:scale-110 transition-transform inline-block px-3 py-1 bg-indigo-50 rounded-lg ring-1 ring-indigo-100">
                                            {week.volume}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 min-w-[180px]">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center px-1">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {isCompleted ? 'Finalized ✓' : `${week.deliveredCount} Units Hit`}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-400 tracking-widest">
                                                    {week.pendingCount > 0 ? `${week.pendingCount} On Wait` : ''}
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/50 rounded-full overflow-hidden shadow-inner ring-1 ring-black/5">
                                                <div 
                                                    className={`h-full transition-all duration-1000 shadow-sm ${isCompleted ? 'bg-emerald-500 shadow-emerald-200' : 'bg-indigo-500 shadow-indigo-200'}`}
                                                    style={{ width: `${pickupPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center font-black text-slate-700 text-sm">
                                        {week.drainDaysGate} <span className="text-[10px] text-slate-400 font-bold ml-1">D</span>
                                    </td>
                                    <td className="px-6 py-6 text-center font-black text-slate-700 text-sm">
                                        {week.drainDaysFactory} <span className="text-[10px] text-slate-400 font-bold ml-1">D</span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className={`inline-flex px-4 py-1.5 rounded-xl text-[9px] font-black border uppercase shadow-sm ring-1 ring-white/20 ${getStatusColor(week.status)}`}>
                                            {week.status === 'TIME COLLISION' ? `Collision (150/D)` : week.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-8 glass-dark border-t border-white/20">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 pl-1">Practical Logic Applied</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    <div className="flex items-start gap-4 text-[11px] text-slate-600 font-bold leading-relaxed group">
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] group-hover:scale-110 transition-transform">•</span>
                        <span>Time collision = volume ok, but factory cap breaks the week (150/day bottleneck).</span>
                    </div>
                    <div className="flex items-start gap-4 text-[11px] text-slate-600 font-bold leading-relaxed group">
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] group-hover:scale-110 transition-transform">•</span>
                        <span>Bonded dwell shows clearance + scheduling health (not just stock).</span>
                    </div>
                    <div className="flex items-start gap-4 text-[11px] text-slate-600 font-bold leading-relaxed group">
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] group-hover:scale-110 transition-transform">•</span>
                        <span>Free time drives priority queue and demurrage defense.</span>
                    </div>
                    <div className="flex items-start gap-4 text-[11px] text-slate-600 font-bold leading-relaxed group">
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] group-hover:scale-110 transition-transform">•</span>
                        <span>VESSEL IMPACT (BONDED & BUFFER) simulates day-by-day throughput.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(PipelineAnalysis);
