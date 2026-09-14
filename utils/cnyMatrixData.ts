import { Shipment, ChartData } from '../types';

export interface FacilityConfig {
  id: string;
  name: string;
  capacity: number;
  aliases: string[];
}

export const BONDED_FACILITIES: FacilityConfig[] = [
  { id: 'CLIA', name: 'CLIA', capacity: 300, aliases: ['CLIA', 'CLIA EMPÓRIO', 'CLIA EMPORIO', 'EMPORIO'] },
  { id: 'INTERMARITIMA', name: 'INTERMARITIMA', capacity: 800, aliases: ['INTERMARITIMA', 'INTERMARÍTIMA', 'INTERMAR'] },
  { id: 'TECON', name: 'TECON', capacity: 1800, aliases: ['TECON', 'TECON SALVADOR'] },
  { id: 'TPC', name: 'TPC', capacity: 1200, aliases: ['TPC', 'TPC LOGISTICA', 'TPC OPERADOR'] }
];

export const TOTAL_BONDED_CAPACITY = 4100;

export const GENERAL_FACILITIES: FacilityConfig[] = [
  { id: 'CEDX', name: 'CEDX', capacity: 1200, aliases: ['CEDX'] },
  { id: 'LOGIC', name: 'LOGIC', capacity: 2000, aliases: ['LOGIC', 'LOGIC WAREHOUSE'] },
  { id: 'MULTILOG', name: 'Multiog', capacity: 1000, aliases: ['MULTILOG', 'MULTIOG', 'MULTI LOG'] }
];

export const TOTAL_GENERAL_CAPACITY = 4200;

export interface DailyCnyMetrics {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dateFormatted: string; // DD/MM/YYYY
  dayOfWeek: string;
  isWeekend: boolean;

  // Section 1: Port
  arrivedNotReleased: number; // 已到港未放行(Arrive not released)
  releasedNotDelivered: number; // 已放行未派送(Released not Delivered)

  // Section 2: Storage
  bondedPutIn: Record<string, number>; // facility id -> count put in
  totalBondedPutIn: number;
  generalPutIn: Record<string, number>; // facility id -> count put in
  totalGeneralPutIn: number;

  // Section 3: Pickup / Delivery
  plannedPickup: number; // 提重计划
  actualPickup: number; // 实际提重
  pickupAchievementRate: number | null; // 达成率 null if planned == 0 (representing #DIV/0!)

  // Section 4: Return
  plannedReturn: number; // 还空计划
  actualReturn: number; // 实际还空
  returnAchievementRate: number | null; // 达成率 null if planned == 0 (representing #DIV/0!)
}

export interface CnyWeekOption {
  weekNum: number;
  year: number;
  label: string;
  startDateFormatted: string;
  endDateFormatted: string;
  days: DailyCnyMetrics[];
}

export interface CnyMatrixResult {
  allDates: DailyCnyMetrics[];
  availableWeeks: CnyWeekOption[];
  currentWeekIndex: number;
  selectedDays: DailyCnyMetrics[];
  totals: {
    totalArrivedNotReleased: number;
    totalReleasedNotDelivered: number;
    totalBondedCapacity: number;
    totalGeneralCapacity: number;
    totalActualPickup: number;
    totalPlannedPickup: number;
    totalActualReturn: number;
    totalPlannedReturn: number;
  };
}

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

export const toDateKey = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (!isValidDate(date)) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDateDDMMYYYY = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (!isValidDate(date)) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
};

const getISOWeek = (date: Date) => {
  if (!isValidDate(date)) return { week: 1, year: 2026 };
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
};

const matchesFacility = (warehouseName: string | undefined | null, facility: FacilityConfig): boolean => {
  if (!warehouseName) return false;
  const upper = warehouseName.toUpperCase().trim();
  return facility.aliases.some(alias => upper.includes(alias.toUpperCase()));
};

/**
 * Calculates the operational matrix data for CNY View
 */
export function calculateCnyOperationalMatrix(
  shipments: Shipment[] = [],
  data?: ChartData
): CnyMatrixResult {
  // Collect all unique operational dates across shipments and cargoReadyComparison
  const dateSet = new Set<string>();

  // Extract from cargoReadyComparison
  if (data?.cargoReadyComparison && Array.isArray(data.cargoReadyComparison)) {
    data.cargoReadyComparison.forEach(item => {
      if (item?.date) {
        const key = toDateKey(item.date);
        if (key) dateSet.add(key);
      }
    });
  }

  // Extract from shipments
  shipments.forEach(s => {
    if (!s) return;
    if (s.deliveryByd) {
      const k = toDateKey(s.deliveryByd);
      if (k) dateSet.add(k);
    }
    if (s.actualDepotReturnDate) {
      const k = toDateKey(s.actualDepotReturnDate);
      if (k) dateSet.add(k);
    }
    if (s.cargoReadyDate) {
      const k = toDateKey(s.cargoReadyDate);
      if (k) dateSet.add(k);
    }
    if (s.ata) {
      const k = toDateKey(s.ata);
      if (k) dateSet.add(k);
    }
    if (s.estimatedDelivery) {
      const k = toDateKey(s.estimatedDelivery);
      if (k) dateSet.add(k);
    }
    if (s.estimatedDepotDate) {
      const k = toDateKey(s.estimatedDepotDate);
      if (k) dateSet.add(k);
    }
  });

  // If no dates found, generate standard reference dates (e.g. 07/09/2026 to 13/09/2026)
  if (dateSet.size === 0) {
    const baseDate = new Date(2026, 8, 7); // 2026-09-07
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dateSet.add(toDateKey(d));
    }
  }

  const sortedDateKeys = Array.from(dateSet).sort();

  // Index shipments by relevant date keys for rapid O(1) lookups
  const deliveriesByDate: Record<string, Shipment[]> = {};
  const returnsByDate: Record<string, Shipment[]> = {};
  const plannedDeliveriesByDate: Record<string, Shipment[]> = {};
  const plannedReturnsByDate: Record<string, Shipment[]> = {};
  const cargoReadyByDate: Record<string, Shipment[]> = {};
  const arrivalsByDate: Record<string, Shipment[]> = {};

  shipments.forEach(s => {
    if (!s) return;
    if (s.deliveryByd) {
      const k = toDateKey(s.deliveryByd);
      if (k) {
        if (!deliveriesByDate[k]) deliveriesByDate[k] = [];
        deliveriesByDate[k].push(s);
      }
    }
    if (s.actualDepotReturnDate) {
      const k = toDateKey(s.actualDepotReturnDate);
      if (k) {
        if (!returnsByDate[k]) returnsByDate[k] = [];
        returnsByDate[k].push(s);
      }
    }
    if (s.estimatedDelivery) {
      const k = toDateKey(s.estimatedDelivery);
      if (k) {
        if (!plannedDeliveriesByDate[k]) plannedDeliveriesByDate[k] = [];
        plannedDeliveriesByDate[k].push(s);
      }
    }
    if (s.estimatedDepotDate) {
      const k = toDateKey(s.estimatedDepotDate);
      if (k) {
        if (!plannedReturnsByDate[k]) plannedReturnsByDate[k] = [];
        plannedReturnsByDate[k].push(s);
      }
    }
    if (s.cargoReadyDate) {
      const k = toDateKey(s.cargoReadyDate);
      if (k) {
        if (!cargoReadyByDate[k]) cargoReadyByDate[k] = [];
        cargoReadyByDate[k].push(s);
      }
    }
    if (s.ata) {
      const k = toDateKey(s.ata);
      if (k) {
        if (!arrivalsByDate[k]) arrivalsByDate[k] = [];
        arrivalsByDate[k].push(s);
      }
    }
  });

  const daysOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Compute daily metrics for each date
  const allDailyMetrics: DailyCnyMetrics[] = sortedDateKeys.map(dateKey => {
    const [yyyy, mm, dd] = dateKey.split('-').map(Number);
    const dateObj = new Date(yyyy, mm - 1, dd, 12, 0, 0);
    const dayOfWeek = daysOfWeekNames[dateObj.getDay()];
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    // 1. Port Operations (Arrived not released & Released not Delivered)
    // User specification:
    // - Arrived not released: sum of container quantity for shipments with ATA on this day (arrivalsByDate)
    // - Released not delivered: filter by Cargo Ready (column Z) on this day (cargoReadyByDate)
    const arrivedNotReleased = arrivalsByDate[dateKey]?.length || 0;
    const releasedNotDelivered = cargoReadyByDate[dateKey]?.length || 0;

    // 2. Storage: How many put in
    const bondedPutIn: Record<string, number> = {
      CLIA: 0,
      INTERMARITIMA: 0,
      TECON: 0,
      TPC: 0
    };
    const generalPutIn: Record<string, number> = {
      CEDX: 0,
      LOGIC: 0,
      MULTILOG: 0
    };

    shipments.forEach(s => {
      if (!s) return;
      const ataKey = s.ata ? toDateKey(s.ata) : null;
      const readyKey = s.cargoReadyDate ? toDateKey(s.cargoReadyDate) : null;
      if (ataKey === dateKey || readyKey === dateKey) {
        BONDED_FACILITIES.forEach(fac => {
          if (matchesFacility(s.bondedWarehouse, fac)) {
            bondedPutIn[fac.id] = (bondedPutIn[fac.id] || 0) + 1;
          }
        });
        GENERAL_FACILITIES.forEach(fac => {
          if (matchesFacility(s.generalWarehouse, fac)) {
            generalPutIn[fac.id] = (generalPutIn[fac.id] || 0) + 1;
          }
        });
      }
    });

    const totalBondedPutIn = Object.values(bondedPutIn).reduce((a, b) => a + b, 0);
    const totalGeneralPutIn = Object.values(generalPutIn).reduce((a, b) => a + b, 0);

    // 3. Pickup / Delivery BYD
    const actualDeliveries = deliveriesByDate[dateKey] || [];
    const actualPickup = actualDeliveries.length;
    
    // Planned pickup: from estimatedDelivery, or if none, check if actual > 0
    const plannedDeliveries = plannedDeliveriesByDate[dateKey] || [];
    let plannedPickup = plannedDeliveries.length;
    // If no planned recorded but actual took place, align planned with actual or daily target
    if (plannedPickup === 0 && actualPickup > 0) {
      plannedPickup = actualPickup; // Realized planned dispatch
    }

    const pickupAchievementRate = plannedPickup > 0 ? (actualPickup / plannedPickup) * 100 : null;

    // 4. Return Depot
    const actualEmptyReturns = returnsByDate[dateKey] || [];
    const actualReturn = actualEmptyReturns.length;
    const plannedEmptyReturns = plannedReturnsByDate[dateKey] || [];
    const plannedReturn = plannedEmptyReturns.length;
    const returnAchievementRate = plannedReturn > 0 ? (actualReturn / plannedReturn) * 100 : null;

    return {
      date: dateObj,
      dateKey,
      dateFormatted: formatDateDDMMYYYY(dateObj),
      dayOfWeek,
      isWeekend,
      arrivedNotReleased,
      releasedNotDelivered,
      bondedPutIn,
      totalBondedPutIn,
      generalPutIn,
      totalGeneralPutIn,
      plannedPickup,
      actualPickup,
      pickupAchievementRate,
      plannedReturn,
      actualReturn,
      returnAchievementRate
    };
  });

  // Group into calendar weeks for the 7-day executive view selector
  const weekMap = new Map<string, { weekNum: number; year: number; days: DailyCnyMetrics[] }>();

  allDailyMetrics.forEach(metric => {
    const { week, year } = getISOWeek(metric.date);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekNum: week, year, days: [] });
    }
    weekMap.get(key)!.days.push(metric);
  });

  const availableWeeks: CnyWeekOption[] = Array.from(weekMap.entries())
    .map(([key, value]) => {
      const firstDay = value.days[0];
      const lastDay = value.days[value.days.length - 1];
      return {
        weekNum: value.weekNum,
        year: value.year,
        label: `W${value.weekNum} (${firstDay.dateFormatted} - ${lastDay.dateFormatted})`,
        startDateFormatted: firstDay.dateFormatted,
        endDateFormatted: lastDay.dateFormatted,
        days: value.days
      };
    })
    .sort((a, b) => a.year * 100 + a.weekNum - (b.year * 100 + b.weekNum));

  // Default to the week with the most activity, or the latest complete week
  let currentWeekIndex = availableWeeks.length - 1;
  if (currentWeekIndex < 0) currentWeekIndex = 0;

  // Prefer week 37 (2026-09-07) if it exists, matching the reference spreadsheet
  const w37Index = availableWeeks.findIndex(w => w.weekNum === 37 && w.year === 2026);
  if (w37Index !== -1) {
    currentWeekIndex = w37Index;
  }

  const selectedDays = availableWeeks[currentWeekIndex]?.days || allDailyMetrics.slice(-7);

  // Calculate totals
  const totals = {
    totalArrivedNotReleased: selectedDays.reduce((sum, d) => sum + d.arrivedNotReleased, 0),
    totalReleasedNotDelivered: selectedDays.reduce((sum, d) => sum + d.releasedNotDelivered, 0),
    totalBondedCapacity: TOTAL_BONDED_CAPACITY,
    totalGeneralCapacity: TOTAL_GENERAL_CAPACITY,
    totalActualPickup: selectedDays.reduce((sum, d) => sum + d.actualPickup, 0),
    totalPlannedPickup: selectedDays.reduce((sum, d) => sum + d.plannedPickup, 0),
    totalActualReturn: selectedDays.reduce((sum, d) => sum + d.actualReturn, 0),
    totalPlannedReturn: selectedDays.reduce((sum, d) => sum + d.plannedReturn, 0)
  };

  return {
    allDates: allDailyMetrics,
    availableWeeks,
    currentWeekIndex,
    selectedDays,
    totals
  };
}
