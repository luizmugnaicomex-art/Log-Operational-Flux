
import { WarehouseContract, Shipment } from "../types";
import { WAREHOUSE_CONTRACTS } from "../constants";

export const DEFAULT_CARGO_VALUE = 250000;

export const calculateWarehouseCost = (contract: WarehouseContract, value: number, daysIn: number, qty: number) => {
  const safeDays = Math.max(1, daysIn);
  const numPeriods = Math.ceil(safeDays / contract.periodDays);
  const getPeriodIndex = (p: number) => Math.min(p - 1, 2);

  let storageCost = 0;
  for (let p = 1; p <= numPeriods; p++) {
    const idx = getPeriodIndex(p);
    const minRate = contract.minRates[idx];
    const pct = contract.storagePct[idx];
    storageCost += Math.max(value * pct, minRate);
  }

  const gris = value * contract.grisPct;
  const adValorem = value * contract.adValoremPct;
  const removal = contract.removalFee;
  const handling = contract.handlingFee;
  const presence = contract.presenceFee;
  const scanning = contract.scanningFee;

  const total = (storageCost + gris + removal + adValorem + handling + presence + scanning) * qty;

  return {
    storage: storageCost * qty,
    gris: gris * qty,
    removal: removal * qty,
    adValorem: adValorem * qty,
    handling: handling * qty,
    presence: presence * qty,
    scanning: scanning * qty,
    total
  };
};

export const getContractForWarehouse = (warehouseName: string): WarehouseContract => {
  const bwUpper = (warehouseName || "").toUpperCase();
  let contractId = "TECON";
  if (bwUpper.includes("INTERMAR")) contractId = "INTERMARITIMA";
  else if (bwUpper.includes("TPC")) contractId = "TPC";
  else if (bwUpper.includes("CLIA") || bwUpper.includes("EMP")) contractId = "CLIA_EMP";

  return WAREHOUSE_CONTRACTS.find(c => c.id === contractId) || WAREHOUSE_CONTRACTS[0];
};

export const estimateFinancialExposure = (shipments: Shipment[], projectedDaysMap: Record<string, number>) => {
  return shipments.reduce((acc, s) => {
    const projectedDays = projectedDaysMap[s.containerNumber] || 0;
    if (projectedDays <= 0) return acc;

    const contract = getContractForWarehouse(s.bondedWarehouse);
    const cost = calculateWarehouseCost(contract, DEFAULT_CARGO_VALUE, projectedDays, 1);
    return acc + cost.total;
  }, 0);
};
