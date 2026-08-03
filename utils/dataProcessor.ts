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

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    
    if (dateInput instanceof Date) {
        if (!isValidDate(dateInput) || dateInput.getFullYear() < 2000) return null;
        return dateInput;
    }

    if (typeof dateInput === 'number') {
        if (dateInput > 36526 && dateInput < 2958465) { 
             const utc_days  = Math.floor(dateInput - 25569);
             const utc_value = utc_days * 86400;                                         
             const date_info = new Date(utc_value * 1000);
             return isValidDate(date_info) ? date_info : null;
        }
    }

    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (!trimmed) return null;

        const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1], 10);
            const month = parseInt(ddmmyyyy[2], 10) - 1;
            const year = parseInt(ddmmyyyy[3], 10);
            const date = new Date(year, month, day);
            if (isValidDate(date) && date.getTime() > 0) return date;
        }

        const date = new Date(dateInput);
        if (isValidDate(date)) {
            if (date.getFullYear() < 2000) return null;
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() + userTimezoneOffset);
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

export const processRawData = (data: any[][]): { shipments: Shipment[], carriers: string[], analysts: string[], cargos: string[], containerTypes: string[], incoterms: string[], romaneioStatuses: string[], years: number[], statusComexList: string[], generalWarehouseList: string[] } => {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The uploaded spreadsheet is empty.");
    }

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
            let index = headers.indexOf(name);
            if (index !== -1) return index;
            index = headers.findIndex(h => h === name);
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
    const analysts = new Set<string>();
    const cargos = new Set<string>();
    const containerTypes = new Set<string>();
    const incoterms = new Set<string>();
    const romaneioStatuses = new Set<string>();
    const statusComexSet = new Set<string>();
    const generalWarehouseSet = new Set<string>();
    
    const years = new Set<number>([new Date().getFullYear()]);
    const seenContainers = new Set<string>();
    const headerIndex = data.indexOf(headerRow);

    const shipments: Shipment[] = [];
    const rows = data.slice(headerIndex + 1);
    
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;
        
        const containerNumber = indices.containerNumber !== -1 ? String(row[indices.containerNumber] || '').trim() : '';
        const shipperRaw = indices.shipper !== -1 ? row[indices.shipper] : '';
        
        // Skip completely empty rows or rows missing both a container number and shipper
        if (!containerNumber && !shipperRaw) continue;

        if (containerNumber && seenContainers.has(containerNumber)) {
            continue;
        }
        if (containerNumber) {
            seenContainers.add(containerNumber);
        }

        const billOfLading = indices.billOfLading !== -1 ? String(row[indices.billOfLading] || '').trim() : 'N/A';

        // Parse each date exactly once
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

        const normalizeName = (name: string) => {
            if (!name) return name;
            return name.replace(/[^\s-]+/g, (match) => {
                const lower = match.toLowerCase();
                if (lower === 'skd' || lower === 'ckd' || lower === 'cbu' || lower === 'byd' || lower === 'phev' || lower === 'ev') return match.toUpperCase();
                return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
            });
        };

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
            const todayUTC = toUTC(new Date());
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

    return { 
        shipments, 
        carriers: [...carriers].sort(), 
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

  shipments.forEach(s => {
    if(!s) return;
    if(s.ata) received++;
    if(s.dateNF) released++;
    if(s.actualDepotReturnDate) emptyReturned++;
    if(s.channelDate) cleared++;
    if(s.unloadDate) yardTransfers++;
    
    const statusUpper = `${s.status || ''} ${s.statusComex || ''}`.toUpperCase();
    if(statusUpper.includes('WAIT') || statusUpper.includes('AG -')) trucksWaiting++;

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

    if(s.cargoModel && actionDate) modelTotals[model] = (modelTotals[model] || 0) + 1;
  });

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

        shipments.forEach(s => {
            if (!s) return;
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
                } else if (status.includes('MAR') || status.includes('TRANSIT')) {
                    row['IN TRANSIT']++;
                } else {
                    row['IN TRANSIT']++;
                }
            }
        });
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
    const deliveredShipments = shipments.filter(s => s && s.deliveryByd !== null);
    
    const clientDeliveryVariances = shipments.map(s => s ? s.clientDeliveryVariance : null).filter((d): d is number => d !== null && !isNaN(d));
    const onTimeTotal = shipments.filter(s => s && s.estimatedDelivery && s.deliveryByd).length;
    const onTimeCount = clientDeliveryVariances.filter(d => d <= 0).length;
    const onTimePercentage = onTimeTotal ? ((onTimeCount / onTimeTotal) * 100).toFixed(1) : '0.0';
    
    const totalDemurrage = shipments.reduce((sum, s) => sum + (s ? (s.demurrageCost || 0) : 0), 0);
    const demurrageShipmentsCount = shipments.filter(s => s && s.demurrageCost > 0).length;
    const detentionRiskShipments = shipments.filter(s => s && s.detentionRisk !== null && s.detentionRisk > 0);
    const pendingRomaneioCount = shipments.filter(s => s && (!s.madeRomaneio || s.madeRomaneio === 'NO' || s.madeRomaneio === '0')).length;

    const todayUTC = toUTC(new Date());
    const flaggedContainersCount = shipments.filter(s => {
        if (!s || s.actualDepotReturnDate || !s.freeTimeDate || !isValidDate(s.freeTimeDate)) return false;
        const freeTimeUTC = toUTC(s.freeTimeDate);
        const diffTime = freeTimeUTC.getTime() - todayUTC.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 15;
    }).length;
    
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
    }> = shipments.reduce((acc, s) => {
        if (s && s.deliveryByd && isValidDate(s.deliveryByd)) {
            const dateObj = new Date(s.deliveryByd);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (!acc[dayKey]) {
                acc[dayKey] = { 
                    date: dateObj, 
                    label: dateObj.toLocaleDateString(), 
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
            acc[dayKey].containerCount++;
            
            const carrier = s.carrier || 'Unknown';
            acc[dayKey].carrierVolume[carrier] = (acc[dayKey].carrierVolume[carrier] || 0) + 1;

            const warehouse = s.bondedWarehouse || 'Unknown';
            acc[dayKey].warehousePicked[warehouse] = (acc[dayKey].warehousePicked[warehouse] || 0) + 1;

            const genWarehouse = s.generalWarehouse || 'N/A';
            acc[dayKey].generalWarehousePicked[genWarehouse] = (acc[dayKey].generalWarehousePicked[genWarehouse] || 0) + 1;

            if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance > 0) {
                acc[dayKey].lateCount++;
                acc[dayKey].carrierLate[carrier] = (acc[dayKey].carrierLate[carrier] || 0) + 1;
            }
        }
        return acc;
    }, {} as Record<string, any>);

    const dailyDepotData: Record<string, { date: Date; label: string; total: number; depots: Record<string, number> }> = shipments.reduce((acc, s) => {
        if (s && s.actualDepotReturnDate && isValidDate(s.actualDepotReturnDate)) {
            const dateObj = new Date(s.actualDepotReturnDate);
            dateObj.setHours(0,0,0,0);
            const dayKey = dateObj.toISOString().split('T')[0];

            if (!acc[dayKey]) {
                acc[dayKey] = { 
                    date: dateObj, 
                    label: dateObj.toLocaleDateString(), 
                    total: 0, 
                    depots: {}
                };
            }
            acc[dayKey].total++;
            const depot = s.depot || 'N/A';
            acc[dayKey].depots[depot] = (acc[dayKey].depots[depot] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, any>);

    const pipelineDataMap: Record<string, PipelineWeek> = shipments.reduce((acc, s) => {
        if (!s) return acc;
        const date = s.ata || s.estimatedDelivery;
        if (date && isValidDate(date)) {
            const { week, year } = getISOWeek(date);
            const key = `W${week} - ${year}`;
            
            if (!acc[key]) {
                acc[key] = {
                    period: key,
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
            
            acc[key].volume++;
            if (s.deliveryByd) {
                acc[key].deliveredCount++;
            } else {
                acc[key].pendingCount++;
            }

            if (s.vesselName && !acc[key].vessels.includes(s.vesselName)) {
                acc[key].vessels.push(s.vesselName);
            }
        }
        return acc;
    }, {} as Record<string, PipelineWeek>);

    const today = new Date();
    const { week: currentWeek, year: currentYear } = getISOWeek(today);

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

    const backlog = shipments.filter(s => s && !s.deliveryByd).sort((a, b) => {
        const dateA = a.cargoReadyDate || a.ata || new Date(0);
        const dateB = b.cargoReadyDate || b.ata || new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    const projectedBacklog = backlog.filter((s, index) => {
        const startDate = s.cargoReadyDate || s.ata;
        if (!startDate || !isValidDate(startDate)) return false;
        const daysAlreadyInBacklog = (todayUTC.getTime() - toUTC(startDate).getTime()) / (1000 * 60 * 60 * 24);
        const estimatedDaysToDrain = index / avgDrainRate;
        return (daysAlreadyInBacklog + estimatedDaysToDrain) > 10;
    });

    const projectedDaysMap: Record<string, number> = {};
    projectedBacklog.forEach((s, index) => {
        const startDate = s.cargoReadyDate || s.ata;
        if (!startDate || !isValidDate(startDate)) return;
        const daysAlreadyInBacklog = (todayUTC.getTime() - toUTC(startDate).getTime()) / (1000 * 60 * 60 * 24);
        const estimatedDaysToDrain = index / avgDrainRate;
        projectedDaysMap[s.containerNumber] = Math.ceil(daysAlreadyInBacklog + estimatedDaysToDrain);
    });

    const financialExposure = estimateFinancialExposure(projectedBacklog, projectedDaysMap);

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

    shipments.forEach((s) => {
        if (!s) return;
        const status = (s.status || '').toUpperCase();
        const term = (s.bondedWarehouse || '').toUpperCase();

        if (status.includes("MAR") || status.includes("TRANSIT")) inTransit++;
        if (status.includes("PORTO") || status.includes("FISCAL") || status.includes("CUSTOMS")) portFiscal++;

        const isBonded = term && term !== "OUTROS" && term !== "UNKNOWN" && !s.deliveryByd;
        if (isBonded) bondedStock++;

        const eta = s.ata || s.estimatedDelivery;
        const ft = s.freeTimeDate;
        if (ft && isValidDate(ft) && !s.actualDepotReturnDate) {
            const d = Math.ceil((ft.getTime() - todayUTC.getTime()) / 86400000);
            if (d <= 7) ftRisk7d++;
            if (d <= 3) ftRisk3d++;
        }

        if (isBonded) {
            const cleared = s.channelDate || s.dateNF;
            const dwellStart = cleared || eta;
            if (dwellStart && isValidDate(dwellStart)) {
                const dwell = Math.max(0, Math.floor((todayUTC.getTime() - dwellStart.getTime()) / 86400000));
                bondedDwellSum += dwell;
                bondedDwellCount += 1;
                if (dwell > 7) bondedDwellGt7++;
                if (dwell > 10) bondedDwellGt10++;
                if (dwell > bondedDwellMax) bondedDwellMax = dwell;
            }
        }
    });

    const kpis: KpiData = {
        totalShipments,
        deliveredCount: deliveredShipments.length,
        onTimePercentage,
        totalDemurrage,
        demurrageShipmentsCount,
        detentionRiskShipments: detentionRiskShipments.length,
        avgPortToDelivery: avg(shipments.map(s => s.portToDelivery).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgClearanceTime: avg(shipments.map(s => s.totalClearanceTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgAtaToChannel: avg(shipments.map(s => s.ataToChannelTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgChannelToNf: avg(shipments.map(s => s.channelToNfTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgTransportTime: avg(shipments.map(s => s.transportDeliveryTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgStreetTurnTime: avg(shipments.map(s => s.containerStreetTurnTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgPortToCargoReady: avg(shipments.map(s => s.portToCargoReady).filter((d): d is number => d !== null && d >= 0)).toFixed(1),
        avgClientDeliveryVariance: avg(clientDeliveryVariances).toFixed(1),
        avgDelayOnLate: avg(clientDeliveryVariances.filter(d => d > 0)).toFixed(1),
        avgDetentionDays: avg(detentionRiskShipments.map(s => s.detentionRisk).filter((d): d is number => d !== null)).toFixed(1),
        demurrageIncidence: totalShipments > 0 ? ((demurrageShipmentsCount / totalShipments) * 100).toFixed(1) : '0.0',
        detentionIncidence: totalShipments > 0 ? ((detentionRiskShipments.length / totalShipments) * 100).toFixed(1) : '0.0',
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
    
    const leadTimeTrend = (Object.values(dailyData) as any[]).sort((a,b) => a.date.getTime() - b.date.getTime());
    const dailyCarrierBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.carrierVolume }));
    const dailyWarehousePickedBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.warehousePicked }));
    const dailyGeneralWarehousePickedBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, total: day.containerCount, ...day.generalWarehousePicked }));
    const dailyCarrierDelayBreakdown = leadTimeTrend.map(day => ({ date: day.date, label: day.label, totalLate: day.lateCount, ...day.carrierLate }));
    const dailyDepotReturnBreakdown = Object.values(dailyDepotData).sort((a,b) => a.date.getTime() - b.date.getTime()).map(day => ({ date: day.date, label: day.label, total: day.total, ...day.depots }));

    const monthlyTrendMap: Record<number, { name: string; value: number; late: number; sortKey: number; date: Date }> = shipments.reduce((acc, s) => {
        if (s && s.deliveryByd && isValidDate(s.deliveryByd)) {
            const d = new Date(s.deliveryByd);
            const monthIdx = d.getMonth();
            const year = d.getFullYear();
            const sortKey = year * 100 + monthIdx;
            const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const refDate = new Date(year, monthIdx, 1);
            if (!acc[sortKey]) acc[sortKey] = { name: label, value: 0, late: 0, sortKey, date: refDate };
            acc[sortKey].value += 1;
            if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance > 0) acc[sortKey].late++;
        }
        return acc;
    }, {} as Record<number, any>);
    const monthlyTrend = (Object.values(monthlyTrendMap) as any[]).sort((a, b) => a.sortKey - b.sortKey);

    const monthlyStatusMap: Record<number, { name: string; delivered: number; pending: number; total: number; sortKey: number }> = shipments.reduce((acc, s) => {
        if (!s) return acc;
        const date = s.deliveryByd || s.ata;
        if (!date || !isValidDate(date)) return acc;
        const monthIdx = date.getMonth();
        const year = date.getFullYear();
        const sortKey = year * 100 + monthIdx;
        const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!acc[sortKey]) acc[sortKey] = { name: label, delivered: 0, pending: 0, total: 0, sortKey };
        acc[sortKey].total += 1;
        if (s.deliveryByd) acc[sortKey].delivered += 1;
        else acc[sortKey].pending += 1;
        return acc;
    }, {} as Record<number, any>);
    const monthlyStatus = (Object.values(monthlyStatusMap) as any[]).sort((a, b) => a.sortKey - b.sortKey);

    const aggregateBy = <T>(key: keyof Shipment, valueCalc: (s: Shipment) => T | null, aggregator: (values: T[]) => number) => {
        const grouped: Record<string, T[]> = {};
        shipments.forEach(s => {
            if (!s) return;
            const groupKey = String(s[key] || 'Unknown');
            const value = valueCalc(s);
            if(groupKey && value !== null){
                if(!grouped[groupKey]) grouped[groupKey] = [];
                grouped[groupKey].push(value);
            }
        });
        return Object.entries(grouped).map(([name, values]) => ({ name, value: aggregator(values) }));
    };

    const depotDistribution = aggregateBy('depot', () => 1, vals => vals.length).sort((a,b) => b.value - a.value);

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
            { name: 'Port to Customs', value: parseFloat(avg(shipments.map(s => s.portToCustomsTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1)) },
            { name: 'Customs Process', value: parseFloat(avg(shipments.map(s => s.customsProcessTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1)) },
            { name: 'Transport to Delivery', value: parseFloat(avg(shipments.map(s => s.transportDeliveryTime).filter((d): d is number => d !== null && d >= 0)).toFixed(1)) }
        ],
        carrierPerformance: aggregateBy('carrier', s => s.transportDeliveryTime, vals => avg(vals as number[])).map(d => ({name: d.name, avgTime: d.value})).sort((a, b) => a.avgTime - b.avgTime),
        carrierDelayImpact: Object.entries(shipments.reduce((acc, s) => {
            if (!s) return acc;
            const c = s.carrier || 'Unknown';
            if (!acc[c]) acc[c] = { total: 0, late: 0 };
            acc[c].total++;
            if (s.clientDeliveryVariance !== null && s.clientDeliveryVariance > 0) acc[c].late++;
            return acc;
        }, {} as Record<string, { total: number, late: number }>)).map(([name, stats]) => ({
            name,
            volume: stats.total,
            lateCount: stats.late,
            latePct: stats.total > 0 ? parseFloat(((stats.late / stats.total) * 100).toFixed(1)) : 0,
            volumePct: totalShipments > 0 ? parseFloat(((stats.total / totalShipments) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.volume - a.volume),
        depotDistribution,
        customsChannel: aggregateBy('parametrization', () => 1, vals => vals.length),
        demurrageIncidence: [ { name: 'No Demurrage', value: totalShipments - demurrageShipmentsCount }, { name: 'With Demurrage', value: demurrageShipmentsCount } ],
        detentionRisk: [ { name: 'On Time Return', value: totalShipments - detentionRiskShipments.length }, { name: 'Late Return', value: detentionRiskShipments.length } ],
        analystWorkload: aggregateBy('analyst', () => 1, vals => vals.length).sort((a, b) => a.name.localeCompare(b.name)),
        demurrageByShipowner: aggregateBy('shipowner', s => s.demurrageCost, vals => (vals as number[]).reduce((a,b) => a+b, 0)).map(d => ({name: d.name, cost: d.value})).sort((a, b) => b.cost - a.cost),
        streetTurnByCarrier: aggregateBy('carrier', s => s.containerStreetTurnTime, vals => avg(vals as number[])).map(d => ({name: d.name, avgTime: d.value})).sort((a, b) => a.avgTime - b.avgTime),
        portToCargoReadyByCarrier: aggregateBy('carrier', s => s.portToCargoReady, vals => avg(vals as number[])).map(d => ({name: d.name, avgTime: d.value})).sort((a, b) => a.avgTime - b.avgTime),
        deliveryVarianceByCarrier: aggregateBy('carrier', s => s.clientDeliveryVariance, vals => avg(vals as number[])).map(d => ({ name: d.name, avgVariance: d.value })).sort((a, b) => b.avgVariance - a.avgVariance),
        carrierVolume: aggregateBy('carrier', s => s.deliveryByd ? 1 : null, vals => vals.length).sort((a, b) => b.value - a.value),
        warehouseVolume: aggregateBy('bondedWarehouse', s => 1, vals => vals.length).map(d => ({ 
            name: d.name, 
            value: d.value, 
            capacity: WAREHOUSE_CAPACITIES[d.name] || 0,
            arrived: shipments.filter(s => s && s.bondedWarehouse === d.name && s.estimatedDelivery).length
        })).sort((a, b) => b.value - a.value),
        unloadedByWarehouse: aggregateBy('bondedWarehouse', s => s.unloadDate ? 1 : null, vals => vals.length).map(d => ({ name: d.name, value: d.value, capacity: WAREHOUSE_CAPACITIES[d.name] || 0 })).sort((a, b) => b.value - a.value),
        bondedFlow: aggregateBy('bondedWarehouse', s => (s.ata ? 1 : null), vals => vals.length).map(d => ({
            name: d.name,
            placed: d.value,
            picked: shipments.filter(s => s && s.bondedWarehouse === d.name && s.deliveryByd).length,
            arrived: shipments.filter(s => s && s.bondedWarehouse === d.name && s.estimatedDelivery).length
        })).sort((a, b) => b.placed - a.placed),
        bondedInventory: Object.entries(shipments.reduce((acc, s) => {
            if (s && s.ata && isValidDate(s.ata) && !s.deliveryByd) {
                const warehouse = s.bondedWarehouse || 'Unknown';
                if (!acc[warehouse]) acc[warehouse] = { arrivedNotPicked: 0, futureArrivals: 0 };
                
                const isFuture = toUTC(s.ata).getTime() > todayUTC.getTime();
                if (isFuture) {
                    acc[warehouse].futureArrivals++;
                } else {
                    acc[warehouse].arrivedNotPicked++;
                }
            }
            return acc;
        }, {} as Record<string, { arrivedNotPicked: number, futureArrivals: number }>)).map(([name, counts]) => ({
            name,
            arrivedNotPicked: counts.arrivedNotPicked,
            futureArrivals: counts.futureArrivals,
            total: counts.arrivedNotPicked + counts.futureArrivals
        })).sort((a, b) => b.total - a.total),
        romaneioDistribution: Object.entries(shipments.reduce((acc, s) => {
            if (!s) return acc;
            const status = s.madeRomaneio || 'PENDING';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        pqrAnalysis: [],
        xyzAnalysis: [],
        cargoReadyComparison: [],
        rampUpPlan: [],
    };

    // Calculate PQR Analysis
    const pqrMap: Record<string, { count: number; totalLeadTime: number; leadTimeCount: number; totalCost: number }> = {};
    shipments.forEach(s => {
        if (!s) return;
        const model = s.cargoModel || 'Other';
        if (!pqrMap[model]) {
            pqrMap[model] = { count: 0, totalLeadTime: 0, leadTimeCount: 0, totalCost: 0 };
        }
        pqrMap[model].count++;
        if (s.portToDelivery !== null) {
            pqrMap[model].totalLeadTime += s.portToDelivery;
            pqrMap[model].leadTimeCount++;
        }
        pqrMap[model].totalCost += (s.totalCost || 0);
    });

    const pqrList = Object.entries(pqrMap).map(([name, stats]) => ({
        name,
        value: stats.count,
        percentage: totalShipments > 0 ? (stats.count / totalShipments) * 100 : 0,
        avgLeadTime: stats.leadTimeCount > 0 ? stats.totalLeadTime / stats.leadTimeCount : null,
        totalCost: stats.totalCost
    })).sort((a, b) => b.value - a.value);

    let cumulativePercentage = 0;
    charts.pqrAnalysis = pqrList.map(item => {
        cumulativePercentage += item.percentage;
        let classification: 'P' | 'Q' | 'R' = 'R';
        if (cumulativePercentage <= 80) classification = 'P';
        else if (cumulativePercentage <= 95) classification = 'Q';
        else classification = 'R';
        
        return {
            ...item,
            classification,
            percentage: parseFloat(item.percentage.toFixed(1))
        };
    }) as any;

    // Calculate XYZ Analysis
    const totalPortfolioCost = shipments.reduce((sum, s) => sum + (s ? (s.totalCost || 0) : 0), 0);
    const xyzList = Object.entries(pqrMap).map(([name, stats]) => ({
        name,
        value: stats.count,
        percentage: totalPortfolioCost > 0 ? (stats.totalCost / totalPortfolioCost) * 100 : 0,
        avgLeadTime: stats.leadTimeCount > 0 ? stats.totalLeadTime / stats.leadTimeCount : null,
        totalCost: stats.totalCost
    })).sort((a, b) => b.totalCost - a.totalCost);

    let cumulativeCostPercentage = 0;
    charts.xyzAnalysis = xyzList.map(item => {
        cumulativeCostPercentage += item.percentage;
        let classification: 'X' | 'Y' | 'Z' = 'Z';
        if (cumulativeCostPercentage <= 80) classification = 'X';
        else if (cumulativeCostPercentage <= 95) classification = 'Y';
        else classification = 'Z';
        
        return {
            ...item,
            classification,
            percentage: parseFloat(item.percentage.toFixed(1))
        };
    }) as any;

    // Calculate Cargo Ready Comparison
    const cargoReadyMap: Record<string, { date: Date; label: string; readyCount: number; deliveredCount: number; ataCount: number; readyBLs: Set<string>; deliveredBLs: Set<string>; ataBLs: Set<string>; isWeekend: boolean }> = {};

    shipments.forEach(s => {
        if (!s) return;
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
    });

    const sortedDays = Object.values(cargoReadyMap).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let currentBalance = 0;
    let currentBalanceBL = 0;
    charts.cargoReadyComparison = sortedDays.map(day => {
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

    // Calculate Inbound Capacity Ramp-Up Plan
    const rampUpMap: Record<string, { period: string; actualArrivals: number; projectedArrivals: number; sortKey: number }> = {};

    shipments.forEach(s => {
        if (!s) return;
        const date = s.ata || s.estimatedDelivery;
        if (date && isValidDate(date)) {
            const { week, year } = getISOWeek(date);
            const key = `W${week} - ${year}`;
            
            if (!rampUpMap[key]) {
                rampUpMap[key] = {
                    period: key,
                    actualArrivals: 0,
                    projectedArrivals: 0,
                    sortKey: year * 100 + week
                };
            }
            
            if (s.ata) {
                rampUpMap[key].actualArrivals++;
            } else {
                rampUpMap[key].projectedArrivals++;
            }
        }
    });

    const sortedRampUp = Object.values(rampUpMap).sort((a, b) => a.sortKey - b.sortKey);
    let cumulativeArrivals = 0;
    charts.rampUpPlan = sortedRampUp.map(period => {
        cumulativeArrivals += period.actualArrivals + period.projectedArrivals;
        return {
            ...period,
            cumulativeArrivals
        };
    });

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

    shipments.forEach(s => {
        if (!s) return;
        const vessel = s.vesselName && s.vesselName.trim() !== '' ? s.vesselName.trim().toUpperCase() : "UNKNOWN VESSEL";
        const etaDate = s.ata || s.estimatedDelivery;
        const etaStr = etaDate && isValidDate(etaDate) ? etaDate.toISOString().split('T')[0] : 'UNKNOWN_ETA';
        const groupKey = `${vessel}_${etaStr}`;

        if (!matrixMap.has(groupKey)) {
            matrixMap.set(groupKey, {
                vessel,
                eta: etaDate,
                statuses: {},
                warehouses: {},
                total: 0
            });
        }

        const row = matrixMap.get(groupKey)!;

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
    });

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