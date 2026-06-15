
export type CarrierId =
  | "TPC"
  | "INTERMARITIMA"
  | "CLIA_EMP"
  | "RECOM"
  | "CTS_MEDLOG"
  | "TRANSPARANA"
  | "TEGMA"
  | "TECON";

export interface Carrier {
  id: CarrierId;
  name: string;
}

export interface RoutePrice {
  id: string;
  description: string;
  distanceKm: number;
  prices: Partial<Record<CarrierId, number | null>>;
}

export interface INCTConfig {
  inctLotacao: number;
  inctFracionado: number;
  alertaAcimaPct: number;
}

export type TabId = "freight" | "return" | "warehouse";

export interface ProvisionSettings {
  transportQty: Record<string, number>;
  warehouseLeadTime: number;
  warehouseQty: number;
  selectedWarehouseId: CarrierId;
}

export interface DashboardState {
  routes: RoutePrice[];
  returnRoutes: RoutePrice[];
  warehouseRoutes: RoutePrice[];
  inct: INCTConfig;
  justifications: Partial<Record<CarrierId, string>>;
  activeTab: TabId;
  containerQuantity: number;
  provision: ProvisionSettings;
}

export interface RouteMetric {
  routeId: string;
  minPrice: number | null;
  diffPctByCarrier: Partial<Record<CarrierId, number | null>>;
}

export interface CarrierSummary {
  avgDiffPct: number | null;
  count: number;
  estimatedTotal: number;
  totalBasePrice: number;
}

export interface Shipment {
  containerNumber: string;
  billOfLading: string;
  lotNumber: string; 
  batchNumber: string; 
  cargoModel: string;  
  shipper: string;
  shipowner: string;
  cargo: string;
  vesselName: string;
  containerType: string;
  incoterm: string;
  bondedWarehouse: string;
  depot: string; // New field for Column AZ
  ata: Date | null;
  deliveryByd: Date | null;
  estimatedDelivery: Date | null;
  demurrageCost: number;
  parametrization: string;
  dateNF: Date | null;
  unloadDate: Date | null;
  carrier: string;
  analyst: string;
  technicianResponsibleChinaTeam?: string;
  reference?: string;
  voyage?: string;
  cargoPresence?: string;
  operationScope?: string;
  loadingDate?: Date | null;
  containerPuttedDownAtBydBuffer?: Date | null;
  containerStatusAtBuffer?: string;
  emptyContainerReturnOperation?: string;
  cargoReadyDate: Date | null;
  channelDate: Date | null;
  actualDepotReturnDate: Date | null;
  estimatedDepotDate: Date | null;
  freeTimeDate: Date | null;
  totalCost: number;
  taxCost: number;
  extraCost: number;
  portToDelivery: number | null;
  clientDeliveryVariance: number | null;
  totalClearanceTime: number | null;
  ataToChannelTime: number | null;
  channelToNfTime: number | null;
  customsProcessTime: number | null;
  portToCustomsTime: number | null;
  transportDeliveryTime: number | null;
  containerStreetTurnTime: number | null;
  depotReturnVariance: number | null;
  detentionRisk: number | null;
  portToCargoReady: number | null;
  madeRomaneio: string;
  status: string;
  statusComex?: string;
  generalWarehouse?: string;
  processNumber?: string;
  agent?: string;
  freeTime?: Date | null;
}

export interface PipelineWeek {
    period: string; 
    dateRangeStr?: string;
    vessels: string[];
    volume: number;
    deliveredCount: number;
    pendingCount: number;
    drainDaysGate: number;
    drainDaysFactory: number;
    status: 'PRAZO VENCIDO' | 'SAFE' | 'TIME COLLISION' | 'COMPLETED';
    weekNum: number;
    year: number;
}

export interface KpiData {
  totalShipments: number;
  deliveredCount: number;
  onTimePercentage: string;
  totalDemurrage: number;
  demurrageShipmentsCount: number;
  detentionRiskShipments: number;
  avgPortToDelivery: string;
  avgClearanceTime: string;
  avgAtaToChannel: string;
  avgChannelToNf: string;
  avgTransportTime: string;
  avgStreetTurnTime: string;
  avgPortToCargoReady: string;
  avgClientDeliveryVariance: string;
  avgDelayOnLate: string;
  avgDetentionDays: string;
  demurrageIncidence: string;
  detentionIncidence: string;
  dailyGoalValue: number;
  daysGoalAchieved: number;
  daysGoalNotAchieved: number;
  goalAchievementPct: string;
  avgWeekdayVolume: string;
  totalWeekdayVolume: number;
  weekendBonusVolume: number;
  totalWeekdaysOperated: number;
  totalOperationalDays: number;
  pendingRomaneioCount: number;
  flaggedContainersCount: number;
  projectedBacklogCrossing10Days: number;
  financialExposure: number;
  
  // New metrics from vanilla JS
  inTransit: number;
  portFiscal: number;
  bondedStock: number;
  ftRisk7d: number;
  ftRisk3d: number;
  bondedDwellSum: number;
  bondedDwellCount: number;
  bondedDwellGt7: number;
  bondedDwellGt10: number;
  bondedDwellMax: number;
}

export interface VesselMatrixSummary {
  vessel: string;
  eta: Date | null;
  statuses: Record<string, number>;
  warehouses: Record<string, number>;
  total: number;
}

export interface VesselMatrixData {
  rows: VesselMatrixSummary[];
  uniqueStatuses: string[];
  uniqueWarehouses: string[];
  grandTotals: {
    statuses: Record<string, number>;
    warehouses: Record<string, number>;
    total: number;
  };
}

export interface ChartData {
  pipeline: PipelineWeek[];
  leadTimeTrend: Array<{ 
    date: Date; 
    label: string; 
    containerCount: number; 
    lateCount: number; 
    isWeekend: boolean; 
    goalReached: boolean;
    achievementPct: number;
  }>;
  dailyCarrierBreakdown: Array<{
    date: Date;
    label: string;
    total: number;
    [key: string]: any;
  }>;
  dailyWarehousePickedBreakdown: Array<{
    date: Date;
    label: string;
    total: number;
    [key: string]: any;
  }>;
  dailyGeneralWarehousePickedBreakdown: Array<{
    date: Date;
    label: string;
    total: number;
    [key: string]: any;
  }>;
  dailyCarrierDelayBreakdown: Array<{
    date: Date;
    label: string;
    totalLate: number;
    [key: string]: any;
  }>;
  dailyDepotReturnBreakdown: Array<{
    date: Date;
    label: string;
    total: number;
    [key: string]: any;
  }>;
  monthlyStatus: Array<{
    name: string;
    delivered: number;
    pending: number;
    total: number;
    sortKey: number;
  }>;
  monthlyTrend: Array<{ name: string; value: number; late: number; sortKey: number; date: Date }>;
  dailyVolumeStats: { avg: number; min: number; max: number } | null;
  cycleTime: Array<{ name: string; value: number }>;
  carrierPerformance: Array<{ name: string; avgTime: number }>;
  carrierDelayImpact: Array<{ name: string; volume: number; lateCount: number; latePct: number; volumePct: number }>;
  depotDistribution: Array<{ name: string; value: number }>; 
  customsChannel: Array<{ name: string; value: number }>;
  demurrageIncidence: Array<{ name: string; value: number }>;
  detentionRisk: Array<{ name: string; value: number }>;
  analystWorkload: Array<{ name: string; value: number }>;
  demurrageByShipowner: Array<{ name: string; cost: number }>;
  streetTurnByCarrier: Array<{ name: string; avgTime: number }>;
  portToCargoReadyByCarrier: Array<{ name: string; avgTime: number }>;
  deliveryVarianceByCarrier: Array<{ name: string; avgVariance: number }>;
  carrierVolume: Array<{ name: string; value: number }>;
  warehouseVolume: Array<{ name: string; value: number; capacity: number; arrived: number }>;
  unloadedByWarehouse: Array<{ name: string; value: number; capacity: number }>;
  bondedFlow: Array<{ name: string; placed: number; picked: number; arrived: number }>; // New Chart
  bondedInventory: Array<{ name: string; arrivedNotPicked: number; futureArrivals: number; total: number }>;
  romaneioDistribution: Array<{ name: string; value: number }>;
  pqrAnalysis: Array<{
    name: string;
    value: number;
    percentage: number;
    classification: 'P' | 'Q' | 'R';
    avgLeadTime: number | null;
    totalCost: number;
  }>;
  xyzAnalysis: Array<{
    name: string;
    value: number;
    percentage: number;
    classification: 'X' | 'Y' | 'Z';
    avgLeadTime: number | null;
    totalCost: number;
  }>;
  cargoReadyComparison: Array<{
    date: Date;
    label: string;
    readyCount: number;
    deliveredCount: number;
    ataCount: number;
    runningBalance: number;
    readyCountBL: number;
    deliveredCountBL: number;
    ataCountBL: number;
    runningBalanceBL: number;
    isWeekend: boolean;
  }>;
  rampUpPlan: Array<{
    period: string;
    actualArrivals: number;
    projectedArrivals: number;
    cumulativeArrivals: number;
    sortKey: number;
  }>;
}

export interface SortConfig {
  key: keyof Shipment;
  direction: "asc" | "desc";
}

export interface WarehouseContract {
  id: CarrierId;
  name: string;
  periodDays: number;
  minRates: number[]; 
  storagePct: number[]; 
  grisPct: number;
  removalFee: number;
  adValoremPct: number;
  handlingFee: number;
  presenceFee: number;
  scanningFee: number;
  insurancePct: number;
}

export interface PortOperationData {
  name: string;
  nameCN: string;
  value: number;
}

export interface YardInventoryData {
  name: string;
  Capacity: number;
  Occupied: number;
  Available: number;
}

export interface TransportReleaseData {
  name: string;
  Transferred: number;
  Invoiced: number;
  Released: number;
  Total: number;
}

export interface DailyOperationTrend {
  name: string;
  TEGMA: number;
  GABARDO: number;
  BRAZUL: number;
  TRANSILVA: number;
  Total: number;
}

export interface PortYardDashboardData {
  portOperationData: PortOperationData[];
  portDistData: Array<{ name: string; value: number; fill: string }>;
  yardSlotData: YardInventoryData[];
  containerAgingData: Array<{ name: string; d1_7: number; d8_15: number; d16_30: number; d30plus: number }>;
  overdueAnalysisData: Array<{ name: string; quantity: number; proportion: number }>;
  transportReleaseData: TransportReleaseData[];
  transportTypeData: Array<{ name: string; value: number; fill: string }>;
  dailyTrendData: DailyOperationTrend[];
  modelTotals: Record<string, number>;
}
