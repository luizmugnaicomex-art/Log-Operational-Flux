import React from 'react';
import { Shipment, SortConfig } from '../types';
import { currencyFormatter } from '../utils/formatters';

interface ShipmentTableProps {
    shipments: Shipment[];
    sortConfig: SortConfig;
    onSort: (config: SortConfig) => void;
    searchTerm: string;
    onSearch: (term: string) => void;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    subtitle?: string;
}

const TableHeader: React.FC<{
    sortKey: keyof Shipment;
    label: string;
    sortConfig: SortConfig;
    onSort: (config: SortConfig) => void;
}> = ({ sortKey, label, sortConfig, onSort }) => {
    const isSorted = sortConfig.key === sortKey;
    const direction = isSorted ? sortConfig.direction : undefined;

    const handleClick = () => {
        const newDirection =
            isSorted && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        onSort({ key: sortKey, direction: newDirection });
    };

    const icon = isSorted
        ? direction === 'asc'
            ? 'expand_less'
            : 'expand_more'
        : 'unfold_more';

    return (
        <th
            className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer select-none group transition-all"
            onClick={handleClick}
        >
            <span className="flex items-center gap-1">
                {label}
                <span
                    className={`material-icons text-xs transition-opacity ${
                        isSorted
                            ? 'text-indigo-600 opacity-100'
                            : 'text-slate-300 opacity-40 group-hover:opacity-100'
                    }`}
                >
                    {icon}
                </span>
            </span>
        </th>
    );
};

const ShipmentTable: React.FC<ShipmentTableProps> = ({
    shipments,
    sortConfig,
    onSort,
    searchTerm,
    onSearch,
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    subtitle,
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);

    const formatDate = (date: Date | null) =>
        date ? date.toLocaleDateString() : 'N/A';

    return (
        <div className="glass rounded-[2rem] shadow-glass border-none overflow-hidden ring-1 ring-white/40">
            {/* Header + search */}
            <div className="p-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="w-full sm:w-auto">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">
                        Manifest Analytics
                    </h3>
                    {subtitle && (
                        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1.5 opacity-80">
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="relative w-full sm:w-80">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        search
                    </span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => {
                            onSearch(e.target.value);
                            onPageChange(1);
                        }}
                        placeholder="Search manifest..."
                        className="pl-12 pr-6 py-3.5 w-full glass-dark rounded-2xl text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/20">
                    <thead className="glass-dark border-y border-white/20">
                        <tr>
                            <TableHeader
                                sortKey="containerNumber"
                                label="Unit ID"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="shipper"
                                label="Shipper"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="carrier"
                                label="Carrier"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="vesselName"
                                label="Voyage"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="containerType"
                                label="Size"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="incoterm"
                                label="Term"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="madeRomaneio"
                                label="Romaneio"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="cargo"
                                label="Commodity"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="ata"
                                label="ATA Ref"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="deliveryByd"
                                label="Fctry ETA"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="clientDeliveryVariance"
                                label="Var (d)"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="totalClearanceTime"
                                label="Clearance"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="detentionRisk"
                                label="FreeTime"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                            <TableHeader
                                sortKey="demurrageCost"
                                label="Accumulation"
                                sortConfig={sortConfig}
                                onSort={onSort}
                            />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {shipments.length > 0 ? (
                            shipments.map((s, index) => {
                                const variance = s.clientDeliveryVariance;
                                let varianceClass = 'text-slate-700';
                                if (variance !== null) {
                                    varianceClass =
                                        variance > 0
                                            ? 'text-rose-600 font-black'
                                            : 'text-emerald-600 font-black';
                                }

                                const detentionRisk = s.detentionRisk;
                                let detentionRiskClass = 'text-slate-700';
                                if (detentionRisk !== null) {
                                    detentionRiskClass =
                                        detentionRisk > 0
                                            ? 'text-rose-600 font-black'
                                            : 'text-emerald-600 font-black';
                                }

                                return (
                                    <tr
                                        key={index}
                                        className="hover:bg-white/40 transition-colors group"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900 font-black tracking-tight">
                                            {s.containerNumber || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                                            {s.shipper}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                            {s.carrier}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {s.vesselName || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-bold">
                                            {s.containerType || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-black">
                                            {s.incoterm || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                                            <span className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ring-1 ring-inset ${
                                                s.madeRomaneio === 'YES' || s.madeRomaneio === 'LCL'
                                                    ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-700 ring-amber-500/20'
                                            }`}>
                                                {s.madeRomaneio || 'PENDING'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {s.cargo}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {formatDate(s.ata)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {formatDate(s.deliveryByd)}
                                        </td>
                                        <td
                                            className={`px-6 py-4 whitespace-nowrap text-xs ${varianceClass}`}
                                        >
                                            {variance !== null
                                                ? variance > 0
                                                    ? `+${variance}`
                                                    : variance
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-bold text-center">
                                            {s.totalClearanceTime ?? '-'}
                                        </td>
                                        <td
                                            className={`px-6 py-4 whitespace-nowrap text-xs ${detentionRiskClass} text-center`}
                                        >
                                            {detentionRisk !== null
                                                ? detentionRisk > 0
                                                    ? `+${detentionRisk}`
                                                    : detentionRisk
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-800 font-black">
                                            {s.demurrageCost > 0
                                                ? currencyFormatter.format(
                                                      s.demurrageCost
                                                  )
                                                : '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={14}
                                    className="text-center py-16 text-xs text-slate-400 font-medium italic"
                                >
                                    No records found matching your current matrix settings.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <nav
                className="p-8 flex items-center justify-between border-t border-white/20 glass-dark"
                aria-label="Pagination"
            >
                <div className="hidden sm:block">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Index{' '}
                        <span className="text-slate-800">
                            {totalItems > 0 ? startItem : 0}
                        </span>{' '}
                        —{' '}
                        <span className="text-slate-800">
                            {totalItems > 0 ? endItem : 0}
                        </span>{' '}
                        of{' '}
                        <span className="text-slate-800">{totalItems}</span>{' '}
                        Units
                    </p>
                </div>
                <div className="flex-1 flex justify-between sm:justify-end gap-3">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="glass px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all ring-1 ring-white/50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="glass px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all ring-1 ring-white/50"
                    >
                        Next
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default React.memo(ShipmentTable);
