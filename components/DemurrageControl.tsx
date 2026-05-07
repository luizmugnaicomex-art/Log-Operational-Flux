import React, { useMemo } from 'react';
import { Shipment } from '../types';

interface DemurrageControlProps {
  shipments: Shipment[];
}

export const DemurrageControl: React.FC<DemurrageControlProps> = ({ shipments }) => {
  const { 
    dateIssue, 
    demurrage, 
    highRisk, 
    mediumRisk, 
    lowRisk,
    demurrageCount,
    returnedLateCount,
    returnedOnTimeCount,
    totalCost
  } = useMemo(() => {
    const dateIssue: Shipment[] = [];
    const demurrage: Shipment[] = [];
    const highRisk: Shipment[] = [];
    const mediumRisk: Shipment[] = [];
    const lowRisk: Shipment[] = [];

    let demurrageCount = 0;
    let returnedLateCount = 0;
    let returnedOnTimeCount = 0;
    let totalCost = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    shipments.forEach(s => {
      // Aggregate costs
      totalCost += (s.demurrageCost || 0);

      // Check returned vs active
      if (s.actualDepotReturnDate) {
         if (s.freeTimeDate) {
            const freeTimeUTC = new Date(s.freeTimeDate);
            freeTimeUTC.setHours(0, 0, 0, 0);
            if (s.actualDepotReturnDate.getTime() > freeTimeUTC.getTime()) {
               returnedLateCount++;
            } else {
               returnedOnTimeCount++;
            }
         }
         return; // Returned, not displayed in board columns
      }
      
      if (!s.freeTimeDate) {
         // Maybe it has no free time date and has arrived - that's an issue
         if (s.ata) {
            dateIssue.push(s);
         }
         return;
      }

      const freeTimeUTC = new Date(s.freeTimeDate);
      freeTimeUTC.setHours(0, 0, 0, 0);
      const diffTime = freeTimeUTC.getTime() - todayTime;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        demurrage.push(s);
        demurrageCount++;
      } else if (diffDays <= 15) {
        highRisk.push(s);
      } else if (diffDays <= 30) {
        mediumRisk.push(s);
      } else {
        lowRisk.push(s);
      }
    });

    return {
      dateIssue, demurrage, highRisk, mediumRisk, lowRisk,
      demurrageCount, returnedLateCount, returnedOnTimeCount, totalCost
    };
  }, [shipments]);

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  });

  const renderCard = (s: Shipment) => {
    const diffDays = s.freeTimeDate 
      ? Math.ceil((new Date(s.freeTimeDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
      : null;
    
    return (
      <div key={s.containerNumber} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
        <div className="font-bold text-slate-800 dark:text-slate-100">{s.containerNumber}</div>
        <div className="text-xs text-slate-500 mb-2 truncate" title={s.vesselName || ''}>{s.vesselName || 'No Vessel'}</div>
        
        <div className="flex justify-between items-center text-xs">
          <span>{s.freeTimeDate ? s.freeTimeDate.toLocaleDateString() : 'Desconhecido'}</span>
          {diffDays !== null && (
            <span className={`font-bold ${diffDays < 0 ? 'text-red-600' : diffDays <= 15 ? 'text-orange-600' : diffDays <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
              {diffDays < 0 ? `${Math.abs(diffDays)}d Atraso` : `${diffDays}d Restante`}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">DASHBOARD DE CONTROLE DE DEMURRAGE</h2>
           <p className="text-sm text-slate-500">Contêineres não-devolvidos e fluxo financeiro</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-red-600">Com Demurrage</p>
              <p className="text-3xl font-extrabold text-red-600">{demurrageCount}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Prazo vencido</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-amber-600">Devolvidos c/ Demurrage</p>
              <p className="text-3xl font-extrabold text-amber-600">{returnedLateCount}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Entregues com custo</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-orange-600">Em Risco</p>
              <p className="text-3xl font-extrabold text-orange-600">{highRisk.length}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Próx. 15 dias</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-yellow-600">Atenção</p>
              <p className="text-3xl font-extrabold text-yellow-600">{mediumRisk.length}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">VENCE ≤ 30 DIAS</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-green-600">Devolvidos no Prazo</p>
              <p className="text-3xl font-extrabold text-green-600">{returnedOnTimeCount}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Retornados s/ custo</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-800 relative overflow-hidden">
              <p className="text-sm font-medium text-slate-300">Custo Total de Demurrage</p>
              <p className="text-2xl font-extrabold text-white mt-1">{currencyFormatter.format(totalCost)}</p>
              <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">*Ativos + devolvidos</p>
          </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800 mb-6">Demurrage Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                <div className="p-3 bg-purple-100 border-b border-purple-200">
                   <h3 className="text-xs font-bold text-purple-700 uppercase tracking-widest">ANALISAR DATA ({dateIssue.length})</h3>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] demurrage-board-col">
                    {dateIssue.map(renderCard)}
                </div>
            </div>
            <div className="flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                <div className="p-3 bg-red-100 border-b border-red-200">
                   <h3 className="text-xs font-bold text-red-700 uppercase tracking-widest">ATRASADO ({demurrage.length})</h3>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] demurrage-board-col">
                    {demurrage.map(renderCard)}
                </div>
            </div>
            <div className="flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                <div className="p-3 bg-orange-100 border-b border-orange-200">
                   <h3 className="text-xs font-bold text-orange-700 uppercase tracking-widest">ALTO RISCO ({highRisk.length})</h3>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] demurrage-board-col">
                    {highRisk.map(renderCard)}
                </div>
            </div>
            <div className="flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                <div className="p-3 bg-yellow-100 border-b border-yellow-200">
                   <h3 className="text-xs font-bold text-yellow-700 uppercase tracking-widest">ATENÇÃO ({mediumRisk.length})</h3>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] demurrage-board-col">
                    {mediumRisk.map(renderCard)}
                </div>
            </div>
            <div className="flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                <div className="p-3 bg-green-100 border-b border-green-200">
                   <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest">SEGURO ({lowRisk.length})</h3>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] demurrage-board-col">
                    {lowRisk.map(renderCard)}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
