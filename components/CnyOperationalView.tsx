import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Ship,
  Truck,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Warehouse
} from 'lucide-react';
import { Shipment, ChartData } from '../types';
import {
  calculateCnyOperationalMatrix,
  DailyCnyMetrics,
  CnyWeekOption
} from '../utils/cnyMatrixData';
import { exportCnyOperationalMatrixToExcel } from '../utils/cnyExcelExport';

interface CnyOperationalViewProps {
  shipments?: Shipment[];
  data?: ChartData;
}

export const CnyOperationalView: React.FC<CnyOperationalViewProps> = ({
  shipments = [],
  data
}) => {
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(-1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [viewScope, setViewScope] = useState<'week' | 'all'>('week');

  // Compute operational matrix
  const matrixResult = useMemo(() => {
    return calculateCnyOperationalMatrix(shipments, data);
  }, [shipments, data]);

  // Set initial week index to the default if not set
  const activeWeekIndex = useMemo(() => {
    if (selectedWeekIndex >= 0 && selectedWeekIndex < matrixResult.availableWeeks.length) {
      return selectedWeekIndex;
    }
    return matrixResult.currentWeekIndex;
  }, [selectedWeekIndex, matrixResult]);

  const activeWeek: CnyWeekOption | undefined = matrixResult.availableWeeks[activeWeekIndex];

  // Active days to display
  const displayDays: DailyCnyMetrics[] = useMemo(() => {
    if (viewScope === 'all') {
      return matrixResult.allDates;
    }
    return activeWeek?.days || matrixResult.selectedDays;
  }, [viewScope, activeWeek, matrixResult]);

  const handlePrevWeek = () => {
    if (activeWeekIndex > 0) {
      setSelectedWeekIndex(activeWeekIndex - 1);
      setViewScope('week');
    }
  };

  const handleNextWeek = () => {
    if (activeWeekIndex < matrixResult.availableWeeks.length - 1) {
      setSelectedWeekIndex(activeWeekIndex + 1);
      setViewScope('week');
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);
      const weekLabel = activeWeek?.label.replace(/[/\\?%*:|"<>]/g, '_') || 'Current_Week';
      const fileName = `巴西末端物流关键数据_${viewScope === 'week' ? weekLabel : 'All_Dates'}.xlsx`;
      await exportCnyOperationalMatrixToExcel(displayDays, fileName);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to export CNY matrix to Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Toolbar & Context Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  巴西末端物流关键数据
                </h3>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-md border border-blue-200">
                  CNY Management Matrix
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Standardized daily executive matrix for port operations, storage capacities, factory deliveries, and empty returns.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Week Picker & Export Excel */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Week Navigation */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={handlePrevWeek}
              disabled={activeWeekIndex <= 0 || viewScope === 'all'}
              title="Previous Week"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={viewScope === 'all' ? 'all' : String(activeWeekIndex)}
              onChange={(e) => {
                if (e.target.value === 'all') {
                  setViewScope('all');
                } else {
                  setViewScope('week');
                  setSelectedWeekIndex(Number(e.target.value));
                }
              }}
              className="bg-transparent text-xs font-bold text-slate-800 px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {matrixResult.availableWeeks.map((w, idx) => (
                <option key={idx} value={String(idx)}>
                  {w.label}
                </option>
              ))}
              <option value="all">Full Period ({matrixResult.allDates.length} Days)</option>
            </select>

            <button
              onClick={handleNextWeek}
              disabled={activeWeekIndex >= matrixResult.availableWeeks.length - 1 || viewScope === 'all'}
              title="Next Week"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Prominent Export to Excel (.xlsx) Button */}
          <button
            onClick={handleExport}
            disabled={isExporting || displayDays.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer ${
              exportSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white hover:shadow-md'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? 'Generating Excel...' : exportSuccess ? 'Excel Exported!' : 'Export to Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Metric Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Bonded Capacity
            </span>
            <span className="text-lg font-black text-slate-800">4,100</span>
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">TEUs</span>
          </div>
          <Warehouse className="w-5 h-5 text-indigo-500" />
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              General Capacity
            </span>
            <span className="text-lg font-black text-slate-800">4,200</span>
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">TEUs</span>
          </div>
          <Layers className="w-5 h-5 text-purple-500" />
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Actual Picked Up
            </span>
            <span className="text-lg font-black text-emerald-700">
              {displayDays.reduce((sum, d) => sum + d.actualPickup, 0)}
            </span>
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">CNTR</span>
          </div>
          <Truck className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Actual Empty Returned
            </span>
            <span className="text-lg font-black text-blue-700">
              {displayDays.reduce((sum, d) => sum + d.actualReturn, 0)}
            </span>
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">CNTR</span>
          </div>
          <RotateCcw className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* 3. The Standardized Operational Matrix Table */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              {/* Row 1: Header Row */}
              <tr className="border-b border-slate-300 bg-[#B4C6E7] text-slate-900 font-bold">
                <th
                  colSpan={4}
                  className="py-3 px-4 text-center font-black text-sm tracking-wide border-r border-slate-300"
                >
                  巴西末端物流关键数据
                </th>
                {displayDays.map((day, idx) => (
                  <th
                    key={idx}
                    className="py-3 px-3 text-center font-black min-w-[105px] border-r border-slate-300 last:border-r-0 whitespace-nowrap"
                  >
                    <div>{day.dateFormatted}</div>
                    <div className="text-[10px] font-semibold text-slate-700">{day.dayOfWeek}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-sans">
              {/* ---------------- SECTION 1: PORT OPERATIONS ---------------- */}
              {/* Row 2: Arrived not released */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="w-20 py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/80 text-slate-700 align-middle"
                >
                  Port
                </td>
                <td
                  rowSpan={2}
                  className="w-36 py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/50 text-slate-700 align-middle"
                >
                  Vessel Arrival SSA
                </td>
                <td
                  colSpan={2}
                  className="py-2.5 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap"
                >
                  已到港未放行(Arrive not released)
                </td>
                {displayDays.map((day, idx) => (
                  <td
                    key={idx}
                    className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0"
                  >
                    {day.arrivedNotReleased}
                  </td>
                ))}
              </tr>

              {/* Row 3: Released not Delivered */}
              <tr className="hover:bg-slate-50/50">
                <td
                  colSpan={2}
                  className="py-2.5 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap"
                >
                  已放行未派送(Released not Delivered)
                </td>
                {displayDays.map((day, idx) => (
                  <td
                    key={idx}
                    className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0"
                  >
                    {day.releasedNotDelivered}
                  </td>
                ))}
              </tr>

              {/* ---------------- SECTION 2: STORAGE (BONDED) ---------------- */}
              {/* Row 4 & 5: CLIA */}
              <tr className="hover:bg-slate-50/50 border-t-2 border-slate-300">
                <td
                  rowSpan={18}
                  className="py-2.5 px-3 font-black text-center border-r border-slate-300 bg-slate-100/90 text-slate-800 align-middle"
                >
                  Storage
                </td>
                <td
                  rowSpan={10}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-blue-50/40 text-blue-900 align-middle"
                >
                  Bonded
                </td>
                <td
                  rowSpan={2}
                  className="w-32 py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  CLIA
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    300
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.bondedPutIn['CLIA'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 6 & 7: INTERMARITIMA */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  INTERMARITIMA
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    800
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.bondedPutIn['INTERMARITIMA'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 8 & 9: TECON */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  TECON
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    1800
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.bondedPutIn['TECON'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 10 & 11: TPC */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  TPC
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    1200
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.bondedPutIn['TPC'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 12 & 13: Total Bonded */}
              <tr className="bg-slate-50/90 font-bold">
                <td
                  rowSpan={2}
                  className="py-2 px-3 text-center border-r border-slate-300 align-middle font-black text-slate-900"
                >
                  Total
                </td>
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-black text-slate-900 border-r border-slate-300 last:border-r-0">
                    4100
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/90 font-bold">
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-black text-slate-900 border-r border-slate-300 last:border-r-0">
                    {day.totalBondedPutIn}
                  </td>
                ))}
              </tr>

              {/* ---------------- SECTION 2: STORAGE (GENERAL) ---------------- */}
              {/* Row 14 & 15: CEDX */}
              <tr className="hover:bg-slate-50/50 border-t-2 border-slate-300">
                <td
                  rowSpan={8}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-purple-50/40 text-purple-900 align-middle"
                >
                  General
                </td>
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  CEDX
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    1200
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.generalPutIn['CEDX'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 16 & 17: LOGIC */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  LOGIC
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    2000
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.generalPutIn['LOGIC'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 18 & 19: Multiog */}
              <tr className="hover:bg-slate-50/50">
                <td
                  rowSpan={2}
                  className="py-2 px-3 font-bold text-center border-r border-slate-300 align-middle bg-slate-50/30 text-slate-800"
                >
                  Multiog
                </td>
                <td className="py-2 px-3 font-medium text-slate-600 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-300 last:border-r-0">
                    1000
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.generalPutIn['MULTILOG'] || 0}
                  </td>
                ))}
              </tr>

              {/* Row 20 & 21: Total General */}
              <tr className="bg-slate-50/90 font-bold">
                <td
                  rowSpan={2}
                  className="py-2 px-3 text-center border-r border-slate-300 align-middle font-black text-slate-900"
                >
                  Total
                </td>
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  Capacity of Containers
                </td>
                {displayDays.map((_, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-black text-slate-900 border-r border-slate-300 last:border-r-0">
                    4200
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/90 font-bold">
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  How many put in
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-black text-slate-900 border-r border-slate-300 last:border-r-0">
                    {day.totalGeneralPutIn}
                  </td>
                ))}
              </tr>

              {/* ---------------- SECTION 3: PICKUP / DELIVERY ---------------- */}
              <tr className="hover:bg-slate-50/50 border-t-2 border-slate-300">
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-black text-center border-r border-slate-300 bg-emerald-50/50 text-emerald-950 align-middle"
                >
                  Pickup
                </td>
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/40 text-slate-800 align-middle"
                >
                  Delivery BYD
                </td>
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/40 text-slate-800 align-middle"
                >
                  萨尔瓦多
                </td>
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  提重计划
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.plannedPickup}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  实际提重
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.actualPickup}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/50 font-bold">
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  达成率
                </td>
                {displayDays.map((day, idx) => (
                  <td
                    key={idx}
                    className={`py-2 px-3 text-center font-black border-r border-slate-300 last:border-r-0 ${
                      day.pickupAchievementRate !== null
                        ? day.pickupAchievementRate >= 100
                          ? 'text-emerald-700 bg-emerald-50/50'
                          : 'text-amber-700 bg-amber-50/50'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.pickupAchievementRate !== null ? `${day.pickupAchievementRate.toFixed(1)}%` : '#DIV/0!'}
                  </td>
                ))}
              </tr>

              {/* ---------------- SECTION 4: RETURN ---------------- */}
              <tr className="hover:bg-slate-50/50 border-t-2 border-slate-300">
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-black text-center border-r border-slate-300 bg-blue-50/50 text-blue-950 align-middle"
                >
                  Return
                </td>
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/40 text-slate-800 align-middle"
                >
                  Return Depot
                </td>
                <td
                  rowSpan={3}
                  className="py-2.5 px-3 font-bold text-center border-r border-slate-300 bg-slate-50/40 text-slate-800 align-middle"
                >
                  船司堆场
                </td>
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  还空计划
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.plannedReturn > 0 ? day.plannedReturn : 0}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-300 whitespace-nowrap">
                  实际还空
                </td>
                {displayDays.map((day, idx) => (
                  <td key={idx} className="py-2 px-3 text-center font-bold bg-[#FFFF00]/90 text-slate-950 border-r border-slate-300 last:border-r-0">
                    {day.actualReturn > 0 ? day.actualReturn : 0}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/50 font-bold">
                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                  达成率
                </td>
                {displayDays.map((day, idx) => (
                  <td
                    key={idx}
                    className={`py-2 px-3 text-center font-black border-r border-slate-300 last:border-r-0 ${
                      day.returnAchievementRate !== null
                        ? day.returnAchievementRate >= 100
                          ? 'text-emerald-700 bg-emerald-50/50'
                          : 'text-amber-700 bg-amber-50/50'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.returnAchievementRate !== null ? `${day.returnAchievementRate.toFixed(1)}%` : '#DIV/0!'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
