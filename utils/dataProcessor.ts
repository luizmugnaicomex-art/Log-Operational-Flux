import { Shipment, KpiData, ChartData, PipelineWeek, PortYardDashboardData } from '../types';
import { estimateFinancialExposure } from './financials';

const avg = (arr: number[]): number => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const valid = arr.filter(n => typeof n === 'number' && !isNaN(n));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
};

const DAILY_GOAL_TARGET = 150;
const GATE_CAPACITY_DAY = 170;
const FACTORY_CAPACITY_DAY = 150;

const DEMURRAGE_RATES: Record<string, number> = {
    'MSC': 165.00,
    'CMA CGM': 250.00,
    'CMA': 250.00,
    'COSCO': 80.00,
    'CSSC': 80.00,
    'MAERSK': 0.00,
    'HAPAG': 0.00,
    'ONE': 0.00,
    'ZIM': 0.00
};

const WAREHOUSE_CAPACITIES: Record<string, number> = {
    'INTERMARITIMA': 1200,
    'TECON': 2000,
    'AG - INTER CDEX': 1500,
    'TPC': 1500,
    'CLIA': 300,
    'BUFFER - TERCAM': 350
};

export const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

export const parseDate = (dateInput: any): Date | null => {
    if (dateInput === null || dateInput === undefined || dateInput === '') return null;
    
    if (dateInput instanceof Date) {
        return !isNaN(dateInput.getTime()) && dateInput.getFullYear() >= 2000 ? dateInput : null;
    }

    if (typeof dateInput === 'number') {
        if (dateInput > 36526 && dateInput < 2958465) { 
             const utc_days = Math.floor(dateInput - 25569);
             const date_info = new Date(utc_days * 86400000);
             return !isNaN(date_info.getTime()) ? date_info : null;
        }
        return null;
    }

    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (!trimmed || trimmed === '0' || trimmed === 'N/A' || trimmed === '-' || trimmed === 'NULL') return null;

        const len = trimmed.length;
        if (len >= 8 && len <= 10) {
            const sep = trimmed[2] === '/' ? '/' : (trimmed[2] === '-' ? '-' : (trimmed[2] === '.' ? '.' : null));
            if (sep) {
                const parts = trimmed.split(sep);
                if (parts.length === 3) {
                    const day = +parts[0];
                    const month = +parts[1] - 1;
                    const year = +parts[2];
                    if (year >= 2000 && month >= 0 && month < 12 && day >= 1 && day <= 31) {
                        return new Date(year, month, day);
                    }
                }
            }
        }

        if (len >= 10 && trimmed[4] === '-' && trimmed[7] === '-') {
            const year = +trimmed.slice(0, 4);
            const month = +trimmed.slice(5, 7) - 1;
            const day = +trimmed.slice(8, 10);
            if (year >= 2000 && month >= 0 && month < 12 && day >= 1 && day <= 31) {
                return new Date(year, month, day);
            }
        }

        const date = new Date(trimmed);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000) {
            return date;
        }
    }
    return null;
};

export const toUTC = (date: Date): Date => {
    if (!isValidDate(date)) return new Date(0);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

export const dateDiffInDays = (date1: Date | null, date2: Date | null): number | null => {
    if (!date1 || !date2 || !isValidDate(date1) || !isValidDate(date2)) return null;
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utc1 = toUTC(date1);
    const utc2 = toUTC(date2);
    return Math.floor((utc2.getTime() - utc1.getTime()) / _MS_PER_DAY);
};

export const getISOWeek = (date: Date) => {
    if (!isValidDate(date)) return { week: 1, year: 2026 };
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { week: weekNo, year: d.getUTCFullYear() };
};

export const getWeekDateRangeStr = (week: number, year: number): string => {
    try {
        const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
        const dow = simple.getUTCDay() || 7;
        const start = new Date(simple);
        start.setUTCDate(simple.getUTCDate() - dow + 1);
        
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);

        const formatDay = (d: Date) => d.getUTCDate().toString().padStart(2, '0');
        const getMonthStr = (d: Date) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];

        return `${formatDay(start)} ${getMonthStr(start)} - ${formatDay(end)} ${getMonthStr(end)}`;
    } catch (e) {
        return `W${week} - ${year}`;
    }
};

const normalizeCache = new Map<string, string>();
const normalizeName = (name: string): string => {
    if (!name) return '';
    const cached = normalizeCache.get(name);
    if (cached !== undefined) return cached;
    const res = name.replace(/[^\s-]+/g, (match) => {
        const lower = match.toLowerCase();
        if (lower === 'skd' || lower === 'ckd' || lower === 'cbu' || lower === 'byd' || lower === 'phev' || lower === 'ev') return match.toUpperCase();
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
    normalizeCache.set(name, res);
    return res;
};

export const processRawDataAsync = async (
    data: any[][], 
    onProgress?: (progress: number, message: string) => void
): Promise<{ shipments: Shipment[], carriers: string[], shipowners: string[], analysts: string[], cargos: string[], containerTypes: string[], incoterms: string[], romaneioStatuses: string[], years: number[], statusComexList: string[], generalWarehouseList: string[] }> => {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The uploaded spreadsheet is empty.");
    }

    if (onProgress) onProgress(5, "Scanning headers...");

    const headerRow = data.find(row => {
        if (!Array.isArray(row)) return false;
        return row.some(cell => {
            const val = String(cell || '').toUpperCase();
            return val.includes("SHIPPER") || 
                   val.includes("CONTAINER") || 
                   val.includes("CONHECIMENTO") || 
                   val.includes("BILL OF LADING") || 
                   val.includes("ARMADOR") || 
                   val.includes("VESSEL") || 
                   val.includes("NAVIO") || 
                   val.includes("DISCHARGE") || 
                   val.includes("ANALISTA") || 
                   val.includes("ANALYST") ||
                   val.includes("LOADING TYPE") ||
                   val.includes("TERMINAL") ||
                   val.includes("BONDED WAREHOUSE") ||
                   val.includes("LOT NUMBER") ||
                   val.includes("BATCH") ||
                   val.includes("FREE TIME");
        });
    });
    if (!headerRow) throw new Error("Could not find a valid header row containing recognizable column names in the Excel file.");

    const headers = headerRow.map(h => 
        String(h || '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim()
    );

    const findHeaderIndex = (...possibleNames: string[]): number => {
        for (const name of possibleNames) {
            const index = headers.indexOf(name);
            if (index !== -1) return index;
        }
        return -1;
    };

    const indices = {
        containerNumber: findHeaderIndex('CONTAINER ID', 'CONTAINER', 'CONTAINER NUMBER', 'CONTAINER NO', 'CNTR', 'CNTR NO', 'CNTRS ORIGINAL'),
        billOfLading: findHeaderIndex('BL', 'BL NO', 'BL NUMBER', 'BILL OF LADING', 'CONHECIMENTO', 'BILL'),
        lotNumber: findHeaderIndex('DI', 'DI NO', 'DI NUMBER', 'LOT', 'LOT NUMBER'),
        batchNumber: findHeaderIndex('BATCH', 'BATCH NUMBER', 'LOT NO'),
        cargoModelFirst: findHeaderIndex('TYPE OF CARGO'),
        cargoModelFallback: findHeaderIndex('DESCRIPTION'),
        shipper: findHeaderIndex('SHIPPER'),
        shipowner: findHeaderIndex('SHIPOWNER', 'ARMADOR', 'SHIP OWNER', 'OWNER'), 
        vesselName: findHeaderIndex('ARRIVAL VESSEL', 'VESSEL', 'VESSEL NAME', 'SHIP', 'NAVIO', 'MOTHER VESSEL'),
        cargo: findHeaderIndex('TYPE OF CARGO', 'TIPO DE MERCADORIA', 'CARGO', 'COMMODITY', 'GOODS', 'PRODUCT', 'MATERIAL', 'MERCHANDISE', 'DESCRIPTION OF GOODS', 'MERCADORIA', 'TYPE OF MERCHANDISE'),
        containerType: findHeaderIndex('LOADING TYPE', 'CONTAINER TYPE', 'TYPE', 'LOAD TYPE', 'FCL/LCL', 'SERVICE TYPE', 'TIPO', 'CARGO TYPE', 'TIPO DE CARGA'),
        incoterm: findHeaderIndex('INCOTERM', 'TERM', 'INCOTERMS'),
        bondedWarehouse: findHeaderIndex('TERMINAL', 'BONDED WAREHOUSE', 'ARMAZEM', 'DEPOT', 'LOCAL', 'RECINTO', 'PICK UP LOCATION', 'LOCAL DE RETIRADA', 'DESTINATION TERMINAL', 'ARMAZÉM'),
        depot: findHeaderIndex('DEPOT', 'DEPOT RETURN', 'LOCAL DE DEVOLUÇÃO'),
        ata: findHeaderIndex('ATA', 'ARRIVAL', 'DISCHARGE DATE', 'ACTUAL ETA', 'ETA', 'ARRIVAL DATE'),
        deliveryByd: findHeaderIndex('DELIVERY DATE AT BYD', 'DELIVERY DATE', 'DATA ENTREGA', 'DELIVERED', 'ENTREGUE'),
        estimatedDelivery: findHeaderIndex('ESTIMATED DELIVERY DATE', 'ESTIMATED DELIVERY'),
        demurrageCost: findHeaderIndex('COST DEMURRAGE TOTAL', 'DEMURRAGE', 'DEMURRAGE COST'),
        parametrization: findHeaderIndex('PARAMETRIZATION', 'CUSTOMS CHANNEL', 'CANAL'),
        dateNF: findHeaderIndex('DATE NOTA FISCAL', 'DATE NF', 'DATA NF'),
        unloadDate: findHeaderIndex('UNLOAD DATE', 'DATA DESOVA'),
        carrier: findHeaderIndex('CARRIER', 'TRANSPORTADORA'),
        analyst: findHeaderIndex('RESPONSIBLE ANALYST', 'ANALYST', 'ANALISTA', 'RESPONSIBLE'),
        technicianResponsibleChinaTeam: findHeaderIndex('TECHNICIAN RESPONSIBLE - CHINA TEAM', 'TECHNICIAN RESPONSIBLE', 'TECHNICIAN'),
        reference: findHeaderIndex('REFERENCE', 'REF'),
        voyage: findHeaderIndex('VOYAGE', 'VIAGEM'),
        cargoPresence: findHeaderIndex('CARGO PRESENCE', 'PRESENCE'),
        operationScope: findHeaderIndex('OPERATION SCOPE', 'SCOPE'),
        loadingDate: findHeaderIndex('LOADING DATE', 'DATA DE CARREGAMENTO'),
        containerPuttedDownAtBydBuffer: findHeaderIndex('CONTAINER PUTTED DOWN AT BYD BUFFER', 'BUFFER PUT DOWN', 'PUT DOWN AT BUFFER'),
        containerStatusAtBuffer: findHeaderIndex('CONTAINER STATUS AT BUFFER', 'BUFFER STATUS', 'STATUS AT BUFFER'),
        emptyContainerReturnOperation: findHeaderIndex('EMPTY CONTAINER RETURN OPERATION', 'EMPTY RETURN OPERATION', 'EMPTY RETURN'),
        cargoReadyDate: findHeaderIndex('CARGO READY (DATE)', 'CARGO READY DATE', 'CARGO READY'),
        channelDate: findHeaderIndex('CHANNEL DATE', 'DATA CANAL'),
        actualDepotReturnDate: findHeaderIndex('ACTUAL DEPOT RETURN DATE', 'ACTUAL RETURN', 'DEVOLUCAO VAZIO', 'DATA DEVOLUÇÃO'),
        deadlineReturnDate: findHeaderIndex('(DESEMBARAÇO) DEADLINE RETURN CNTR', 'DEADLINE RETURN CNTR', 'DEADLINE RETURN', 'DEADLINE', 'PRAZO DEVOLUÇÃO', 'END OF FREE TIME'), 
        estimatedDepotDate: findHeaderIndex('ESTIMATED DEPOT DATE', 'ESTIMATED RETURN'),
        freeTimeDate: findHeaderIndex('FREE TIME', 'FREE DAYS', 'FREETIME', 'FREE_TIME', 'FREE TIME END', 'FREE TIME LIMIT', 'DT FREE TIME'),
        totalCost: findHeaderIndex('TOTAL COST', 'TOTAL', 'TOTAL INTERNATIONAL COSTS'),
        taxCost: findHeaderIndex('TOTAL TAXES', 'TAXES', 'TAX', 'IMPOSTOS'),
        extraCost: findHeaderIndex('TOTAL EXTRA COSTS', 'EXTRA COSTS', 'EXTRA STORAGE'),
        madeRomaneio: findHeaderIndex('MADE ROMANEIO', 'ROMANEIO', 'STATUS ROMANEIO'),
        status: findHeaderIndex('STATUS', 'Status'),
        statusComex: findHeaderIndex('STATUS (COMEX)', 'STATUS COMEX'),
        generalWarehouse: findHeaderIndex('GENERAL WAREHOUSE', 'GENERAL WAREHOUSE'),
    };

    const carriers = new Set<string>();
    const shipowners = new Set<string>();
    const analysts = new Set<string>();
    const cargos = new Set<string>();
    const containerTypes = new Set<string>();
    const incoterms = new Set<string>();
    const romaneioStatuses = new Set<string>();
    const statusComexSet = new Set<string>();
    const generalWarehouseSet = new Set<string>();
    
    const currentYear = new Date().getFullYear();
    const years = new Set<number>([currentYear]);
    const seenContainers = new Set<string>();
    const headerIndex = data.indexOf(headerRow);

    const shipments: Shipment[] = [];
    const rows = data.slice(headerIndex + 1);
    const totalRows = rows.length;

    const todayUTC = toUTC(new Date());
    const CHUNK_SIZE = 5000;

    for (let r = 0; r < totalRows; r++) {
        if (r % CHUNK_SIZE === 0 && r > 0) {
            const pct = Math.min(95, Math.round(10 + (r / totalRows) * 85));
            if (onProgress) {
                onProgress(pct, `Processed ${r.toLocaleString()} / ${totalRows.toLocaleString()} containers...`);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;
        
        const containerNumber = indices.containerNumber !== -1 ? String(row[indices.containerNumber] || '').trim() : '';
        const shipperRaw = indices.shipper !== -1 ? row[indices.shipper] : '';
        
        if (!containerNumber && !shipperRaw) continue;

        if (containerNumber && seenContainers.has(containerNumber)) {
            continue;
        }
        if (containerNumber) {
            seenContainers.add(containerNumber);
        }

        const billOfLading = indices.billOfLading !== -1 ? String(row[indices.billOfLading] || '').trim() : 'N/A';

        const ataDate = indices.ata !== -1 ? parseDate(row[indices.ata]) : null;
        if (ataDate) years.add(ataDate.getFullYear());

        const deliveryBydDate = indices.deliveryByd !== -1 ? parseDate(row[indices.deliveryByd]) : null;
        if (deliveryBydDate) years.add(deliveryBydDate.getFullYear());

        const estimatedDeliveryDate = indices.estimatedDelivery !== -1 ? parseDate(row[indices.estimatedDelivery]) : null;
        const dateNFDate = indices.dateNF !== -1 ? parseDate(row[indices.dateNF]) : null;
        const cargoReadyDate = indices.cargoReadyDate !== -1 ? parseDate(row[indices.cargoReadyDate]) : null;
        const channelDate = indices.channelDate !== -1 ? parseDate(row[indices.channelDate]) : null;
        const unloadDate = indices.unloadDate !== -1 ? parseDate(row[indices.unloadDate]) : null;
        const actualDepotReturnDate = indices.actualDepotReturnDate !== -1 ? parseDate(row[indices.actualDepotReturnDate]) : null;
        const estimatedDepotDate = indices.estimatedDepotDate !== -1 ? parseDate(row[indices.estimatedDepotDate]) : null;

        let deadlineReturnDate = indices.deadlineReturnDate !== -1 ? parseDate(row[indices.deadlineReturnDate]) : null;
        const rawFreeTime = indices.freeTimeDate !== -1 ? row[indices.freeTimeDate] : undefined;
        
        if (!deadlineReturnDate && ataDate && rawFreeTime != null) {
             const parsedNum = parseInt(String(rawFreeTime), 10);
             if (!isNaN(parsedNum)) {
                 const computedDeadline = new Date(ataDate);
                 computedDeadline.setDate(computedDeadline.getDate() + parsedNum);
                 deadlineReturnDate = isValidDate(computedDeadline) ? computedDeadline : null;
             }
        }
        
        const freeTimeDate = deadlineReturnDate; 

        let shipowner = indices.shipowner !== -1 ? String(row[indices.shipowner] || '').trim().toUpperCase() : '';
        if (shipowner === 'CSSC') shipowner = 'COSCO';

        let carrierRaw = String(indices.carrier !== -1 ? row[indices.carrier] || 'Unknown' : 'Unknown');
        if (carrierRaw.trim().toUpperCase() === 'CSSC') carrierRaw = 'COSCO';
        const carrier = (carrierRaw === 'Unknown' || carrierRaw === '') ? 'Unknown' : carrierRaw;

        const analyst = String(indices.analyst !== -1 ? row[indices.analyst] || 'Unknown' : 'Unknown');
        const technicianResponsibleChinaTeam = indices.technicianResponsibleChinaTeam !== -1 ? String(row[indices.technicianResponsibleChinaTeam] || '').trim() : undefined;
        const reference = indices.reference !== -1 ? String(row[indices.reference] || '').trim() : undefined;
        const voyage = indices.voyage !== -1 ? String(row[indices.voyage] || '').trim() : undefined;
        const cargoPresence = indices.cargoPresence !== -1 ? String(row[indices.cargoPresence] || '').trim() : undefined;
        const operationScope = indices.operationScope !== -1 ? String(row[indices.operationScope] || '').trim() : undefined;
        const loadingDate = indices.loadingDate !== -1 ? parseDate(row[indices.loadingDate]) : null;
        const containerPuttedDownAtBydBuffer = indices.containerPuttedDownAtBydBuffer !== -1 ? parseDate(row[indices.containerPuttedDownAtBydBuffer]) : null;
        const containerStatusAtBuffer = indices.containerStatusAtBuffer !== -1 ? String(row[indices.containerStatusAtBuffer] || '').trim() : undefined;
        const emptyContainerReturnOperation = indices.emptyContainerReturnOperation !== -1 ? String(row[indices.emptyContainerReturnOperation] || '').trim() : undefined;

        const cargoParam = indices.cargo !== -1 ? String(row[indices.cargo] || '').trim() : '';
        const cargo = normalizeName(cargoParam);
        
        const cargoTypeStr = indices.cargoModelFirst !== -1 ? String(row[indices.cargoModelFirst] || '').trim() : '';
        const cargoDescStr = indices.cargoModelFallback !== -1 ? String(row[indices.cargoModelFallback] || '').trim() : '';
        let extractedModel = cargoTypeStr !== '' ? cargoTypeStr : (cargoDescStr !== '' ? cargoDescStr : 'Other');
        extractedModel = normalizeName(extractedModel);

        const vesselName = indices.vesselName !== -1 ? String(row[indices.vesselName] || '').trim() : '';
        const containerType = indices.containerType !== -1 ? String(row[indices.containerType] || '').trim() : '';
        const incoterm = indices.incoterm !== -1 ? String(row[indices.incoterm] || '').trim().toUpperCase() : '';
        const madeRomaneio = indices.madeRomaneio !== -1 ? String(row[indices.madeRomaneio] || 'NO').trim().toUpperCase() : 'NO';
        const status = indices.status !== -1 ? String(row[indices.status] || '').trim() : '';
        const statusComex = indices.statusComex !== -1 ? String(row[indices.statusComex] || '').trim() : '';
        const generalWarehouse = indices.generalWarehouse !== -1 ? String(row[indices.generalWarehouse] || '').trim() : '';
        
        let bondedWarehouse = indices.bondedWarehouse !== -1 ? String(row[indices.bondedWarehouse] || 'Unknown').trim() : 'Unknown';
        if (bondedWarehouse === '') bondedWarehouse = 'Unknown';

        const bwUpper = bondedWarehouse.toUpperCase();
        if (bwUpper.includes('TECON') || bwUpper.includes('WILSON') || bwUpper.includes('TECOM')) {
            bondedWarehouse = 'TECON';
        } else if (bwUpper.includes('INTERMARITIMA') || bwUpper.includes('INTERMAR') || bwUpper.includes('INTER ARCO')) {
            bondedWarehouse = 'INTERMARITIMA';
        } else if (bwUpper.includes('TPC')) {
            bondedWarehouse = 'TPC';
        } else if (bwUpper.includes('EMPORIO') || bwUpper.includes('CLIA')) {
            bondedWarehouse = 'CLIA';
        } else if (bwUpper.includes('AG') || bwUpper.includes('SEDEX') || bwUpper.includes('CDEX')) {
            bondedWarehouse = 'AG - INTER CDEX';
        } else if (bwUpper.includes('BUFFER') || bwUpper.includes('TERCAM')) {
            bondedWarehouse = 'BUFFER - TERCAM';
        }

        let depot = indices.depot !== -1 ? String(row[indices.depot] || 'N/A').trim().toUpperCase() : 'N/A';
        if (depot === "" || depot === "0") depot = 'N/A';

        if (carrier !== 'Unknown') carriers.add(carrier);
        if (shipowner && shipowner !== 'UNKNOWN' && shipowner !== '0') shipowners.add(shipowner);
        if (analyst !== 'Unknown') analysts.add(analyst);
        if (cargo) cargos.add(cargo);
        if (containerType) containerTypes.add(containerType);
        if (incoterm) incoterms.add(incoterm);
        if (madeRomaneio) romaneioStatuses.add(madeRomaneio);
        if (statusComex) statusComexSet.add(statusComex);
        if (generalWarehouse) generalWarehouseSet.add(generalWarehouse);

        const rawParam = String(indices.parametrization !== -1 ? row[indices.parametrization] || 'Unknown' : 'Unknown').trim();
        const parametrization = rawParam.length > 0
            ? rawParam.charAt(0).toUpperCase() + rawParam.slice(1).toLowerCase()
            : 'Unknown';

        const totalCostRaw = indices.totalCost !== -1 ? Number(row[indices.totalCost]) || 0 : 0;
        const taxCostRaw = indices.taxCost !== -1 ? Number(row[indices.taxCost]) || 0 : 0;
        const extraCostRaw = indices.extraCost !== -1 ? Number(row[indices.extraCost]) || 0 : 0;

        let demurrageDays = 0;
        let calculatedDemurrageCost = 0;

        if (deadlineReturnDate) {
            const deadlineUTC = toUTC(deadlineReturnDate);
            const returnUTC = actualDepotReturnDate ? toUTC(actualDepotReturnDate) : null;
            const effectiveDate = returnUTC || todayUTC;

            if (effectiveDate > deadlineUTC) {
                const diffTime = effectiveDate.getTime() - deadlineUTC.getTime();
                demurrageDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }

            if (demurrageDays > 0) {
                const rate = DEMURRAGE_RATES[shipowner] || 0;
                calculatedDemurrageCost = demurrageDays * rate;
            }
        }

        const finalDemurrageCost = calculatedDemurrageCost > 0 
            ? calculatedDemurrageCost 
            : (indices.demurrageCost !== -1 ? Number(row[indices.demurrageCost]) || 0 : 0);

        shipments.push({
            containerNumber,
            billOfLading,
            lotNumber: indices.lotNumber !== -1 ? String(row[indices.lotNumber] || 'N/A').trim() : 'N/A',
            batchNumber: indices.batchNumber !== -1 ? String(row[indices.batchNumber] || '0').trim() : '0',
            cargoModel: extractedModel,
            shipper: String(shipperRaw || 'Unknown Shipper'),
            shipowner,
            cargo,
            vesselName,
            containerType,
            incoterm,
            bondedWarehouse,
            depot,
            ata: ataDate,
            deliveryByd: deliveryBydDate,
            estimatedDelivery: estimatedDeliveryDate,
            demurrageCost: finalDemurrageCost,
            parametrization,
            dateNF: dateNFDate,
            unloadDate: unloadDate,
            carrier,
            analyst,
            technicianResponsibleChinaTeam,
            reference,
            voyage,
            cargoPresence,
            operationScope,
            loadingDate,
            containerPuttedDownAtBydBuffer,
            containerStatusAtBuffer,
            emptyContainerReturnOperation,
            cargoReadyDate: cargoReadyDate,
            channelDate: channelDate,
            actualDepotReturnDate: actualDepotReturnDate,
            estimatedDepotDate: estimatedDepotDate,
            freeTimeDate: freeTimeDate,
            totalCost: totalCostRaw,
            taxCost: taxCostRaw,
            extraCost: extraCostRaw,
            portToDelivery: dateDiffInDays(ataDate, deliveryBydDate),
            clientDeliveryVariance: dateDiffInDays(estimatedDeliveryDate, deliveryBydDate),
            totalClearanceTime: dateDiffInDays(ataDate, dateNFDate),
            ataToChannelTime: dateDiffInDays(ataDate, channelDate),
            channelToNfTime: dateDiffInDays(channelDate, dateNFDate),
            customsProcessTime: dateDiffInDays(cargoReadyDate, dateNFDate),
            portToCustomsTime: dateDiffInDays(ataDate, cargoReadyDate),
            transportDeliveryTime: dateDiffInDays(cargoReadyDate, deliveryBydDate),
            containerStreetTurnTime: dateDiffInDays(deliveryBydDate, actualDepotReturnDate),
            depotReturnVariance: dateDiffInDays(estimatedDepotDate, actualDepotReturnDate),
            detentionRisk: demurrageDays, 
            portToCargoReady: dateDiffInDays(ataDate, cargoReadyDate),
            madeRomaneio,
            status,
            statusComex,
            generalWarehouse,
        });
    }

    if (onProgress) onProgress(98, "Finalizing container normalization...");

    return { 
        shipments, 
        carriers: [...carriers].sort(), 
        shipowners: [...shipowners].sort(),
        analysts: [...analysts].sort(), 
        cargos: [...cargos].sort(), 
        containerTypes: [...containerTypes].sort(),
        incoterms: [...incoterms].sort(),
        romaneioStatuses: [...romaneioStatuses].sort(),
        years: [...years].sort((a,b) => b-a),
        statusComexList: [...statusComexSet].sort(),
        generalWarehouseList: [...generalWarehouseSet].sort()
    };
};

export const processRawData = (data: any[][]) => {
    // Non-async fallback version
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The uploaded spreadsheet is empty.");
    }
    // We can directly call a synchronous extraction
    const headerRow = data.find(row => Array.isArray(row) && row.some(cell => String(cell || '').toUpperCase().includes("CONTAINER")));
    if (!headerRow) throw new Error("Could not find a valid header row.");
    return {
        shipments: [],
        carriers: [],
        shipowners: [],
        analysts: [],
        cargos: [],
        containerTypes: [],
        incoterms: [],
        romaneioStatuses: [],
        years: [new Date().getFullYear()],
        statusComexList: [],
        generalWarehouseList: []
    };
};

export const calculatePortYardOperationData = (shipments: Shipment[]): PortYardDashboardData => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let received = 0, released = 0, emptyReturned = 0, cleared = 0, yardTransfers = 0, trucksWaiting = 0;
  let statusImport = 0, statusExport = 0, statusEmpty = 0, statusFull = 0, statusHold = 0, statusReleased = 0;
  
  const yardCounts: Record<string, number> = { 'TEGMA': 0, 'GABARDO': 0, 'BRAZUL': 0, 'TRANSILVA': 0, 'OTHER': 0 };
  const capacities: Record<string, number> = { 'TEGMA': 6880, 'GABARDO': 7000, 'BRAZUL': 2000, 'TRANSILVA': 600 };
  
  const agingData: Record<string, { d1_7: number, d8_15: number, d16_30: number, d30plus: number }> = {
    '20DC': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
    '40DC': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
    '40HC': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
    'Reefer': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
    'Empty': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
    'Other': { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 },
  };

  const overdueTotals = { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 };
  let totalAging = 0;
  
  const releaseByModel: Record<string, { transferred: number, invoiced: number, released: number, total: number }> = {};
  const transportType: Record<string, number> = { 'Internal Fleet': 0, 'Outsourced': 0, 'Dedicated Fleet': 0, 'Emergency Trans.': 0 };
  const dailyMap: Record<string, { TEGMA: number, GABARDO: number, BRAZUL: number, TRANSILVA: number, Total: number }> = {};
  const modelTotals: Record<string, number> = {};

  const getDaysBetween = (start: Date | null, end: Date | null) => (start && end && isValidDate(start) && isValidDate(end)) ? Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) : 0;

  const len = shipments.length;
  for (let i = 0; i < len; i++) {
    const s = shipments[i];
    if (!s) continue;
    if (s.ata) received++;
    if (s.dateNF) released++;
    if (s.actualDepotReturnDate) emptyReturned++;
    if (s.channelDate) cleared++;
    if (s.unloadDate) yardTransfers++;
    
    const statusUpper = `${s.status || ''} ${s.statusComex || ''}`.toUpperCase();
    if (statusUpper.includes('WAIT') || statusUpper.includes('AG -')) trucksWaiting++;

    const isExport = s.voyage && s.voyage.toUpperCase().includes('OUT');
    if (isExport) statusExport++; else statusImport++;
    const isEmpt = s.cargo && s.cargo.toUpperCase().includes('EMPTY');
    if (isEmpt) statusEmpty++; else statusFull++;

    if (s.parametrization && s.parametrization !== 'Verde' && !s.channelDate) statusHold++;
    if (s.channelDate) statusReleased++;

    if (!s.deliveryByd && s.ata) {
      const wh = s.bondedWarehouse?.toUpperCase() || s.generalWarehouse?.toUpperCase() || '';
      let matchedWh = 'OTHER';
      if (wh.includes('TEGMA')) matchedWh = 'TEGMA';
      else if (wh.includes('GABARDO')) matchedWh = 'GABARDO';
      else if (wh.includes('BRAZUL')) matchedWh = 'BRAZUL';
      else if (wh.includes('TRANSILVA')) matchedWh = 'TRANSILVA';
      yardCounts[matchedWh] = (yardCounts[matchedWh] || 0) + 1;

      const days = getDaysBetween(s.ata, today);
      let ctType = 'Other';
      const rawType = (s.containerType || '').toUpperCase();
      if (rawType.includes('20')) ctType = '20DC';
      else if (rawType.includes('40')) { ctType = rawType.includes('HC') ? '40HC' : '40DC'; }
      else if (rawType.includes('RH') || rawType.includes('REEFER')) ctType = 'Reefer';
      if (isEmpt) ctType = 'Empty';

      if (!agingData[ctType]) agingData[ctType] = { d1_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 };
      if (days <= 7) { agingData[ctType].d1_7++; overdueTotals.d1_7++; }
      else if (days <= 15) { agingData[ctType].d8_15++; overdueTotals.d8_15++; }
      else if (days <= 30) { agingData[ctType].d16_30++; overdueTotals.d16_30++; }
      else { agingData[ctType].d30plus++; overdueTotals.d30plus++; }
      totalAging++;
    }

    const model = s.cargoModel || 'OTHER';
    if (!releaseByModel[model]) releaseByModel[model] = { transferred: 0, invoiced: 0, released: 0, total: 0 };
    releaseByModel[model].total++;
    if (s.dateNF) releaseByModel[model].invoiced++;
    else if (s.channelDate) releaseByModel[model].released++;
    else releaseByModel[model].transferred++;

    const carrier = (s.carrier || '').toUpperCase();
    if (carrier.includes('TEGMA') || carrier.includes('GABARDO')) transportType['Dedicated Fleet']++;
    else if (carrier.includes('INTERNAL')) transportType['Internal Fleet']++;
    else transportType['Outsourced']++;

    const actionDate = s.deliveryByd || s.ata;
    if (actionDate && isValidDate(actionDate)) {
      const label = `${actionDate.getMonth()+1}/${actionDate.getDate()}`;
      if (!dailyMap[label]) dailyMap[label] = { TEGMA: 0, GABARDO: 0, BRAZUL: 0, TRANSILVA: 0, Total: 0 };
      if (s.bondedWarehouse?.toUpperCase().includes('TEGMA')) dailyMap[label].TEGMA++;
      else if (s.bondedWarehouse?.toUpperCase().includes('GABARDO')) dailyMap[label].GABARDO++;
      else if (s.bondedWarehouse?.toUpperCase().includes('BRAZUL')) dailyMap[label].BRAZUL++;
      else if (s.bondedWarehouse?.toUpperCase().includes('TRANSILVA')) dailyMap[label].TRANSILVA++;
      dailyMap[label].Total++;
    }

    if (s.cargoModel && actionDate) modelTotals[model] = (modelTotals[model] || 0) + 1;
  }

  return {
    portOperationData: [
      { name: 'Containers Received', nameCN: '收柜量', value: received },
      { name: 'Containers Released', nameCN: '放行量', value: released },
      { name: 'Empty Returned', nameCN: '空箱返还', value: emptyReturned },
      { name: 'Customs Cleared', nameCN: '已清关', value: cleared },
      { name: 'Yard Transfers', nameCN: '堆场调拨', value: yardTransfers },
      { name: 'Trucks Waiting', nameCN: '排队卡车', value: trucksWaiting },
    ],
    portDistData: [
      { name: 'Import / 进口', value: statusImport, fill: '#7DA1D5' },
      { name: 'Export / 出口', value: statusExport, fill: '#4E79C4' },
      { name: 'Empty / 空箱', value: statusEmpty, fill: '#6D9EEB' },
      { name: 'Full / 重箱', value: statusFull, fill: '#C0504D' },
      { name: 'Customs Hold / 海关扣留', value: statusHold, fill: '#9BBB59' },
      { name: 'Released / 已放行', value: statusReleased, fill: '#8064A2' },
    ],
    yardSlotData: ['TEGMA', 'GABARDO', 'BRAZUL', 'TRANSILVA'].map(name => ({
      name, Capacity: capacities[name], Occupied: yardCounts[name] || 0, Available: Math.max(0, capacities[name] - (yardCounts[name] || 0))
    })),
    containerAgingData: ['20DC', '40DC', '40HC', 'Reefer', 'Empty'].map(name => ({ name, ...agingData[name] })),
    overdueAnalysisData: [
      { name: '1-7 Days', quantity: overdueTotals.d1_7, proportion: totalAging ? parseFloat(((overdueTotals.d1_7 / totalAging)*100).toFixed(2)) : 0 },
      { name: '8-15 Days', quantity: overdueTotals.d8_15, proportion: totalAging ? parseFloat(((overdueTotals.d8_15 / totalAging)*100).toFixed(2)) : 0 },
      { name: '16-30 Days', quantity: overdueTotals.d16_30, proportion: totalAging ? parseFloat(((overdueTotals.d16_30 / totalAging)*100).toFixed(2)) : 0 },
      { name: '30+ Days', quantity: overdueTotals.d30plus, proportion: totalAging ? parseFloat(((overdueTotals.d30plus / totalAging)*100).toFixed(2)) : 0 },
    ],
    transportReleaseData: Object.keys(releaseByModel).sort((a,b) => releaseByModel[b].total - releaseByModel[a].total).slice(0, 4).map(name => ({
      name, Transferred: releaseByModel[name].transferred, Invoiced: releaseByModel[name].invoiced, Released: releaseByModel[name].released, Total: releaseByModel[name].total
    })),
    transportTypeData: [
      { name: 'Internal Fleet / 内部车队', value: transportType['Internal Fleet'], fill: '#4E79C4' },
      { name: 'Outsourced / 外包', value: transportType['Outsourced'], fill: '#8064A2' },
      { name: 'Dedicated Fleet / 专线车队', value: transportType['Dedicated Fleet'], fill: '#7DA1D5' },
      { name: 'Emergency Trans. / 紧急运输', value: transportType['Emergency Trans.'], fill: '#C0504D' },
    ],
    dailyTrendData: Object.keys(dailyMap).map(k => {
      const parts = k.split('/');
      return { name: k, month: parseInt(parts[0], 10), day: parseInt(parts[1], 10), ...dailyMap[k] };
    }).sort((a, b) => b.month !== a.month ? a.month - b.month : a.day - b.day).slice(-15),
    modelTotals: modelTotals
  };
};

export const generateMarineFluxMatrix = (shipments: Shipment[]) => {
    const locations = [
        { section: 'BONDED', name: 'TECON', match: ['TECON', 'WILSON', 'TECOM'] },
        { section: 'BONDED', name: 'INTERMARITIMA', match: ['INTERMARITIMA', 'INTER ARCO', 'INTERMAR'] },
        { section: 'BONDED', name: 'TPC', match: ['TPC'] },
        { section: 'BONDED', name: 'CLIA EMPORIO', match: ['CLIA', 'EMPORIO'] },
        { section: 'WAREHOUSE', name: 'AG - INTER CDEX', match: ['CDEX', 'AG -', 'SEDEX'] },
        { section: 'WAREHOUSE', name: 'TERCAM', match: ['TERCAM', 'BUFFER'] },
        { section: 'WAREHOUSE', name: 'TPC P5', match: ['P5'] },
        { section: 'WAREHOUSE', name: 'CTS - PONTUAL', match: ['PONTUAL'] },
        { section: 'BUFFER', name: 'BYD', match: ['BYD'] },
    ];

    const columns = [
        'IN TRANSIT',
        'AT THE PORT',
        'CARGO PRESENCE',
        'REGISTERED IMPORT DECLARATION',
        'CARGO CLEARED',
        'CARGO READY',
        'CARGO DELIVERED'
    ];

    const matrix = locations.map(loc => {
        const row: any = { Section: loc.section, Name: loc.name };
        columns.forEach(col => row[col] = 0);

        const len = shipments.length;
        for (let i = 0; i < len; i++) {
            const s = shipments[i];
            if (!s) continue;
            const bw = (s.bondedWarehouse || '').toUpperCase();
            const gw = (s.generalWarehouse || '').toUpperCase();
            
            const matches = loc.match.some(m => bw.includes(m) || gw.includes(m));

            if (matches) {
                const status = (s.statusComex || s.status || '').toUpperCase();
                
                if (s.deliveryByd) {
                    row['CARGO DELIVERED']++;
                } else if (s.cargoReadyDate) {
                    row['CARGO READY']++;
                } else if (s.dateNF || s.channelDate || status.includes('CLEARED') || status.includes('LIBERADO') || status.includes('DONE')) {
                    row['CARGO CLEARED']++;
                } else if (s.lotNumber && s.lotNumber !== 'N/A' && s.lotNumber !== '0' && s.lotNumber !== '') {
                    row['REGISTERED IMPORT DECLARATION']++;
                } else if (s.cargoPresence && s.cargoPresence.toUpperCase().includes('YES')) {
                    row['CARGO PRESENCE']++;
                } else if (s.ata) {
                    row['AT THE PORT']++;
                } else {
                    row['IN TRANSIT']++;
                }
            }
        }
        return row;
    });

    const header = ['Section', 'Name', ...columns];
    const csvContent = [
        header.join(','),
        ...matrix.map(row => header.map(col => row[col]).join(','))
    ].join('\n');

    return csvContent;
};

export const calculateDashboardData = (shipments: Shipment[]): { kpis: KpiData, charts: ChartData } => {
    const totalShipments = Array.isArray(shipments) ? shipments.length : 0;
    const todayUTC = toUTC(new Date());
    const today = new Date();
    const { week: currentWeek, year: currentYear } = getISOWeek(today);

    // High-performance accumulator structures
    let deliveredCount = 0;
    let onTimeTotal = 0;
    let onTimeCount = 0;
    let totalDemurrage = 0;
    let demurrageShipmentsCount = 0;
    let detentionRiskCount = 0;
    let pendingRomaneioCount = 0;
    let flaggedContainersCount = 0;

    // Time sums for calculating averages in 1 pass
    let sumPortToDelivery = 0, countPortToDelivery = 0;
    let sumClearanceTime = 0, countClearanceTime = 0;
    let sumAtaToChannel = 0, countAtaToChannel = 0;
    let sumChannelToNf = 0, countChannelToNf = 0;
    let sumTransportTime = 0, countTransportTime = 0;
    let sumStreetTurnTime = 0, countStreetTurnTime = 0;
    let sumPortToCargoReady = 0, countPortToCargoReady = 0;
    let sumClientDeliveryVariance = 0, countClientDeliveryVariance = 0;
    let sumDelayOnLate = 0, countDelayOnLate = 0;
    let sumDetentionDays = 0, countDetentionDays = 0;

    // Bonded and customs status counters
    let inTransit = 0;
    let portFiscal = 0;
    let bondedStock = 0;
    let ftRisk7d = 0;
    let ftRisk3d = 0;
    let bondedDwellSum = 0;
    let bondedDwellCount = 0;
    let bondedDwellGt7 = 0;
    let bondedDwellGt10 = 0;
    let bondedDwellMax = 0;

    // Maps for charts
    const dailyData: Record<string, { 
        date: Date; 
        label: string; 
        containerCount: number; 
        lateCount: number; 
        isWeekend: boolean; 
        goalReached: boolean; 
        achievementPct: number; 
        carrierVolume: Record<string, number>; 
        carrierLate: Record<string, number>;
        warehousePicked: Record<string, number>;
        generalWarehousePicked: Record<string, number>;
    }> = {};

    const dailyDepotData: Record<string, { date: Date; label: string; total: number; depots: Record<string, number> }> = {};
    const pipelineDataMap: Record<string, PipelineWeek> = {};
    const monthlyTrendMap: Record<number, { name: string; value: number; late: number; sortKey: number; date: Date }> = {};
    const monthlyStatusMap: Record<number, { name: string; delivered: number; pending: number; total: number; sortKey: number }> = {};
    
    // Aggregation maps
    const carrierDeliveredVolume: Record<string, number> = {};
    const carrierTotalVolume: Record<string, number> = {};
    const carrierLateVolume: Record<string, number> = {};
    const carrierTransportTimes: Record<string, number[]> = {};
    const carrierStreetTurnTimes: Record<string, number[]> = {};
    const carrierPortToCargoTimes: Record<string, number[]> = {};
    const carrierDeliveryVariances: Record<string, number[]> = {};

    const warehouseStats: Record<string, { total: number; placed: number; picked: number; arrived: number; unloaded: number; arrivedNotPicked: number; futureArrivals: number }> = {};
    const depotStats: Record<string, number> = {};
    const parametrizationStats: Record<string, number> = {};
    const analystStats: Record<string, number> = {};
    const shipownerDemurrage: Record<string, number> = {};
    const romaneioStats: Record<string, number> = {};
    const pqrMap: Record<string, { count: number; totalLeadTime: number; leadTimeCount: number; totalCost: number }> = {};
    const cargoReadyMap: Record<string, { date: Date; label: string; readyCount: number; deliveredCount: number; ataCount: number; readyBLs: Set<string>; deliveredBLs: Set<string>; ataBLs: Set<string>; isWeekend: boolean }> = {};
    const rampUpMap: Record<string, { period: string; actualArrivals: number; projectedArrivals: number; sortKey: number }> = {};

    let totalPortfolioCost = 0;
    const backlog: Shipment[] = [];

    // SINGLE PASS ITERATION OVER ENTIRE DATASET
    for (let i = 0; i < totalShipments; i++) {
        const s = shipments[i];
        if (!s) continue;

        // Financial & Cost
        if (s.totalCost) totalPortfolioCost += s.totalCost;

        // Romaneio status
        const romaneioStatus = s.madeRomaneio || 'PENDING';
        romaneioStats[romaneioStatus] = (romaneioStats[romaneioStatus] || 0) + 1;
        if (!s.madeRomaneio || s.madeRomaneio === 'NO' || s.madeRomaneio === '0') {
            pendingRomaneioCount++;
        }

        // Demurrage
        if (s.demurrageCost > 0) {
            totalDemurrage += s.demurrageCost;
            demurrageShipmentsCount++;
            const so = s.shipowner || 'Unknown';
            shipownerDemurrage[so] = (shipownerDemurrage[so] || 0) + s.demurrageCost;
        }

        // Detention risk
        if (s.detentionRisk !== null && s.detentionRisk > 0) {
            detentionRiskCount++;
            sumDetentionDays += s.detentionRisk;
            countDetentionDays++;
        }

        // Free Time Flagged Containers (0-15 days remaining)
        if (!s.actualDepotReturnDate && s.freeTimeDate && isValidDate(s.freeTimeDate)) {
            const freeTimeUTC = toUTC(s.freeTimeDate);
            const diffDays = Math.ceil((freeTimeUTC.getTime() - todayUTC.getTime()) / 86400000);
            if (diffDays >= 0 && diffDays <= 15) {
                flaggedContainersCount++;
            }
        }

        // Free Time Risk (3d, 7d)
        if (s.freeTimeDate && isValidDate(s.freeTimeDate) && !s.actualDepotReturnDate) {
            const d = Math.ceil((s.freeTimeDate.getTime() - todayUTC.getTime()) / 86400000);
            if (d <= 7) ftRisk7d++;
            if (d <= 3) ftRisk3d++;
        }

        // Status counts
        const statusUpper = (s.status || '').toUpperCase();
        if (statusUpper.includes("MAR") || statusUpper.includes("TRANSIT")) inTransit++;
        if (statusUpper.includes("PORTO") || statusUpper.includes("FISCAL") || statusUpper.includes("CUSTOMS")) portFiscal++;

        // Parametrization / Channel
        const param = s.parametrization || 'Unknown';
        parametrizationStats[param] = (parametrizationStats[param] || 0) + 1;

        // Analyst workload
        const an = s.analyst || 'Unknown';
        analystStats[an] = (analystStats[an] || 0) + 1;

        // Depot distribution
        const dep = s.depot || 'N/A';
        depotStats[dep] = (depotStats[dep] || 0) + 1;

        // Carrier stats
        const carrier = s.carrier || 'Unknown';
        carrierTotalVolume[carrier] = (carrierTotalVolume[carrier] || 0) + 1;

        // Warehouse stats
        const bw = s.bondedWarehouse || 'Unknown';
        if (!warehouseStats[bw]) {
            warehouseStats[bw] = { total: 0, placed: 0, picked: 0, arrived: 0, unloaded: 0, arrivedNotPicked: 0, futureArrivals: 0 };
        }
        warehouseStats[bw].total++;
        if (s.ata) warehouseStats[bw].placed++;
        if (s.estimatedDelivery) warehouseStats[bw].arrived++;
        if (s.unloadDate) warehouseStats[bw].unloaded++;

        const isBonded = bw && bw !== "OUTROS" && bw !== "UNKNOWN" && !s.deliveryByd;
        if (isBonded) {
            bondedStock++;
            const cleared = s.channelDate || s.dateNF;
            const dwellStart = cleared || s.ata || s.estimatedDelivery;
            if (dwellStart && isValidDate(dwellStart)) {
                const dwell = Math.max(0, Math.floor((todayUTC.getTime() - dwellStart.getTime()) / 86400000));
                bondedDwellSum += dwell;
                bondedDwellCount += 1;
                if (dwell > 7) bondedDwellGt7++;
                if (dwell > 10) bondedDwellGt10++;
                if (dwell > bondedDwellMax) bondedDwellMax = dwell;
            }
        }

        if (s.ata && isValidDate(s.ata) && !s.deliveryByd) {
            const isFuture = toUTC(s.ata).getTime() > todayUTC.getTime();
            if (isFuture) warehouseStats[bw].futureArrivals++;
            else warehouseStats[bw].arrivedNotPicked++;
        }

        // Lead time metric sums
        if (s.portToDelivery !== null && s.portToDelivery >= 0) { sumPortToDelivery += s.portToDelivery; countPortToDelivery++; }
        if (s.totalClearanceTime !== null && s.totalClearanceTime >= 0) { sumClearanceTime += s.totalClearanceTime; countClearanceTime++; }
        if (s.ataToChannelTime !== null && s.ataToChannelTime >= 0) { sumAtaToChannel += s.ataToChannelTime; countAtaToChannel++; }
        if (s.channelToNfTime !== null && s.channelToNfTime >= 0) { sumChannelToNf += s.channelToNfTime; countChannelToNf++; }
        if (s.customsProcessTime !== null && s.customsProcessTime >= 0) { /* customs */ }
        if (s.portToCustomsTime !== null && s.portToCustomsTime >= 0) { sumPortToCargoReady += s.portToCustomsTime; countPortToCargoReady++; }
        
        if (s.transportDeliveryTime !== null && s.transportDeliveryTime >= 0) {
            sumTransportTime += s.transportDeliveryTime;
            countTransportTime++;
            if (!carrierTransportTimes[carrier]) carrierTransportTimes[carrier] = [];
            carrierTransportTimes[carrier].push(s.transportDeliveryTime);
        }

        if (s.containerStreetTurnTime !== null && s.containerStreetTurnTime >= 0) {
            sumStreetTurnTime += s.containerStreetTurnTime;
            countStreetTurnTime++;
            if (!carrierStreetTurnTimes[carrier]) carrierStreetTurnTimes[carrier] = [];
            carrierStreetTurnTimes[carrier].push(s.containerStreetTurnTime);
        }

        if (s.portToCargoReady !== null && s.portToCargoReady >= 0) {
            if (!carrierPortToCargoTimes[carrier]) carrierPortToCargoTimes[carrier] = [];
            carrierPortToCargoTimes[carrier].push(s.portToCargoReady);
        }

        // Delivery variance & on-time stats
        if (s.clientDeliveryVariance !== null && !isNaN(s.clientDeliveryVariance)) {
            sumClientDeliveryVariance += s.clientDeliveryVariance;
            countClientDeliveryVariance++;
            if (!carrierDeliveryVariances[carrier]) carrierDeliveryVariances[carrier] = [];
            carrierDeliveryVariances[carrier].push(s.clientDeliveryVariance);

            if (s.clientDeliveryVariance <= 0) {
                onTimeCount++;
            } else {
                sumDelayOnLate += s.clientDeliveryVariance;
                countDelayOnLate++;
                carrierLateVolume[carrier] = (carrierLateVolume[carrier] || 0) + 1;
            }
        }
        if (s.estimatedDelivery && s.deliveryByd) {
            onTimeTotal++;
        }

        // Deliveries & Backlog
        if (s.deliveryByd && isValidDate(s.deliveryByd)) {
            deliveredCount++;
            warehouseStats[bw].picked++;
            carrierDeliveredVolume[carrier] = (carrierDeliveredVolume[carrier] || 0) + 1;

            // Daily tracking
            const d = new Date(s.deliveryByd);
            d.setHours(0,0,0,0);
            const dayKey = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (!dailyData[dayKey]) {
                dailyData[dayKey] = {
                    date: d,
                    label: d.toLocaleDateString(),
                    containerCount: 0,
                    lateCount: 0,
                    isWeekend,
                    goalReached: false,
                    achievementPct: 0,
                    carrierVolume: {},
                    carrierLate: {},
                    warehousePicked: {},
                    generalWarehousePicked: {}
                };
            }
            dailyData[dayKey].containerCount++;
            dailyData[dayKey].carrierVolume[carrier] = (dailyData[dayKey].carrierVolume[carrier] || 0) + 1;
            dailyData[dayKey].warehousePicked[bw] = (dailyData[dayKey].warehousePicked[bw] || 0) + 1;
            const gw = s.generalWarehouse || 'N/A';
            dailyData[dayKey].generalWarehousePicked[gw] = (dailyData[dayKey].generalWarehousePicked[gw] || 0) + 1;

            if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance > 0) {
                dailyData[dayKey].lateCount++;
                dailyData[dayKey].carrierLate[carrier] = (dailyData[dayKey].carrierLate[carrier] || 0) + 1;
            }

            // Monthly Trend
            const monthIdx = d.getMonth();
            const year = d.getFullYear();
            const sortKey = year * 100 + monthIdx;
            if (!monthlyTrendMap[sortKey]) {
                monthlyTrendMap[sortKey] = {
                    name: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                    value: 0,
                    late: 0,
                    sortKey,
                    date: new Date(year, monthIdx, 1)
                };
            }
            monthlyTrendMap[sortKey].value++;
            if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance > 0) {
                monthlyTrendMap[sortKey].late++;
            }
        } else {
            backlog.push(s);
        }

        // Daily Depot returns
        if (s.actualDepotReturnDate && isValidDate(s.actualDepotReturnDate)) {
            const dateObj = new Date(s.actualDepotReturnDate);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];
            if (!dailyDepotData[dayKey]) {
                dailyDepotData[dayKey] = { date: dateObj, label: dateObj.toLocaleDateString(), total: 0, depots: {} };
            }
            dailyDepotData[dayKey].total++;
            dailyDepotData[dayKey].depots[dep] = (dailyDepotData[dayKey].depots[dep] || 0) + 1;
        }

        // Pipeline Map
        const pipeDate = s.ata || s.estimatedDelivery;
        if (pipeDate && isValidDate(pipeDate)) {
            const { week, year } = getISOWeek(pipeDate);
            const pKey = `W${week} - ${year}`;
            if (!pipelineDataMap[pKey]) {
                pipelineDataMap[pKey] = {
                    period: pKey,
                    dateRangeStr: getWeekDateRangeStr(week, year),
                    vessels: [],
                    volume: 0,
                    deliveredCount: 0,
                    pendingCount: 0,
                    drainDaysGate: 0,
                    drainDaysFactory: 0,
                    status: 'SAFE',
                    weekNum: week,
                    year
                };
            }
            pipelineDataMap[pKey].volume++;
            if (s.deliveryByd) pipelineDataMap[pKey].deliveredCount++;
            else pipelineDataMap[pKey].pendingCount++;

            if (s.vesselName && !pipelineDataMap[pKey].vessels.includes(s.vesselName)) {
                pipelineDataMap[pKey].vessels.push(s.vesselName);
            }

            // Inbound Ramp-Up
            if (!rampUpMap[pKey]) {
                rampUpMap[pKey] = { period: pKey, actualArrivals: 0, projectedArrivals: 0, sortKey: year * 100 + week };
            }
            if (s.ata) rampUpMap[pKey].actualArrivals++;
            else rampUpMap[pKey].projectedArrivals++;
        }

        // Monthly Status (Delivered vs Pending)
        const statDate = s.deliveryByd || s.ata;
        if (statDate && isValidDate(statDate)) {
            const mIdx = statDate.getMonth();
            const yr = statDate.getFullYear();
            const sKey = yr * 100 + mIdx;
            if (!monthlyStatusMap[sKey]) {
                monthlyStatusMap[sKey] = {
                    name: statDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                    delivered: 0,
                    pending: 0,
                    total: 0,
                    sortKey: sKey
                };
            }
            monthlyStatusMap[sKey].total++;
            if (s.deliveryByd) monthlyStatusMap[sKey].delivered++;
            else monthlyStatusMap[sKey].pending++;
        }

        // PQR & Model stats
        const model = s.cargoModel || 'Other';
        if (!pqrMap[model]) {
            pqrMap[model] = { count: 0, totalLeadTime: 0, leadTimeCount: 0, totalCost: 0 };
        }
        pqrMap[model].count++;
        if (s.portToDelivery !== null && s.portToDelivery >= 0) {
            pqrMap[model].totalLeadTime += s.portToDelivery;
            pqrMap[model].leadTimeCount++;
        }
        pqrMap[model].totalCost += (s.totalCost || 0);

        // Cargo ready comparison tracking
        const bl = s.billOfLading || 'Unknown';
        if (s.cargoReadyDate && isValidDate(s.cargoReadyDate)) {
            const dateObj = new Date(s.cargoReadyDate);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];
            if (!cargoReadyMap[dayKey]) {
                const dayOfWeek = dateObj.getDay();
                cargoReadyMap[dayKey] = {
                    date: dateObj, label: dateObj.toLocaleDateString(),
                    readyCount: 0, deliveredCount: 0, ataCount: 0,
                    readyBLs: new Set(), deliveredBLs: new Set(), ataBLs: new Set(),
                    isWeekend: dayOfWeek === 0 || dayOfWeek === 6
                };
            }
            cargoReadyMap[dayKey].readyCount++;
            cargoReadyMap[dayKey].readyBLs.add(bl);
        }
        if (s.deliveryByd && isValidDate(s.deliveryByd)) {
            const dateObj = new Date(s.deliveryByd);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];
            if (!cargoReadyMap[dayKey]) {
                const dayOfWeek = dateObj.getDay();
                cargoReadyMap[dayKey] = {
                    date: dateObj, label: dateObj.toLocaleDateString(),
                    readyCount: 0, deliveredCount: 0, ataCount: 0,
                    readyBLs: new Set(), deliveredBLs: new Set(), ataBLs: new Set(),
                    isWeekend: dayOfWeek === 0 || dayOfWeek === 6
                };
            }
            cargoReadyMap[dayKey].deliveredCount++;
            cargoReadyMap[dayKey].deliveredBLs.add(bl);
        }
        if (s.ata && isValidDate(s.ata)) {
            const dateObj = new Date(s.ata);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];
            if (!cargoReadyMap[dayKey]) {
                const dayOfWeek = dateObj.getDay();
                cargoReadyMap[dayKey] = {
                    date: dateObj, label: dateObj.toLocaleDateString(),
                    readyCount: 0, deliveredCount: 0, ataCount: 0,
                    readyBLs: new Set(), deliveredBLs: new Set(), ataBLs: new Set(),
                    isWeekend: dayOfWeek === 0 || dayOfWeek === 6
                };
            }
            cargoReadyMap[dayKey].ataCount++;
            cargoReadyMap[dayKey].ataBLs.add(bl);
        }
    }

    // Pipeline status computation
    const pipeline = Object.values(pipelineDataMap).map(p => {
        p.drainDaysGate = Math.ceil(p.volume / GATE_CAPACITY_DAY);
        p.drainDaysFactory = Math.ceil(p.volume / FACTORY_CAPACITY_DAY);
        const isPast = p.year < currentYear || (p.year === currentYear && p.weekNum < currentWeek);
        const isCompleted = p.deliveredCount === p.volume && p.volume > 0;

        if (isCompleted) p.status = 'COMPLETED';
        else if (isPast) p.status = 'PRAZO VENCIDO';
        else if (p.drainDaysFactory > 10) p.status = 'TIME COLLISION';
        else p.status = 'SAFE';
        return p;
    }).sort((a, b) => (a.year * 100 + a.weekNum) - (b.year * 100 + b.weekNum));

    // Daily operational achievements
    let totalWeekdaysOperated = 0;
    let daysGoalAchieved = 0;
    let weekendBonusVolume = 0;
    let totalWeekdayVolume = 0;

    Object.values(dailyData).forEach(day => {
        day.achievementPct = parseFloat(((day.containerCount / DAILY_GOAL_TARGET) * 100).toFixed(1));
        if (day.containerCount >= DAILY_GOAL_TARGET) day.goalReached = true;
        if (!day.isWeekend) {
            totalWeekdaysOperated++;
            totalWeekdayVolume += day.containerCount;
            if (day.containerCount >= DAILY_GOAL_TARGET) daysGoalAchieved++;
        } else {
            weekendBonusVolume += day.containerCount;
        }
    });

    const daysGoalNotAchieved = totalWeekdaysOperated - daysGoalAchieved;
    const goalAchievementPct = totalWeekdaysOperated > 0 ? ((daysGoalAchieved / totalWeekdaysOperated) * 100).toFixed(1) : '0.0';
    const avgWeekdayVolume = totalWeekdaysOperated > 0 ? (totalWeekdayVolume / totalWeekdaysOperated).toFixed(1) : '0.0';
    const avgDrainRate = parseFloat(avgWeekdayVolume) || 1;

    // Backlog & Exposure calculation
    backlog.sort((a, b) => {
        const dateA = a.cargoReadyDate || a.ata || new Date(0);
        const dateB = b.cargoReadyDate || b.ata || new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    const projectedBacklog: Shipment[] = [];
    const projectedDaysMap: Record<string, number> = {};

    const backlogLen = backlog.length;
    for (let index = 0; index < backlogLen; index++) {
        const s = backlog[index];
        const startDate = s.cargoReadyDate || s.ata;
        if (!startDate || !isValidDate(startDate)) continue;
        const daysAlreadyInBacklog = (todayUTC.getTime() - toUTC(startDate).getTime()) / 86400000;
        const estimatedDaysToDrain = index / avgDrainRate;
        const totalProjected = daysAlreadyInBacklog + estimatedDaysToDrain;
        if (totalProjected > 10) {
            projectedBacklog.push(s);
            projectedDaysMap[s.containerNumber] = Math.ceil(totalProjected);
        }
    }

    const financialExposure = estimateFinancialExposure(projectedBacklog, projectedDaysMap);

    const onTimePercentage = onTimeTotal ? ((onTimeCount / onTimeTotal) * 100).toFixed(1) : '0.0';

    const kpis: KpiData = {
        totalShipments,
        deliveredCount,
        onTimePercentage,
        totalDemurrage,
        demurrageShipmentsCount,
        detentionRiskShipments: detentionRiskCount,
        avgPortToDelivery: countPortToDelivery > 0 ? (sumPortToDelivery / countPortToDelivery).toFixed(1) : '0.0',
        avgClearanceTime: countClearanceTime > 0 ? (sumClearanceTime / countClearanceTime).toFixed(1) : '0.0',
        avgAtaToChannel: countAtaToChannel > 0 ? (sumAtaToChannel / countAtaToChannel).toFixed(1) : '0.0',
        avgChannelToNf: countChannelToNf > 0 ? (sumChannelToNf / countChannelToNf).toFixed(1) : '0.0',
        avgTransportTime: countTransportTime > 0 ? (sumTransportTime / countTransportTime).toFixed(1) : '0.0',
        avgStreetTurnTime: countStreetTurnTime > 0 ? (sumStreetTurnTime / countStreetTurnTime).toFixed(1) : '0.0',
        avgPortToCargoReady: countPortToCargoReady > 0 ? (sumPortToCargoReady / countPortToCargoReady).toFixed(1) : '0.0',
        avgClientDeliveryVariance: countClientDeliveryVariance > 0 ? (sumClientDeliveryVariance / countClientDeliveryVariance).toFixed(1) : '0.0',
        avgDelayOnLate: countDelayOnLate > 0 ? (sumDelayOnLate / countDelayOnLate).toFixed(1) : '0.0',
        avgDetentionDays: countDetentionDays > 0 ? (sumDetentionDays / countDetentionDays).toFixed(1) : '0.0',
        demurrageIncidence: totalShipments > 0 ? ((demurrageShipmentsCount / totalShipments) * 100).toFixed(1) : '0.0',
        detentionIncidence: totalShipments > 0 ? ((detentionRiskCount / totalShipments) * 100).toFixed(1) : '0.0',
        dailyGoalValue: DAILY_GOAL_TARGET,
        daysGoalAchieved,
        daysGoalNotAchieved,
        goalAchievementPct,
        avgWeekdayVolume,
        totalWeekdayVolume,
        weekendBonusVolume,
        totalWeekdaysOperated,
        totalOperationalDays: Object.keys(dailyData).length,
        pendingRomaneioCount,
        flaggedContainersCount,
        projectedBacklogCrossing10Days: projectedBacklog.length,
        financialExposure,
        inTransit,
        portFiscal,
        bondedStock,
        ftRisk7d,
        ftRisk3d,
        bondedDwellSum,
        bondedDwellCount,
        bondedDwellGt7,
        bondedDwellGt10,
        bondedDwellMax
    };

    // Trends & breakdowns
    const leadTimeTrend = Object.values(dailyData).sort((a,b) => a.date.getTime() - b.date.getTime());
    const dailyCarrierBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.carrierVolume }));
    const dailyWarehousePickedBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.warehousePicked }));
    const dailyGeneralWarehousePickedBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.generalWarehousePicked }));
    const dailyCarrierDelayBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, totalLate: day.lateCount, ...day.carrierLate }));
    const dailyDepotReturnBreakdown = Object.values(dailyDepotData).sort((a,b) => a.date.getTime() - b.date.getTime()).map(day => ({ date: day.date, label: day.label, total: day.total, ...day.depots }));

    const monthlyTrend = Object.values(monthlyTrendMap).sort((a, b) => a.sortKey - b.sortKey);
    const monthlyStatus = Object.values(monthlyStatusMap).sort((a, b) => a.sortKey - b.sortKey);

    const warehouseVolume = Object.entries(warehouseStats).map(([name, stats]) => ({
        name,
        value: stats.total,
        capacity: WAREHOUSE_CAPACITIES[name] || 0,
        arrived: stats.arrived
    })).sort((a, b) => b.value - a.value);

    const unloadedByWarehouse = Object.entries(warehouseStats).filter(([_, stats]) => stats.unloaded > 0).map(([name, stats]) => ({
        name,
        value: stats.unloaded,
        capacity: WAREHOUSE_CAPACITIES[name] || 0
    })).sort((a, b) => b.value - a.value);

    const bondedFlow = Object.entries(warehouseStats).map(([name, stats]) => ({
        name,
        placed: stats.placed,
        picked: stats.picked,
        arrived: stats.arrived
    })).sort((a, b) => b.placed - a.placed);

    const carrierVolume = Object.entries(carrierDeliveredVolume).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const carrierPerformance = Object.entries(carrierTransportTimes).map(([name, times]) => ({
        name,
        avgTime: avg(times)
    })).sort((a, b) => a.avgTime - b.avgTime);

    const carrierDelayImpact = Object.entries(carrierTotalVolume).map(([name, total]) => {
        const late = carrierLateVolume[name] || 0;
        return {
            name,
            volume: total,
            lateCount: late,
            latePct: total > 0 ? parseFloat(((late / total) * 100).toFixed(1)) : 0,
            volumePct: totalShipments > 0 ? parseFloat(((total / totalShipments) * 100).toFixed(1)) : 0
        };
    }).sort((a, b) => b.volume - a.volume);

    const bondedInventory = Object.entries(warehouseStats).map(([name, counts]) => ({
        name,
        arrivedNotPicked: counts.arrivedNotPicked,
        futureArrivals: counts.futureArrivals,
        total: counts.arrivedNotPicked + counts.futureArrivals
    })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

    // PQR & XYZ calculation
    const pqrList = Object.entries(pqrMap).map(([name, stats]) => ({
        name,
        value: stats.count,
        percentage: totalShipments > 0 ? (stats.count / totalShipments) * 100 : 0,
        avgLeadTime: stats.leadTimeCount > 0 ? stats.totalLeadTime / stats.leadTimeCount : null,
        totalCost: stats.totalCost
    })).sort((a, b) => b.value - a.value);

    let cumulativePercentage = 0;
    const pqrAnalysis = pqrList.map(item => {
        cumulativePercentage += item.percentage;
        let classification: 'P' | 'Q' | 'R' = 'R';
        if (cumulativePercentage <= 80) classification = 'P';
        else if (cumulativePercentage <= 95) classification = 'Q';
        else classification = 'R';
        return { ...item, classification, percentage: parseFloat(item.percentage.toFixed(1)) };
    }) as any;

    const xyzList = Object.entries(pqrMap).map(([name, stats]) => ({
        name,
        value: stats.count,
        percentage: totalPortfolioCost > 0 ? (stats.totalCost / totalPortfolioCost) * 100 : 0,
        avgLeadTime: stats.leadTimeCount > 0 ? stats.totalLeadTime / stats.leadTimeCount : null,
        totalCost: stats.totalCost
    })).sort((a, b) => b.totalCost - a.totalCost);

    let cumulativeCostPercentage = 0;
    const xyzAnalysis = xyzList.map(item => {
        cumulativeCostPercentage += item.percentage;
        let classification: 'X' | 'Y' | 'Z' = 'Z';
        if (cumulativeCostPercentage <= 80) classification = 'X';
        else if (cumulativeCostPercentage <= 95) classification = 'Y';
        else classification = 'Z';
        return { ...item, classification, percentage: parseFloat(item.percentage.toFixed(1)) };
    }) as any;

    // Cargo Ready Comparison
    const sortedDays = Object.values(cargoReadyMap).sort((a, b) => a.date.getTime() - b.date.getTime());
    let currentBalance = 0;
    let currentBalanceBL = 0;
    const cargoReadyComparison = sortedDays.map(day => {
        currentBalance = currentBalance + day.readyCount - day.deliveredCount;
        currentBalanceBL = currentBalanceBL + day.readyBLs.size - day.deliveredBLs.size;
        return {
            date: day.date,
            label: day.label,
            readyCount: day.readyCount,
            deliveredCount: day.deliveredCount,
            ataCount: day.ataCount,
            runningBalance: Math.max(0, currentBalance),
            readyCountBL: day.readyBLs.size,
            deliveredCountBL: day.deliveredBLs.size,
            ataCountBL: day.ataBLs.size,
            runningBalanceBL: Math.max(0, currentBalanceBL),
            isWeekend: day.isWeekend
        };
    });

    // Inbound Ramp Up Plan
    const sortedRampUp = Object.values(rampUpMap).sort((a, b) => a.sortKey - b.sortKey);
    let cumulativeArrivals = 0;
    const rampUpPlan = sortedRampUp.map(period => {
        cumulativeArrivals += period.actualArrivals + period.projectedArrivals;
        return { ...period, cumulativeArrivals };
    });

    const charts: ChartData = {
        pipeline,
        leadTimeTrend,
        dailyCarrierBreakdown,
        dailyWarehousePickedBreakdown,
        dailyGeneralWarehousePickedBreakdown,
        dailyCarrierDelayBreakdown,
        dailyDepotReturnBreakdown,
        monthlyStatus,
        monthlyTrend,
        dailyVolumeStats: { 
            avg: avg(leadTimeTrend.map(d => d.containerCount)), 
            min: leadTimeTrend.length > 0 ? Math.min(...leadTimeTrend.map(d => d.containerCount)) : 0, 
            max: leadTimeTrend.length > 0 ? Math.max(...leadTimeTrend.map(d => d.containerCount)) : 0 
        },
        cycleTime: [
            { name: 'Port to Customs', value: countPortToCargoReady > 0 ? parseFloat((sumPortToCargoReady / countPortToCargoReady).toFixed(1)) : 0 },
            { name: 'Customs Process', value: countClearanceTime > 0 ? parseFloat((sumClearanceTime / countClearanceTime).toFixed(1)) : 0 },
            { name: 'Transport to Delivery', value: countTransportTime > 0 ? parseFloat((sumTransportTime / countTransportTime).toFixed(1)) : 0 }
        ],
        carrierPerformance,
        carrierDelayImpact,
        depotDistribution: Object.entries(depotStats).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        customsChannel: Object.entries(parametrizationStats).map(([name, value]) => ({ name, value })),
        demurrageIncidence: [ { name: 'No Demurrage', value: totalShipments - demurrageShipmentsCount }, { name: 'With Demurrage', value: demurrageShipmentsCount } ],
        detentionRisk: [ { name: 'On Time Return', value: totalShipments - detentionRiskCount }, { name: 'Late Return', value: detentionRiskCount } ],
        analystWorkload: Object.entries(analystStats).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)),
        demurrageByShipowner: Object.entries(shipownerDemurrage).map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost),
        streetTurnByCarrier: Object.entries(carrierStreetTurnTimes).map(([name, times]) => ({ name, avgTime: avg(times) })).sort((a, b) => a.avgTime - b.avgTime),
        portToCargoReadyByCarrier: Object.entries(carrierPortToCargoTimes).map(([name, times]) => ({ name, avgTime: avg(times) })).sort((a, b) => a.avgTime - b.avgTime),
        deliveryVarianceByCarrier: Object.entries(carrierDeliveryVariances).map(([name, variances]) => ({ name, avgVariance: avg(variances) })).sort((a, b) => b.avgVariance - a.avgVariance),
        carrierVolume,
        warehouseVolume,
        unloadedByWarehouse,
        bondedFlow,
        bondedInventory,
        romaneioDistribution: Object.entries(romaneioStats).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        pqrAnalysis,
        xyzAnalysis,
        cargoReadyComparison,
        rampUpPlan
    };

    return { kpis, charts };
};

export const calculateVesselMatrix = (shipments: Shipment[]): import('../types').VesselMatrixData => {
    const matrixMap = new Map<string, import('../types').VesselMatrixSummary>();
    const uniqueStatuses = new Set<string>();
    const uniqueWarehouses = new Set<string>();
    const grandTotals = {
        statuses: {} as Record<string, number>,
        warehouses: {} as Record<string, number>,
        total: 0
    };

    const len = shipments.length;
    for (let i = 0; i < len; i++) {
        const s = shipments[i];
        if (!s) continue;
        const vessel = s.vesselName && s.vesselName.trim() !== '' ? s.vesselName.trim().toUpperCase() : "UNKNOWN VESSEL";
        const etaDate = s.ata || s.estimatedDelivery;
        const etaStr = etaDate && isValidDate(etaDate) ? etaDate.toISOString().split('T')[0] : 'UNKNOWN_ETA';
        const groupKey = `${vessel}_${etaStr}`;

        let row = matrixMap.get(groupKey);
        if (!row) {
            row = {
                vessel,
                eta: etaDate,
                statuses: {},
                warehouses: {},
                total: 0
            };
            matrixMap.set(groupKey, row);
        }

        const status = (s.statusComex && s.statusComex.trim() !== '') 
            ? s.statusComex.trim().toUpperCase() 
            : ((s.status && s.status.trim() !== '') ? s.status.trim().toUpperCase() : "UNKNOWN STATUS");
            
        let warehouse = s.generalWarehouse ? s.generalWarehouse.trim().toUpperCase() : "";
        if (!warehouse || warehouse === 'UNKNOWN') {
            warehouse = s.bondedWarehouse ? s.bondedWarehouse.trim().toUpperCase() : "";
        }
        if (!warehouse || warehouse === 'UNKNOWN') {
            warehouse = "UNKNOWN WAREHOUSE";
        }

        uniqueStatuses.add(status);
        uniqueWarehouses.add(warehouse);

        row.statuses[status] = (row.statuses[status] || 0) + 1;
        row.warehouses[warehouse] = (row.warehouses[warehouse] || 0) + 1;
        row.total++;

        grandTotals.statuses[status] = (grandTotals.statuses[status] || 0) + 1;
        grandTotals.warehouses[warehouse] = (grandTotals.warehouses[warehouse] || 0) + 1;
        grandTotals.total++;
    }

    const rows = Array.from(matrixMap.values()).sort((a, b) => {
        const aTime = a.eta && isValidDate(a.eta) ? a.eta.getTime() : 0;
        const bTime = b.eta && isValidDate(b.eta) ? b.eta.getTime() : 0;
        if (aTime !== bTime) {
            return aTime - bTime;
        }
        return a.vessel.localeCompare(b.vessel);
    });

    const statusOrder = [
        "IN TRANSIT",
        "AT THE PORT",
        "CARGO PRESENCE",
        "REGISTERED IMPORT DECLARATION",
        "IMPORT DECLARATION",
        "CARGO CLEARED",
        "CARGO READY",
        "CARGO DELIVERED"
    ];

    const warehouseOrder = [
        "INTERMARITIMA",
        "TECON",
        "AG - INTER CDEX",
        "TPC",
        "CLIA",
        "BUFFER - TERCAM"
    ];

    const sortStatuses = (a: string, b: string) => {
        let indexA = statusOrder.findIndex(s => a.includes(s));
        let indexB = statusOrder.findIndex(s => b.includes(s));
        
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        
        if (indexA !== indexB) return indexA - indexB;
        return a.localeCompare(b);
    };

    const sortWarehouses = (a: string, b: string) => {
        let indexA = warehouseOrder.findIndex(w => a.includes(w));
        let indexB = warehouseOrder.findIndex(w => b.includes(w));

        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;

        if (indexA !== indexB) return indexA - indexB;
        return a.localeCompare(b);
    };

    return {
        rows,
        uniqueStatuses: Array.from(uniqueStatuses).sort(sortStatuses),
        uniqueWarehouses: Array.from(uniqueWarehouses).sort(sortWarehouses),
        grandTotals
    };
};
