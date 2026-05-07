
import * as XLSX from 'xlsx';
import { Shipment } from '../types';

export const exportShipmentsToExcel = (shipments: Shipment[], fileName: string = 'shipments_export.xlsx') => {
  const data = shipments.map(s => ({
    'Container ID': s.containerNumber,
    'BL / Document': s.billOfLading,
    'Vessel Name': s.vesselName,
    'Trucking Co': s.carrier,
    'Bonded Warehouse': s.bondedWarehouse,
    'ATA Port': s.ata ? s.ata.toLocaleDateString() : '',
    'Cargo Ready': s.cargoReadyDate ? s.cargoReadyDate.toLocaleDateString() : '',
    'Estimated Delivery': s.estimatedDelivery ? s.estimatedDelivery.toLocaleDateString() : '',
    'Actual Delivery': s.deliveryByd ? s.deliveryByd.toLocaleDateString() : '',
    'Free Time End': s.freeTimeDate ? s.freeTimeDate.toLocaleDateString() : '',
    'Demurrage Cost (USD)': s.demurrageCost,
    'Total Cost (BRL)': s.totalCost,
    'Status': s.deliveryByd ? 'Delivered' : 'Pending'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipments');

  XLSX.writeFile(workbook, fileName);
};
