
import React from 'react';

interface KpiCardProps {
    icon: string;
    title: string;
    value: string;
    unit?: string;
    color?: string;      // e.g. "text-red-600", "text-green-600"
    highlight?: boolean;
    onClick?: () => void;
    isActive?: boolean;
    calculationLogic?: string; // New prop for calculation explanation
}

const KpiCard: React.FC<KpiCardProps> = ({
    icon,
    title,
    value,
    unit,
    color = 'text-red-600',       // BYD primary accent
    highlight = false,
    onClick,
    isActive = false,
    calculationLogic,
}) => {
    // Decide border/ring based on state
    const borderClasses = (() => {
        if (isActive) {
            // Strong focus state (clicked KPI / drill-down active)
            return 'border-red-600 ring-2 ring-red-200';
        }
        if (highlight) {
            // Important KPI but not currently active
            if (color.includes('red')) return 'border-red-500';
            if (color.includes('amber') || color.includes('yellow')) return 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]';
            return 'border-gray-300';
        }
        return 'border-gray-100';
    })();

    // Value color: use KPI color only when highlight/active, otherwise neutral
    const valueColor = highlight || isActive ? color : 'text-gray-900';

    // Icon color: subtle when neutral, accent when highlight/active
    const iconColor =
        highlight || isActive ? color : 'text-gray-400';

    // Hover/interactive behaviour
    const interactiveClasses = onClick
        ? 'cursor-pointer hover:bg-white/50 transition-all transform hover:-translate-y-1 hover:shadow-2xl'
        : '';

    return (
        <div
            onClick={onClick}
            className={`
                glass p-8 rounded-[2.5rem]
                flex flex-col justify-between
                border-none shadow-glass ${interactiveClasses}
                relative group/card overflow-hidden ring-1 ring-white/50
                animate-in fade-in slide-in-from-bottom-4 duration-500
            `}
        >
            {/* Subtle Texture/Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none group-hover/card:opacity-[0.05] transition-opacity" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`, backgroundSize: '24px 24px' }}></div>
            
            {/* Subtle Gradient Accent */}
            <div className={`absolute top-0 left-0 w-2 h-full opacity-40 ${color.replace('text', 'bg')} transition-all group-hover/card:w-2.5 group-hover/card:opacity-70`} />

            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center w-full">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-[1.25rem] glass-dark mr-5 transition-all group-hover/card:scale-110 shadow-lg ${isActive ? 'bg-indigo-600/20 ring-1 ring-indigo-500/40' : 'ring-1 ring-white/30'}`}>
                        <span className={`material-icons text-3xl ${isActive ? 'text-indigo-600 font-black' : iconColor}`}>
                            {isActive ? 'auto_awesome' : icon}
                        </span>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-[11px] font-black tracking-[0.3em] text-slate-400 group-hover/card:text-slate-600 transition-colors uppercase font-display">
                            {title}
                        </h3>
                        {isActive && (
                            <div className="flex items-center gap-2 mt-2 animate-in slide-in-from-left-2 duration-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.15em] font-display">Active Context</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Info Icon & Tooltip */}
                    {calculationLogic && (
                        <div className="relative group/tooltip ml-2" onClick={(e) => e.stopPropagation()}>
                            <div className="w-6 h-6 rounded-lg glass-dark flex items-center justify-center cursor-help hover:bg-indigo-500/10 transition-colors">
                                <span className="material-icons text-slate-300 text-sm hover:text-indigo-600 transition-colors">
                                    insights
                                </span>
                            </div>
                            <div className="pointer-events-none absolute right-0 bottom-full mb-4 w-64 p-5 glass-dark text-white text-[10px] rounded-[1.5rem] shadow-2xl opacity-0 transition-all translate-y-2 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 z-50 font-medium leading-relaxed ring-1 ring-white/20 backdrop-blur-2xl">
                                <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                                    <span className="material-icons text-xs text-indigo-400">psychology</span>
                                    <span className="font-black text-white/50 uppercase tracking-[0.2em]">Logic Protocol:</span>
                                </div>
                                <span className="block italic text-white/80 leading-relaxed font-bold tracking-tight">
                                    {calculationLogic}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-10 flex items-baseline relative z-10">
                <p className={`text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-tight font-display ${isActive ? 'text-indigo-600' : valueColor} transition-colors`}>
                    {value}
                    {unit && (
                        <span className="ml-2 text-xl font-bold text-slate-400/50 uppercase tracking-[0.1em] font-sans">
                            {unit}
                        </span>
                    )}
                </p>
            </div>

            {highlight && !isActive && (
                <div className="mt-4 flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
                         <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Target Priority</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(KpiCard);
