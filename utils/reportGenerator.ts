
import { KpiData } from '../types';
import { currencyFormatter } from './formatters';

// --- Configuration Constants ---
const PROJECT_NAME = "Logistics KPI Dashboard";
const PROJECT_KEY = "LOGISTICS";
const OWNER_NAME = "System"; // Or specific manager name
const AREA = "Inbound Logistics";

// --- Helper: Get Week Info ---
const getWeekInfo = () => {
    const now = new Date();
    // Adjust to Monday as start of week
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    
    // Week number calculation (ISO 8601ish)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDays = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    const weekNum = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);

    return {
        weekRef: `WK${weekNum.toString().padStart(2, '0')}`,
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: sunday.toISOString().split('T')[0],
        generatedAt: new Date().toISOString()
    };
};

// --- Helper: CSV Escaping ---
const escapeCsv = (str: string | number | undefined): string => {
    if (str === undefined || str === null) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

// --- Main Export Function ---
export const downloadWeeklyReport = (kpis: KpiData) => {
    const { weekRef, weekStart, weekEnd, generatedAt } = getWeekInfo();

    // 1. KPI Logic (Specific to Logistics)
    
    // KPI 1: On-Time Delivery
    const kpi1_name = "On-Time Delivery %";
    const kpi1_valRaw = parseFloat(kpis.onTimePercentage);
    const kpi1_value = `${kpis.onTimePercentage}%`;
    const kpi1_target = "95%";
    let kpi1_status = "GREEN";
    if (kpi1_valRaw < 90) kpi1_status = "RED";
    else if (kpi1_valRaw < 95) kpi1_status = "YELLOW";
    
    // KPI 2: Demurrage Cost
    const kpi2_name = "Demurrage Cost";
    const kpi2_valRaw = kpis.totalDemurrage;
    const kpi2_value = currencyFormatter.format(kpis.totalDemurrage);
    const kpi2_target = "$0.00";
    let kpi2_status = "GREEN";
    if (kpi2_valRaw > 0) kpi2_status = "RED";

    // KPI 3: Detention Risk (Count)
    const kpi3_name = "Detention Risk Containers";
    const kpi3_valRaw = kpis.detentionRiskShipments;
    const kpi3_value = kpis.detentionRiskShipments.toString();
    const kpi3_target = "0";
    let kpi3_status = "GREEN";
    if (kpi3_valRaw > 0) kpi3_status = "RED";

    // 2. Executive Summaries (Auto-generated)
    
    // Highlights
    const mainHighlights = `Total Active Volume: ${kpis.totalShipments} shipments. On-Time Performance at ${kpis.onTimePercentage}%. Avg Lead Time (Port-Delivery): ${kpis.avgPortToDelivery} days.`;

    // Issues/Risks
    const issuesList = [];
    if (kpi2_valRaw > 0) issuesList.push(`Demurrage incurred: ${kpi2_value} on ${kpis.demurrageShipmentsCount} shipments.`);
    if (kpi3_valRaw > 0) issuesList.push(`${kpi3_valRaw} containers at risk of Detention.`);
    if (parseFloat(kpis.avgDelayOnLate) > 0) issuesList.push(`Avg delay on late arrivals: ${kpis.avgDelayOnLate} days.`);
    const mainIssuesRisks = issuesList.length > 0 ? issuesList.join(' ') : "No critical financial risks identified.";

    // Operational Impact
    let operationalImpact = "Normal operations.";
    if (kpi1_status === "RED") operationalImpact = "Production line risk due to low on-time arrival.";
    else if (kpi2_status === "RED") operationalImpact = "Financial impact due to accrued demurrage costs.";

    // Actions
    const actionsNextWeek = "Monitor incoming vessels. Prioritize clearance for flagged detention risks. Push carriers for faster street turn.";

    // Dependencies
    const dependenciesEscalations = kpi1_status === "RED" ? "Escalate carrier delays to Global Procurement." : "None.";

    // Overall Status Calculation
    let overallStatus = "GREEN";
    if (kpi1_status === "RED" || kpi2_status === "RED" || kpi3_status === "RED") {
        overallStatus = "RED";
    } else if (kpi1_status === "YELLOW") {
        overallStatus = "YELLOW";
    }

    // 3. Construct CSV
    // Columns: projectName, projectKey, weekRef, weekStart, weekEnd, generatedAt, ownerName, area, 
    // topKPI1_name, topKPI1_value, topKPI1_target, topKPI1_status, 
    // topKPI2_name, topKPI2_value, topKPI2_target, topKPI2_status, 
    // topKPI3_name, topKPI3_value, topKPI3_target, topKPI3_status, 
    // mainHighlights, mainIssuesRisks, operationalImpact, actionsNextWeek, dependenciesEscalations, overallStatus

    const header = [
        "projectName", "projectKey", "weekRef", "weekStart", "weekEnd", "generatedAt", "ownerName", "area",
        "topKPI1_name", "topKPI1_value", "topKPI1_target", "topKPI1_status",
        "topKPI2_name", "topKPI2_value", "topKPI2_target", "topKPI2_status",
        "topKPI3_name", "topKPI3_value", "topKPI3_target", "topKPI3_status",
        "mainHighlights", "mainIssuesRisks", "operationalImpact", "actionsNextWeek", "dependenciesEscalations", "overallStatus"
    ].join(",");

    const row = [
        PROJECT_NAME, PROJECT_KEY, weekRef, weekStart, weekEnd, generatedAt, OWNER_NAME, AREA,
        kpi1_name, kpi1_value, kpi1_target, kpi1_status,
        kpi2_name, kpi2_value, kpi2_target, kpi2_status,
        kpi3_name, kpi3_value, kpi3_target, kpi3_status,
        mainHighlights, mainIssuesRisks, operationalImpact, actionsNextWeek, dependenciesEscalations, overallStatus
    ].map(escapeCsv).join(",");

    const csvContent = "\uFEFF" + header + "\n" + row; // Add BOM for Excel support

    // 4. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WK_REPORT_${PROJECT_KEY}_${weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};