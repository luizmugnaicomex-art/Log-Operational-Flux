
import { Carrier, DashboardState, RoutePrice, ProvisionSettings, WarehouseContract } from "./types";

export const FREIGHT_CARRIERS: Carrier[] = [
  { id: "TPC", name: "TPC" },
  { id: "INTERMARITIMA", name: "Intermarítima" },
  { id: "CLIA_EMP", name: "CLIA Empório" },
  { id: "RECOM", name: "Recom" },
  { id: "CTS_MEDLOG", name: "CTS / Med-Log" },
  { id: "TRANSPARANA", name: "Transparaná" },
  { id: "TEGMA", name: "Tegma" },
];

export const WAREHOUSE_CARRIERS: Carrier[] = [
  { id: "TECON", name: "TECON" },
  { id: "INTERMARITIMA", name: "Intermarítima" },
  { id: "TPC", name: "TPC" },
  { id: "CLIA_EMP", name: "CLIA Empório" },
];

export const INITIAL_FREIGHT_ROUTES: RoutePrice[] = [
  {
    id: "TPC_FACTORY",
    description: "TPC → Factory",
    distanceKm: 29,
    prices: { TPC: 1140.16, RECOM: 1777, CTS_MEDLOG: 1890, TRANSPARANA: 1610, TEGMA: 1666.4 },
  },
  {
    id: "INTERMAR_FACTORY",
    description: "Intermarítima → Factory",
    distanceKm: 52,
    prices: { INTERMARITIMA: 1950, RECOM: 2237, CTS_MEDLOG: 1890, TRANSPARANA: 2530, TEGMA: 1756.1 },
  },
  {
    id: "CLIA_FACTORY",
    description: "CLIA Empório → Factory",
    distanceKm: 48,
    prices: { CLIA_EMP: 2004.6, RECOM: 2157, CTS_MEDLOG: 1890, TRANSPARANA: 2370, TEGMA: 1740.5 },
  },
  {
    id: "TECON_FACTORY",
    description: "TECON → Factory",
    distanceKm: 52,
    prices: { TPC: 1817.35, INTERMARITIMA: 1950, CLIA_EMP: 2004.6, RECOM: 2237, CTS_MEDLOG: 1890, TRANSPARANA: 2530, TEGMA: 1756.1 },
  },
];

export const INITIAL_RETURN_ROUTES: RoutePrice[] = [
  { id: "RET_B_W", description: "B/W → Terminal (Vazio)", distanceKm: 45, prices: {} },
  { id: "RET_FACTORY", description: "Factory → Terminal (Vazio)", distanceKm: 55, prices: {} },
];

export const INITIAL_WAREHOUSE_ROUTES: RoutePrice[] = [
  { id: "W_SCAN", description: "Scanning Fee", distanceKm: 0, prices: { TECON: 850, INTERMARITIMA: 920, TPC: 880, CLIA_EMP: 450 } },
  { id: "W_PRES", description: "Cargo Presence", distanceKm: 0, prices: { TECON: 120, INTERMARITIMA: 150, TPC: 130, CLIA_EMP: 110 } },
  { id: "W_TRANS", description: "Transfer to B/W", distanceKm: 0, prices: { TECON: 450, INTERMARITIMA: 0, TPC: 510, CLIA_EMP: 380 } },
  { id: "W_15D", description: "Total - 15 Days", distanceKm: 0, prices: { TECON: 3200, INTERMARITIMA: 3100, TPC: 3350, CLIA_EMP: 2800 } },
  { id: "W_30D", description: "Total - 30 Days", distanceKm: 0, prices: { TECON: 5800, INTERMARITIMA: 5400, TPC: 5950, CLIA_EMP: 4900 } },
];

export const INITIAL_PROVISION: ProvisionSettings = {
  transportQty: {},
  warehouseLeadTime: 10,
  warehouseQty: 10,
  selectedWarehouseId: "TECON",
};

export const INITIAL_STATE: DashboardState = {
  routes: INITIAL_FREIGHT_ROUTES,
  returnRoutes: INITIAL_RETURN_ROUTES,
  warehouseRoutes: INITIAL_WAREHOUSE_ROUTES,
  inct: { inctLotacao: 3.01, inctFracionado: 4.19, alertaAcimaPct: 10 },
  justifications: {},
  activeTab: "freight",
  containerQuantity: 1,
  provision: INITIAL_PROVISION,
};

export const WAREHOUSE_CONTRACTS: WarehouseContract[] = [
  {
    id: "TECON",
    name: "TECON",
    periodDays: 7,
    minRates: [580.86, 813.20, 1262.63],
    storagePct: [0.0020, 0.0020, 0.0020],
    grisPct: 0.0009,
    removalFee: 0,
    adValoremPct: 0.0000,
    handlingFee: 0,
    presenceFee: 294.00,
    scanningFee: 332.48,
    insurancePct: 0.0009,
  },
  {
    id: "TPC",
    name: "TPC",
    periodDays: 30,
    minRates: [1342.55, 1435.07, 1435.07],
    storagePct: [0.0015, 0.0015, 0.0015],
    grisPct: 0.0010,
    removalFee: 924.67,
    adValoremPct: 0.0005,
    handlingFee: 211.16,
    presenceFee: 27.65,
    scanningFee: 425.26,
    insurancePct: 0.0010,
  },
  {
    id: "INTERMARITIMA",
    name: "INTERMARÍTIMA",
    periodDays: 10,
    minRates: [600, 600, 600],
    storagePct: [0.0015, 0.0020, 0.0025],
    grisPct: 0.0000,
    removalFee: 225.00,
    adValoremPct: 0.0000,
    handlingFee: 400.00,
    presenceFee: 220.00,
    scanningFee: 400.00,
    insurancePct: 0.0000,
  },
  {
    id: "CLIA_EMP",
    name: "CLIA EMPÓRIO",
    periodDays: 15,
    minRates: [575.00, 590.00, 590.00],
    storagePct: [0.0015, 0.0017, 0.0017],
    grisPct: 0.0005,
    removalFee: 706.83,
    adValoremPct: 0.0005,
    handlingFee: 90.00,
    presenceFee: 52.50,
    scanningFee: 443.30,
    insurancePct: 0.0005,
  },
];

export const LOCAL_STORAGE_KEY = "freight-dashboard-v3";