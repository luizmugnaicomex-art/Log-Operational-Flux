import React from 'react';
import { motion } from 'motion/react';
import { ChartData, Shipment } from '../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList,
    PieChart,
    Pie
} from 'recharts';
import { currencyFormatter } from '../utils/formatters';

interface GoodsAnalysisProps {
    data: ChartData;
    shipments: Shipment[];
}

const GoodsAnalysis: React.FC<GoodsAnalysisProps> = ({ data, shipments }) => {
    const pqrSummary = data.pqrAnalysis.reduce((acc, item) => {
        acc[item.classification] = (acc[item.classification] || 0) + item.value;
        return acc;
    }, {} as Record<string, number>);

    const pieData = [
        { name: 'P (Popular)', value: pqrSummary['P'] || 0, color: '#6366f1' },
        { name: 'Q (Quantity)', value: pqrSummary['Q'] || 0, color: '#f59e0b' },
        { name: 'R (Rare)', value: pqrSummary['R'] || 0, color: '#94a3b8' },
    ];

    const topModels = data.pqrAnalysis.slice(0, 10);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 pb-20"
        >
            {/* Header Bento Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-3 glass p-12 rounded-[3.5rem] flex flex-col justify-center relative overflow-hidden ring-1 ring-white/40 shadow-glass bg-gradient-to-br from-white/40 to-transparent">
                  <div className="absolute -right-10 -top-10 opacity-5">
                     <span className="material-icons text-[15rem] font-black">assessment</span>
                  </div>
                  <div className="relative z-10">
                     <h2 className="text-5xl font-display font-black text-slate-800 tracking-[-0.06em]">Inventory <span className="text-indigo-600">PQR</span> Strategy</h2>
                     <p className="text-slate-400 font-bold mt-6 tracking-widest text-[11px] uppercase opacity-60 flex items-center gap-2 font-display">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"></span>
                        Neural Frequency & Volume Classification
                     </p>
                  </div>
               </div>
               <div className="glass h-full p-10 rounded-[3.5rem] flex flex-col justify-center bg-slate-900 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/20">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <span className="material-icons text-6xl">category</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 font-display">Unique Models</p>
                  <div className="text-6xl font-display font-black tracking-tighter">
                     {data.pqrAnalysis.length}
                  </div>
                  <p className="text-xs font-bold text-indigo-400 mt-2 uppercase tracking-widest">Active Units</p>
               </div>
            </div>

            {/* Classification Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { id: 'P', label: 'Priority Popular', freq: 'High Frequency', color: 'indigo', val: pqrSummary['P'] || 0, icon: 'auto_graph' },
                    { id: 'Q', label: 'Quasi-Periodic', freq: 'Medium Cycle', color: 'amber', val: pqrSummary['Q'] || 0, icon: 'analytics' },
                    { id: 'R', label: 'Rare Operational', freq: 'Low Latency', color: 'slate', val: pqrSummary['R'] || 0, icon: 'history' }
                ].map((cat, i) => (
                    <motion.div 
                        key={cat.id}
                        whileHover={{ y: -8 }}
                        className="glass p-10 rounded-[3rem] ring-1 ring-white/40 shadow-glass flex flex-col justify-between group"
                    >
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                 cat.color === 'indigo' ? 'bg-indigo-600 text-white' : 
                                 cat.color === 'amber' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                              }`}>
                                 System {cat.id}
                              </span>
                              <span className={`material-icons ${cat.color === 'indigo' ? 'text-indigo-400' : cat.color === 'amber' ? 'text-amber-400' : 'text-slate-300'} opacity-40`}>{cat.icon}</span>
                           </div>
                           <h4 className="text-xl font-display font-black text-slate-800 tracking-tight">{cat.label}</h4>
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{cat.freq}</p>
                        </div>
                        <div className="mt-10">
                           <div className="flex items-end justify-between mb-4">
                              <div className="text-5xl font-display font-black text-slate-800 tracking-tighter">{cat.val}</div>
                              <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Total Units</div>
                           </div>
                           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${
                                 cat.color === 'indigo' ? 'bg-indigo-600' : cat.color === 'amber' ? 'bg-amber-500' : 'bg-slate-400'
                              } group-hover:scale-x-110 transition-transform origin-left duration-1000`} style={{ width: `${((cat.val) / shipments.length * 100).toFixed(1)}%` }}></div>
                           </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Analysis Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-5 glass p-10 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass flex flex-col">
                  <div className="mb-10">
                     <h3 className="text-xl font-display font-black text-slate-800 tracking-tight">Yield Distribution</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">PQR Semantic Split</p>
                  </div>
                  <div className="flex-1 h-[340px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={120}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                           >
                              {pieData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                           <Tooltip 
                              contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                           />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100 font-display">
                     {pieData.map((item, i) => (
                        <div key={i} className="text-center">
                           <div className="flex items-center justify-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.name.split(' ')[0]}</span>
                           </div>
                           <p className="text-lg font-black text-slate-800 tracking-tighter">{item.value}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="lg:col-span-7 glass p-10 rounded-[3.5rem] ring-1 ring-white/40 shadow-glass">
                  <div className="mb-10">
                     <h3 className="text-xl font-display font-black text-slate-800 tracking-tight">Prime Unit Velocity</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Top 10 High-Load Transmissions</p>
                  </div>
                  <div className="h-[430px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topModels} layout="vertical" margin={{ left: 50, right: 30 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} vertical={false} />
                           <XAxis type="number" hide />
                           <YAxis 
                              type="category" 
                              dataKey="name" 
                              tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8', textAnchor: 'end' }} 
                              axisLine={false}
                              tickLine={false}
                              width={100}
                           />
                           <Tooltip 
                              cursor={{fill: 'rgba(99, 102, 241, 0.05)'}}
                              contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                           />
                           <Bar dataKey="value" name="Containers" radius={[0, 20, 20, 0]} barSize={24}>
                              {topModels.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={
                                    entry.classification === 'P' ? '#6366f1' :
                                    entry.classification === 'Q' ? '#f59e0b' :
                                    '#94a3b8'
                                 } />
                              ))}
                              <LabelList dataKey="value" position="right" fontSize={10} fill="#1e293b" fontWeight={900} offset={10} />
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Detailed Table Section */}
            <div className="glass rounded-[4rem] ring-1 ring-white/50 shadow-glass overflow-hidden">
                <div className="p-12 border-b border-slate-100 flex items-center justify-between">
                   <div>
                      <h3 className="text-2xl font-display font-black text-slate-800 tracking-tight">Operational Logic Matrix</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Cargo Model Multi-Dimensional Semantic Layer</p>
                   </div>
                   <div className="bg-slate-100 px-6 py-2 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Flux Analytics 4.0
                   </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-900/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-12 py-8 sticky left-0 bg-white/90 backdrop-blur-md z-10">Cargo Model Unit</th>
                                <th className="px-8 py-8 text-center">Net Load</th>
                                <th className="px-8 py-8 text-center">Network Share</th>
                                <th className="px-8 py-8 text-center">Stratification</th>
                                <th className="px-8 py-8 text-center">Mean Velocity</th>
                                <th className="px-8 py-8 text-right pr-12">Deployment Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.pqrAnalysis.map((item, i) => (
                                <motion.tr 
                                  key={i} 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: (i % 20) * 0.02 }}
                                  className="group hover:bg-indigo-50/20 transition-colors"
                                >
                                    <td className="px-12 py-6 sticky left-0 bg-white/90 backdrop-blur-3xl z-10 group-hover:text-indigo-600 transition-colors border-r border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] ${
                                                item.classification === 'P' ? 'bg-indigo-500' :
                                                item.classification === 'Q' ? 'bg-amber-500' : 'bg-slate-300'
                                            }`}></div>
                                            <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 font-display uppercase tracking-tight">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="text-sm font-display font-black text-slate-800 tracking-tighter">{item.value}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">{item.percentage}%</span>
                                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-600 group-hover:scale-x-110 transition-transform origin-left" style={{ width: `${item.percentage}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                            item.classification === 'P' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' :
                                            item.classification === 'Q' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            Type {item.classification}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="text-xs font-black text-slate-500 font-sans tracking-tight">
                                            {item.avgLeadTime ? `${item.avgLeadTime.toFixed(1)}d` : '-'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right pr-12">
                                        <span className="text-xs font-display font-black text-slate-800 tracking-tighter">
                                            {currencyFormatter.format(item.totalCost)}
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
};

export default GoodsAnalysis;
