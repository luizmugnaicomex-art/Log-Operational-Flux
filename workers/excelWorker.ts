import * as XLSX from 'xlsx';
import { Shipment } from '../types';

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

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const parseDateFast = (dateInput: any): Date | null => {
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

const toUTC = (date: Date): Date => {
    if (!isValidDate(date)) return new Date(0);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const dateDiffInDays = (date1: Date | null, date2: Date | null): number | null => {
    if (!date1 || !date2 || !isValidDate(date1) || !isValidDate(date2)) return null;
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utc1 = toUTC(date1);
    const utc2 = toUTC(date2);
    return Math.floor((utc2.getTime() - utc1.getTime()) / _MS_PER_DAY);
};

self.onmessage = async (e: MessageEvent) => {
    const { fileBuffer } = e.data;
    if (!fileBuffer) {
        self.postMessage({ type: 'error', error: 'No file buffer provided' });
        return;
    }

    try {
        self.postMessage({ type: 'progress', percent: 10, message: 'Parsing Excel workbook...' });
        
        // Fast read with dense mode and cellDates
        const data = new Uint8Array(fileBuffer);
        const workbook = XLSX.read(data, { 
            type: 'array', 
            cellDates: true, 
            dense: true 
        });

        const targetSheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === 'CONTAINERS') || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[targetSheetName];

        self.postMessage({ type: 'progress', percent: 30, message: 'Extracting spreadsheet rows...' });

        // Using raw: true drastically reduces memory allocations and string conversions
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' }) as any[][];

        if (!Array.isArray(rawRows) || rawRows.length === 0) {
            throw new Error('The spreadsheet is empty.');
        }

        self.postMessage({ type: 'progress', percent: 45, message: 'Identifying columns...' });

        const headerRow = rawRows.find(row => {
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

        if (!headerRow) throw new Error("Could not find a valid header row in the Excel file.");

        const headers = headerRow.map(h => 
            String(h || '')
                .toUpperCase()
                .replace(/\s+/g, ' ')
                .trim()
        );

        const findHeaderIndex = (...possibleNames: string[]): number => {
            for (const name of possibleNames) {
                const idx = headers.indexOf(name);
                if (idx !== -1) return idx;
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
        const headerIndex = rawRows.indexOf(headerRow);

        const shipments: Shipment[] = [];
        const rows = rawRows.slice(headerIndex + 1);
        const totalRows = rows.length;

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

        const todayUTC = toUTC(new Date());
        let lastReportedProgress = 50;

        for (let r = 0; r < totalRows; r++) {
            if (r % 5000 === 0 && r > 0) {
                const percent = Math.min(95, Math.round(50 + (r / totalRows) * 45));
                if (percent > lastReportedProgress) {
                    lastReportedProgress = percent;
                    self.postMessage({ 
                        type: 'progress', 
                        percent, 
                        message: `Processing container ${r.toLocaleString()} of ${totalRows.toLocaleString()}...` 
                    });
                }
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

            const ataDate = indices.ata !== -1 ? parseDateFast(row[indices.ata]) : null;
            if (ataDate) years.add(ataDate.getFullYear());

            const deliveryBydDate = indices.deliveryByd !== -1 ? parseDateFast(row[indices.deliveryByd]) : null;
            if (deliveryBydDate) years.add(deliveryBydDate.getFullYear());

            const estimatedDeliveryDate = indices.estimatedDelivery !== -1 ? parseDateFast(row[indices.estimatedDelivery]) : null;
            const dateNFDate = indices.dateNF !== -1 ? parseDateFast(row[indices.dateNF]) : null;
            const cargoReadyDate = indices.cargoReadyDate !== -1 ? parseDateFast(row[indices.cargoReadyDate]) : null;
            const channelDate = indices.channelDate !== -1 ? parseDateFast(row[indices.channelDate]) : null;
            const unloadDate = indices.unloadDate !== -1 ? parseDateFast(row[indices.unloadDate]) : null;
            const actualDepotReturnDate = indices.actualDepotReturnDate !== -1 ? parseDateFast(row[indices.actualDepotReturnDate]) : null;
            const estimatedDepotDate = indices.estimatedDepotDate !== -1 ? parseDateFast(row[indices.estimatedDepotDate]) : null;

            let deadlineReturnDate = indices.deadlineReturnDate !== -1 ? parseDateFast(row[indices.deadlineReturnDate]) : null;
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
            const loadingDate = indices.loadingDate !== -1 ? parseDateFast(row[indices.loadingDate]) : null;
            const containerPuttedDownAtBydBuffer = indices.containerPuttedDownAtBydBuffer !== -1 ? parseDateFast(row[indices.containerPuttedDownAtBydBuffer]) : null;
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

        self.postMessage({ type: 'progress', percent: 98, message: 'Finalizing dimensions...' });

        self.postMessage({
            type: 'success',
            data: { 
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
            }
        });
    } catch (err: any) {
        self.postMessage({ type: 'error', error: err.message || 'Failed to process spreadsheet.' });
    }
};
