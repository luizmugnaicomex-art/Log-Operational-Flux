import React from 'react';

interface DashboardFiltersProps {
    carriers: string[];
    shipowners?: string[];
    analysts: string[];
    cargos: string[];
    containerTypes: string[];
    incoterms: string[];
    romaneioStatuses: string[];
    years: number[];
    selectedCarriers: string[];
    selectedShipowners?: string[];
    selectedAnalysts: string[];
    selectedCargos: string[];
    selectedContainerTypes: string[];
    selectedIncoterms: string[];
    selectedRomaneioStatuses: string[];
    selectedYear: string;
    selectedPeriod: string;
    selectedMonth: string;
    onCarrierChange: (carriers: string[]) => void;
    onShipownerChange?: (shipowners: string[]) => void;
    onAnalystChange: (analysts: string[]) => void;
    onCargoChange: (cargos: string[]) => void;
    onContainerTypeChange: (types: string[]) => void;
    onIncotermChange: (incoterms: string[]) => void;
    onRomaneioStatusChange: (statuses: string[]) => void;
    onYearChange: (year: string) => void;
    onPeriodChange: (period: string) => void;
    onMonthChange: (month: string) => void;
    onReset: () => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
    carriers = [],
    shipowners = [],
    analysts = [],
    cargos = [],
    containerTypes = [],
    incoterms = [],
    romaneioStatuses = [],
    years = [],
    selectedCarriers = [],
    selectedShipowners = [],
    selectedAnalysts = [],
    selectedCargos = [],
    selectedContainerTypes = [],
    selectedIncoterms = [],
    selectedRomaneioStatuses = [],
    selectedYear = 'all',
    selectedPeriod = 'all',
    selectedMonth = 'all',
    onCarrierChange,
    onShipownerChange,
    onAnalystChange,
    onCargoChange,
    onContainerTypeChange,
    onIncotermChange,
    onRomaneioStatusChange,
    onYearChange,
    onPeriodChange,
    onMonthChange,
    onReset,
}) => {
    const handleMultiSelectChange = (
        e: React.ChangeEvent<HTMLSelectElement>,
        setter: (values: string[]) => void
    ) => {
        if (!e.target.selectedOptions) return;
        const options = Array.from(
            e.target.selectedOptions,
            (option: HTMLOptionElement) => option.value
        );
        setter(options);
    };

    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];

    const selectBaseClasses =
        'w-full rounded-2xl border border-white/20 shadow-inner text-[11px] font-bold focus:border-indigo-400 focus:ring-8 focus:ring-indigo-500/5 glass-dark text-slate-700 px-4 py-3 outline-none transition-all appearance-none cursor-pointer hover:bg-white/10 group-hover:ring-white/40 ring-1 ring-transparent';

    // Count how many filters are effectively active with null safety
    const activeFiltersCount =
        (Array.isArray(selectedCarriers) && selectedCarriers.length ? 1 : 0) +
        (Array.isArray(selectedShipowners) && selectedShipowners.length ? 1 : 0) +
        (Array.isArray(selectedAnalysts) && selectedAnalysts.length ? 1 : 0) +
        (Array.isArray(selectedCargos) && selectedCargos.length ? 1 : 0) +
        (Array.isArray(selectedContainerTypes) && selectedContainerTypes.length ? 1 : 0) +
        (Array.isArray(selectedIncoterms) && selectedIncoterms.length ? 1 : 0) +
        (Array.isArray(selectedRomaneioStatuses) && selectedRomaneioStatuses.length ? 1 : 0) +
        (selectedYear !== 'all' ? 1 : 0) +
        (selectedPeriod !== 'all' && selectedYear !== 'all' ? 1 : 0) +
        (selectedMonth !== 'all' ? 1 : 0);

    return (
        <div className="glass p-10 md:p-12 rounded-[3.5rem] mb-12 border-none ring-1 ring-white/30 shadow-glass">
            {/* Top bar: title + active filters + reset */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-12">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="p-3 glass-dark rounded-2xl ring-1 ring-white/40 shadow-sm">
                            <span className="material-icons text-indigo-600 text-xl">
                                filter_list
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-[-0.04em]">
                            Parameter <span className="text-indigo-600">Sync</span>
                        </h2>
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-4 opacity-70">
                        Adjust data perspective across all operational dimensions
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="inline-flex items-center rounded-2xl glass-dark px-6 py-3 text-[10px] text-slate-600 font-black uppercase tracking-widest ring-1 ring-white/40 shadow-inner">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-3 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse"></span>
                        {activeFiltersCount > 0 ? (
                            <>
                                <span className="mr-1 text-slate-900 leading-none">
                                    {activeFiltersCount}
                                </span>
                                Applied
                            </>
                        ) : (
                            'Optimal Default'
                        )}
                    </div>

                    <button
                        onClick={onReset}
                        className="inline-flex items-center px-8 py-3 glass rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 hover:bg-white/60 transition-all shadow-lg ring-1 ring-white/60 hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <span className="material-icons mr-2 text-base">
                            restart_alt
                        </span>
                        Clear Workspace
                    </button>
                </div>
            </div>

            {/* Time filters row */}
            <div className="mb-12 grid grid-cols-1 sm:grid-cols-3 gap-10">
                <div>
                    <label
                        htmlFor="yearFilter"
                        className="block text-[9px] uppercase font-black tracking-[0.3em] text-slate-400 mb-3 px-1 ml-1"
                    >
                        Temporal Scope
                    </label>
                    <div className="relative group">
                        <select
                            id="yearFilter"
                            value={selectedYear}
                            onChange={e => {
                                onYearChange(e.target.value);
                                if (e.target.value === 'all') {
                                    onPeriodChange('all');
                                }
                            }}
                            className={selectBaseClasses}
                        >
                            <option value="all">Unfiltered View (Global Time)</option>
                            {(years || []).map(y => (
                                <option key={y} value={y}>
                                    Fiscal Year {y}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <span className="material-icons text-sm opacity-40">expand_more</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="periodFilter"
                        className="block text-[9px] uppercase font-black tracking-[0.3em] text-slate-400 mb-3 px-1 ml-1"
                    >
                        Cycle Periodicity
                    </label>
                    <div className="relative group">
                        <select
                            id="periodFilter"
                            value={selectedPeriod}
                            onChange={e => onPeriodChange(e.target.value)}
                            disabled={selectedYear === 'all'}
                            className={`${selectBaseClasses} disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                            <option value="all">Annual Aggregate</option>
                            <option value="H1">Semester 1 (Jan-Jun)</option>
                            <option value="H2">Semester 2 (Jul-Dec)</option>
                            <optgroup label="Quarterly Benchmarks">
                                <option value="Q1">Quarter 1 (Q1)</option>
                                <option value="Q2">Quarter 2 (Q2)</option>
                                <option value="Q3">Quarter 3 (Q3)</option>
                                <option value="Q4">Quarter 4 (Q4)</option>
                            </optgroup>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <span className="material-icons text-sm opacity-40">date_range</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="monthFilter"
                        className="block text-[9px] uppercase font-black tracking-[0.3em] text-slate-400 mb-3 px-1 ml-1"
                    >
                        Specific Month
                    </label>
                    <div className="relative group">
                        <select
                            id="monthFilter"
                            value={selectedMonth}
                            onChange={e => onMonthChange(e.target.value)}
                            className={selectBaseClasses}
                        >
                            <option value="all">Full Temporal Stack</option>
                            {months.map((m, index) => (
                                <option key={index} value={index}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <span className="material-icons text-sm opacity-40">schedule</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Entity filters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                {[
                    { id: 'shipownerFilter', label: 'Shipowner / Armador', list: shipowners || [], selected: selectedShipowners || [], change: onShipownerChange || (() => {}) },
                    { id: 'carrierFilter', label: 'Carrier Network', list: carriers || [], selected: selectedCarriers || [], change: onCarrierChange },
                    { id: 'analystFilter', label: 'Analyst Group', list: analysts || [], selected: selectedAnalysts || [], change: onAnalystChange },
                    { id: 'cargoFilter', label: 'Commodity Type', list: cargos || [], selected: selectedCargos || [], change: onCargoChange },
                    { id: 'containerTypeFilter', label: 'Equipment Spec', list: containerTypes || [], selected: selectedContainerTypes || [], change: onContainerTypeChange },
                    { id: 'incotermFilter', label: 'Agreement Type', list: incoterms || [], selected: selectedIncoterms || [], change: onIncotermChange },
                    { id: 'romaneioFilter', label: 'Flow Status', list: romaneioStatuses || [], selected: selectedRomaneioStatuses || [], change: onRomaneioStatusChange },
                ].map(filter => (
                    <div key={filter.id} className="group/filter">
                        <label
                            htmlFor={filter.id}
                            className="block text-[9px] uppercase font-black tracking-[0.3em] text-slate-400 mb-4 px-1 ml-1 group-hover/filter:text-indigo-600 transition-colors"
                        >
                            {filter.label}
                        </label>
                        <select
                            id={filter.id}
                            multiple
                            value={filter.selected}
                            onChange={e => handleMultiSelectChange(e, filter.change)}
                            className={`${selectBaseClasses} scrollbar-hide py-4 px-2`}
                            style={{ height: '140px' }}
                        >
                            {(filter.list || []).map(item => (
                                <option key={item} value={item} className="p-2 px-3 mb-1.5 rounded-xl font-bold checked:bg-indigo-600 checked:text-white hover:bg-white/20 transition-all text-[10px] uppercase tracking-wider">
                                    {item}
                                </option>
                            ))}
                        </select>
                        {Array.isArray(filter.selected) && filter.selected.length > 0 && (
                            <div className="mt-4 text-[9px] font-black text-indigo-600 glass px-3 py-1.5 rounded-xl inline-flex items-center gap-2 ring-1 ring-indigo-100 shadow-sm animate-in zoom-in-50">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                {filter.selected.length} FILTERED
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default React.memo(DashboardFilters);