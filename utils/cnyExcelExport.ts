import ExcelJS from 'exceljs';
import { DailyCnyMetrics } from './cnyMatrixData';

/**
 * Generates an executive-formatted .xlsx file matching the Chinese management team's
 * standardized operational matrix layout.
 */
export async function exportCnyOperationalMatrixToExcel(
  days: DailyCnyMetrics[],
  fileName: string = '巴西末端物流关键数据_LastMile_Logistics.xlsx'
): Promise<void> {
  if (!days || days.length === 0) {
    throw new Error('No operational dates available to export.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BYD Brazil Last-Mile Logistics Management';
  workbook.lastModifiedBy = 'BYD Logistics Operational Control';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('末端物流关键数据', {
    views: [{ showGridLines: true }]
  });

  // Styles definition
  const headerBlueFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB4C6E7' } // Soft steel blue
  };

  const metricYellowFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' } // Accent yellow
  };

  const whiteFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' }
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
  };

  const boldFont: Partial<ExcelJS.Font> = {
    name: 'Microsoft YaHei',
    size: 10,
    bold: true,
    color: { argb: 'FF000000' }
  };

  const regularFont: Partial<ExcelJS.Font> = {
    name: 'Microsoft YaHei',
    size: 9.5,
    bold: false,
    color: { argb: 'FF000000' }
  };

  const centerAlign: Partial<ExcelJS.Alignment> = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true
  };

  const leftAlign: Partial<ExcelJS.Alignment> = {
    vertical: 'middle',
    horizontal: 'left',
    indent: 1,
    wrapText: true
  };

  // Configure Column Widths
  worksheet.getColumn(1).width = 13; // Section (Storage, Pickup, Return)
  worksheet.getColumn(2).width = 16; // Category (Port, Bonded, General, Delivery BYD, Return Depot)
  worksheet.getColumn(3).width = 20; // Location (Vessel Arrival SSA, CLIA, etc.)
  worksheet.getColumn(4).width = 34; // Metric Label
  for (let i = 0; i < days.length; i++) {
    worksheet.getColumn(5 + i).width = 14;
  }

  // Row 1: Top Header Row
  const row1 = worksheet.getRow(1);
  row1.height = 30;
  row1.getCell(1).value = '巴西末端物流关键数据';
  for (let c = 1; c <= 4; c++) {
    const cell = row1.getCell(c);
    cell.fill = headerBlueFill;
    cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  }
  worksheet.mergeCells(1, 1, 1, 4);

  // Date columns in Row 1
  days.forEach((day, idx) => {
    const colIdx = 5 + idx;
    const cell = row1.getCell(colIdx);
    cell.value = day.dateFormatted;
    cell.fill = headerBlueFill;
    cell.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  });

  // Helper to style data row
  const createRow = (
    rowNum: number,
    metricLabel: string,
    values: (number | string)[],
    isYellow: boolean,
    isBold: boolean = false
  ) => {
    const row = worksheet.getRow(rowNum);
    row.height = 22;
    const metricCell = row.getCell(4);
    metricCell.value = metricLabel;
    metricCell.font = isBold ? boldFont : regularFont;
    metricCell.alignment = leftAlign;
    metricCell.border = thinBorder;
    metricCell.fill = whiteFill;

    values.forEach((val, idx) => {
      const cell = row.getCell(5 + idx);
      cell.value = val;
      cell.font = isBold ? boldFont : regularFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      cell.fill = isYellow ? metricYellowFill : whiteFill;
    });
  };

  // Section 1: Port Operations
  // Row 2: Arrived not released
  createRow(
    2,
    '已到港未放行(Arrive not released)',
    days.map(d => d.arrivedNotReleased),
    true
  );

  // Row 3: Released not Delivered
  createRow(
    3,
    '已放行未派送(Released not Delivered)',
    days.map(d => d.releasedNotDelivered),
    true
  );

  worksheet.getCell('B2').value = 'Port';
  worksheet.mergeCells('B2:B3');
  worksheet.getCell('C2').value = 'Vessel Arrival SSA';
  worksheet.mergeCells('C2:C3');

  // Section 2: Storage -> Bonded
  // Row 4 & 5: CLIA
  createRow(4, 'Capacity of Containers', days.map(() => 300), false);
  createRow(5, 'How many put in', days.map(d => d.bondedPutIn['CLIA'] || 0), true);
  worksheet.getCell('C4').value = 'CLIA';
  worksheet.mergeCells('C4:C5');

  // Row 6 & 7: INTERMARITIMA
  createRow(6, 'Capacity of Containers', days.map(() => 800), false);
  createRow(7, 'How many put in', days.map(d => d.bondedPutIn['INTERMARITIMA'] || 0), true);
  worksheet.getCell('C6').value = 'INTERMARITIMA';
  worksheet.mergeCells('C6:C7');

  // Row 8 & 9: TECON
  createRow(8, 'Capacity of Containers', days.map(() => 1800), false);
  createRow(9, 'How many put in', days.map(d => d.bondedPutIn['TECON'] || 0), true);
  worksheet.getCell('C8').value = 'TECON';
  worksheet.mergeCells('C8:C9');

  // Row 10 & 11: TPC
  createRow(10, 'Capacity of Containers', days.map(() => 1200), false);
  createRow(11, 'How many put in', days.map(d => d.bondedPutIn['TPC'] || 0), true);
  worksheet.getCell('C10').value = 'TPC';
  worksheet.mergeCells('C10:C11');

  // Row 12 & 13: Bonded Total
  createRow(12, 'Capacity of Containers', days.map(() => 4100), false, true);
  createRow(13, 'How many put in', days.map(d => d.totalBondedPutIn), false, true);
  worksheet.getCell('C12').value = 'Total';
  worksheet.mergeCells('C12:C13');

  worksheet.getCell('B4').value = 'Bonded';
  worksheet.mergeCells('B4:B13');

  // Section 2: Storage -> General
  // Row 14 & 15: CEDX
  createRow(14, 'Capacity of Containers', days.map(() => 1200), false);
  createRow(15, 'How many put in', days.map(d => d.generalPutIn['CEDX'] || 0), true);
  worksheet.getCell('C14').value = 'CEDX';
  worksheet.mergeCells('C14:C15');

  // Row 16 & 17: LOGIC
  createRow(16, 'Capacity of Containers', days.map(() => 2000), false);
  createRow(17, 'How many put in', days.map(d => d.generalPutIn['LOGIC'] || 0), true);
  worksheet.getCell('C16').value = 'LOGIC';
  worksheet.mergeCells('C16:C17');

  // Row 18 & 19: Multiog
  createRow(18, 'Capacity of Containers', days.map(() => 1000), false);
  createRow(19, 'How many put in', days.map(d => d.generalPutIn['MULTILOG'] || 0), true);
  worksheet.getCell('C18').value = 'Multiog';
  worksheet.mergeCells('C18:C19');

  // Row 20 & 21: General Total
  createRow(20, 'Capacity of Containers', days.map(() => 4200), false, true);
  createRow(21, 'How many put in', days.map(d => d.totalGeneralPutIn), false, true);
  worksheet.getCell('C20').value = 'Total';
  worksheet.mergeCells('C20:C21');

  worksheet.getCell('B14').value = 'General';
  worksheet.mergeCells('B14:B21');

  worksheet.getCell('A4').value = 'Storage';
  worksheet.mergeCells('A4:A21');

  // Section 3: Pickup / Delivery
  createRow(22, '提重计划', days.map(d => d.plannedPickup), true);
  createRow(23, '实际提重', days.map(d => d.actualPickup), true);
  createRow(
    24,
    '达成率',
    days.map(d => (d.pickupAchievementRate !== null ? `${d.pickupAchievementRate.toFixed(1)}%` : '#DIV/0!')),
    false,
    true
  );

  worksheet.getCell('A22').value = 'Pickup';
  worksheet.mergeCells('A22:A24');
  worksheet.getCell('B22').value = 'Delivery BYD';
  worksheet.mergeCells('B22:B24');
  worksheet.getCell('C22').value = '萨尔瓦多';
  worksheet.mergeCells('C22:C24');

  // Section 4: Empty Container Return
  createRow(25, '还空计划', days.map(d => (d.plannedReturn > 0 ? d.plannedReturn : 0)), true);
  createRow(26, '实际还空', days.map(d => (d.actualReturn > 0 ? d.actualReturn : 0)), true);
  createRow(
    27,
    '达成率',
    days.map(d => (d.returnAchievementRate !== null ? `${d.returnAchievementRate.toFixed(1)}%` : '#DIV/0!')),
    false,
    true
  );

  worksheet.getCell('A25').value = 'Return';
  worksheet.mergeCells('A25:A27');
  worksheet.getCell('B25').value = 'Return Depot';
  worksheet.mergeCells('B25:B27');
  worksheet.getCell('C25').value = '船司堆场';
  worksheet.mergeCells('C25:C27');

  // Apply styling to all category merge header cells
  const categoryHeaderCells = [
    'A2', 'A3', 'A4', 'B2', 'B4', 'B14', 'B22', 'B25',
    'C2', 'C4', 'C6', 'C8', 'C10', 'C12', 'C14', 'C16', 'C18', 'C20', 'C22', 'C25',
    'A22', 'A25'
  ];

  for (let r = 2; r <= 27; r++) {
    for (let c = 1; c <= 3; c++) {
      const cell = worksheet.getRow(r).getCell(c);
      cell.font = boldFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      cell.fill = whiteFill;
    }
  }

  // Trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
