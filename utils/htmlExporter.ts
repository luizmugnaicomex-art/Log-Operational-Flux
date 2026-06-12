export interface ExportData {
  terminalStocks: Record<string, number>;
  carrierVessels: Array<{ carrier: string; vessel: string; count: number; status: string }>;
  capacityProjection: { capacity: number; current: number; planned: number };
  momDetails: {
    subject: string;
    date: string;
    attendees: string;
    summary: string;
    actions: Array<{ task: string; owner: string; deadline: string; status: string }>;
  };
  containers: Array<{
    number: string;
    carrier: string;
    vessel: string;
    terminal: string;
    type: string;
    status: string;
  }>;
}

export const generateHtmlFile = (data: ExportData): string => {
  const containerJson = JSON.stringify(data.containers, null, 2);
  const momActionsJson = JSON.stringify(data.momDetails.actions, null, 2);
  const carrierVesselsJson = JSON.stringify(data.carrierVessels, null, 2);
  const terminalStocksJson = JSON.stringify(data.terminalStocks, null, 2);
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estoque de Terminais & Planeamento de Chegadas</title>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <!-- Tailwind CSS Play CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        byd: {
                            blue: '#002060', // BRAND DARK BLUE
                            red: '#E20613',  // CORPORATE RED
                            gray: '#4A5568'
                        },
                        msc: {
                            gold: '#FFB800', // GOLD/ORANGE ACCENT
                            dark: '#D47E00'
                        }
                    }
                }
            }
        }
    </script>
    <style>
        .slide-transition {
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }
        .toast {
            transition: opacity 0.3s, transform 0.3s;
        }
    </style>
</head>
<body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100">

    <!-- HEADER / CONTROL NAVIGATION -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-[100] transition-colors dark:bg-slate-800 dark:border-slate-700 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-byd-blue text-white rounded-lg flex items-center justify-center font-black text-lg shadow-md ring-1 ring-white/20 dark:bg-byd-red">
                    BYD
                </div>
                <div>
                    <h1 class="text-lg font-black tracking-tight text-byd-blue dark:text-white">BYD Supply Chain Brasil</h1>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Estoque de Terminais & Planeamento</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                <nav class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl dark:bg-slate-700/50">
                    <button onclick="switchTab('slides')" id="tab-btn-slides" class="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors bg-white text-byd-blue shadow-sm dark:bg-slate-800 dark:text-white">
                        PPT Slides
                    </button>
                    <button onclick="switchTab('mom')" id="tab-btn-mom" class="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                        China MOM (会议纪要)
                    </button>
                    <button onclick="switchTab('database')" id="tab-btn-database" class="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                        Carga DB
                    </button>
                </nav>
                
                <!-- Theme Toggle Button -->
                <button onclick="toggleDarkMode()" class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Toggle theme">
                    <!-- Sun Icon -->
                    <svg id="sun-icon" class="w-4 h-4 text-amber-500 dark:hidden" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    <!-- Moon Icon -->
                    <svg id="moon-icon" class="w-4 h-4 text-indigo-400 hidden dark:block" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                </button>
            </div>
        </div>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <!-- SECTION 1: APRESENTAÇÃO DE SLIDES (PPT) -->
        <section id="sec-slides" class="space-y-6">
            <div class="flex justify-between items-center bg-slate-200/50 p-4 rounded-2xl dark:bg-slate-800/50">
                <span class="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Slideshow Presentation Mode</span>
                <div class="flex items-center gap-1.5">
                    <button onclick="prevSlide()" class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg shadow-sm transition-all check-disabled active:scale-95">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span id="slide-indicator" class="text-xs font-bold font-mono px-3 text-byd-blue dark:text-slate-300">Slide 1 / 5</span>
                    <button onclick="nextSlide()" class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg shadow-sm transition-all check-disabled active:scale-95">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            <!-- Slides viewport container -->
            <div class="relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 min-h-[500px] flex flex-col justify-between">
                
                <div class="relative flex-1 overflow-hidden">
                    <!-- Slide 1: Cover -->
                    <div id="slide-1" class="absolute inset-0 p-12 flex flex-col justify-between slide-transition">
                        <div class="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-700">
                            <span class="text-xs font-bold text-byd-red dark:text-red-400 tracking-wider">BYD SUPPLY CHAIN BRASIL</span>
                            <span class="text-[10px] font-bold text-slate-400">WEEKLY REPORT</span>
                        </div>
                        <div class="my-auto space-y-4">
                            <div class="inline-block bg-byd-blue text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full dark:bg-byd-red shadow-sm">
                                Diagnóstico Corporativo
                            </div>
                            <h2 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 dark:text-white leading-[1.15]">
                                Diagnóstico Integrado: <br>
                                <span class="bg-gradient-to-r from-byd-blue to-blue-500 bg-clip-text text-transparent dark:from-red-400 dark:to-orange-400">Estoque de Terminais & Planeamento de Chegadas</span>
                            </h2>
                            <p class="text-slate-400 font-medium text-sm max-w-2xl leading-relaxed">
                                Integração dinâmica de pátio, monitoramento inter-parques de estoque e visualização física bilingue de cargas CMA CGM e MSC para o comitê executivo.
                            </p>
                        </div>
                        <div class="flex justify-between items-end border-t pt-4 border-slate-100 dark:border-slate-700">
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <div>DIRETORIA DE OPERAÇÕES LOGÍSTICAS</div>
                                <div class="opacity-70">BYD BRASIL SUPPLY CHAIN DIVISION</div>
                            </div>
                            <div class="text-xs font-bold text-slate-300 dark:text-slate-600 font-mono">2026</div>
                        </div>
                    </div>

                    <!-- Slide 2: Terminal Stock -->
                    <div id="slide-2" class="absolute inset-0 p-12 flex flex-col justify-between slide-transition translate-x-full opacity-0 pointer-events-none">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-byd-red uppercase tracking-wider">Estoque Atual por Terminal</span>
                            <span class="text-[10px] font-bold text-slate-400">SLIDE 2 OF 5</span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 my-auto">
                            <!-- Card TECON -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between shadow-sm min-h-[220px]">
                                <div>
                                    <div class="flex items-center justify-between">
                                        <h3 class="font-black text-slate-800 dark:text-white tracking-tight">TECON Alfandegado</h3>
                                        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    </div>
                                    <p class="text-slate-450 dark:text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest">Estoque Principal</p>
                                </div>
                                <div class="mt-4">
                                    <div class="text-4xl font-extrabold text-byd-blue dark:text-blue-400 font-mono" id="stock-tecon">${data.terminalStocks.TECON}</div>
                                    <span class="text-[10px] text-slate-400 font-bold">CONTÊINERES EM PÁTIO</span>
                                </div>
                            </div>
                            
                            <!-- Card TPC -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between shadow-sm min-h-[220px]">
                                <div>
                                    <h3 class="font-black text-slate-800 dark:text-white tracking-tight text-base">TPC Logística</h3>
                                    <p class="text-slate-450 dark:text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest">Estrutura Secundária</p>
                                </div>
                                <div class="mt-4">
                                    <div class="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono" id="stock-tpc">${data.terminalStocks.TPC}</div>
                                    <span class="text-[10px] text-slate-400 font-bold">CONTÊINERES EM PÁTIO</span>
                                </div>
                            </div>
                            
                            <!-- Card INTERMARITIMA -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between shadow-sm min-h-[220px]">
                                <div>
                                    <h3 class="font-black text-slate-800 dark:text-white tracking-tight text-base">INTERMARITIMA</h3>
                                    <p class="text-slate-450 dark:text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest">Arco Multimodal</p>
                                </div>
                                <div class="mt-4">
                                    <div class="text-4xl font-extrabold text-[#0ea5e9] dark:text-[#38bdf8] font-mono" id="stock-intermaritima">${data.terminalStocks.INTERMARITIMA}</div>
                                    <span class="text-[10px] text-slate-400 font-bold">CONTÊINERES EM PÁTIO</span>
                                </div>
                            </div>
                        </div>

                        <div class="text-[10px] text-slate-400 font-bold">
                            Nota: Dados atualizados de pátio em tempo real com base nos logs importados.
                        </div>
                    </div>

                    <!-- Slide 3: Carrier Details -->
                    <div id="slide-3" class="absolute inset-0 p-12 flex flex-col justify-between slide-transition translate-x-full opacity-0 pointer-events-none">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-byd-red uppercase tracking-wider">Status das Cargas por Armador (Carrier Status)</span>
                            <span class="text-[10px] font-bold text-slate-400">SLIDE 3 OF 5</span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto">
                            <!-- CMA CGM Pane -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30">
                                <div class="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-200">
                                            CMA
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800 dark:text-white">CMA CGM Line</h4>
                                            <p class="text-[9px] text-slate-400 font-bold">ARMADOR FRANCÊS</p>
                                        </div>
                                    </div>
                                    <span id="cma-vessel-summary" class="text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-3 py-1 rounded-full font-mono">---</span>
                                </div>
                                <div class="mt-4 space-y-3" id="cma-vessel-list">
                                    <!-- Dynamic content added by script -->
                                </div>
                            </div>
                            
                            <!-- MSC Pane -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-950/20">
                                <div class="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-full bg-msc-gold text-slate-900 flex items-center justify-center font-extrabold text-xs ring-2 ring-amber-100">
                                            MSC
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800 dark:text-white">MSC Mediterranean Line</h4>
                                            <p class="text-[9px] text-slate-400 font-bold">ARMADOR SUIÇO</p>
                                        </div>
                                    </div>
                                    <span id="msc-vessel-summary" class="text-xs font-black bg-amber-105 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1 rounded-full font-mono">---</span>
                                </div>
                                <div class="mt-4 space-y-3" id="msc-vessel-list">
                                    <!-- Dynamic content added by script -->
                                </div>
                            </div>
                        </div>

                        <div class="text-[10px] text-slate-400 font-bold">
                            Nota: Detalhamento dinâmico de conexões marítimas estimadas por navio-mãe.
                        </div>
                    </div>

                    <!-- Slide 4: Real Destination -->
                    <div id="slide-4" class="absolute inset-0 p-12 flex flex-col justify-between slide-transition translate-x-full opacity-0 pointer-events-none">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-byd-red uppercase tracking-wider">Destinação Planejada por Armazém (Bonded Warehouse)</span>
                            <span class="text-[10px] font-bold text-slate-400">SLIDE 4 OF 5</span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 my-auto">
                            <!-- TECON destination -->
                            <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                <span class="text-[9px] font-black uppercase text-indigo-500 tracking-wider">TECON S.A.</span>
                                <h4 class="text-xl font-extrabold text-slate-850 dark:text-white mt-1" id="dest-tecon">---</h4>
                                <p class="text-[10px] text-slate-400 mt-2 font-medium">Contêineres destinados</p>
                                <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div class="bg-indigo-600 h-full rounded-full" style="width: 75%"></div>
                                </div>
                            </div>
                            
                            <!-- TPC destination -->
                            <div class="bg-pink-50/50 dark:bg-pink-950/20 p-5 rounded-2xl border border-pink-100 dark:border-pink-900/30">
                                <span class="text-[9px] font-black uppercase text-pink-500 tracking-wider">TPC OPERADOR</span>
                                <h4 class="text-xl font-extrabold text-slate-850 dark:text-white mt-1" id="dest-tpc">---</h4>
                                <p class="text-[10px] text-slate-400 mt-2 font-medium">Contêineres destinados</p>
                                <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div class="bg-pink-500 h-full rounded-full" style="width: 40%"></div>
                                </div>
                            </div>

                            <!-- INTERMARITIMA -->
                            <div class="bg-sky-50/50 dark:bg-sky-950/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-900/30">
                                <span class="text-[9px] font-black uppercase text-sky-500 tracking-wider">INTERMARITIMA</span>
                                <h4 class="text-xl font-extrabold text-slate-850 dark:text-white mt-1" id="dest-inter">---</h4>
                                <p class="text-[10px] text-slate-400 mt-2 font-medium">Contêineres destinados</p>
                                <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div class="bg-sky-500 h-full rounded-full" style="width: 30%"></div>
                                </div>
                            </div>

                            <!-- CLIA / OUTERS -->
                            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                <span class="text-[9px] font-black uppercase text-emerald-500 tracking-wider">CLIA EMPÓRIO & OUTROS</span>
                                <h4 class="text-xl font-extrabold text-slate-850 dark:text-white mt-1" id="dest-clia">---</h4>
                                <p class="text-[10px] text-slate-400 mt-2 font-medium">Contêineres destinados</p>
                                <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div class="bg-emerald-500 h-full rounded-full" style="width: 15%"></div>
                                </div>
                            </div>
                        </div>

                        <div class="text-[10px] text-slate-400 font-bold flex justify-between">
                            <span>Distribuição percentual baseada no planejamento de manifesto.</span>
                            <span class="text-byd-blue dark:text-slate-300 font-mono">100% Mapped</span>
                        </div>
                    </div>

                    <!-- Slide 5: Yard Projection -->
                    <div id="slide-5" class="absolute inset-0 p-12 flex flex-col justify-between slide-transition translate-x-full opacity-0 pointer-events-none">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-byd-red uppercase tracking-wider">Metas e Projeção de Capacidade de Pátio (Projection Yard)</span>
                            <span class="text-[10px] font-bold text-slate-400">SLIDE 5 OF 5</span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto">
                            <!-- Math sequence and chart -->
                            <div class="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl md:col-span-2 space-y-4">
                                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Projeção Dinâmica de Ocupação</h4>
                                <div class="flex flex-col sm:flex-row items-center gap-4 justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <div class="text-center sm:text-left">
                                        <div class="text-xs font-bold text-slate-405">Estoque Atual</div>
                                        <div class="text-2xl font-black text-slate-800 dark:text-white" id="math-current">---</div>
                                    </div>
                                    <div class="text-lg font-bold text-slate-300">+</div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-xs font-bold text-slate-405">Cargas a Caminho</div>
                                        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400" id="math-transit">---</div>
                                    </div>
                                    <div class="text-lg font-bold text-slate-300">=</div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-xs font-bold text-slate-405">Estoque Projetado</div>
                                        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400" id="math-projected">---</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Speedometer-like panel -->
                            <div class="bg-emerald-55/10 dark:bg-emerald-950/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-between">
                                <div>
                                    <span class="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">CAPACIDADE DO SISTEMA</span>
                                    <h4 class="text-lg font-extrabold text-slate-800 dark:text-white mt-1">Status do Pátio</h4>
                                </div>
                                <div class="py-3">
                                    <div class="text-4xl font-extrabold text-slate-850 dark:text-white font-mono" id="limit-total">${data.capacityProjection.capacity}</div>
                                    <p class="text-[10px] text-slate-400 font-bold uppercase">CAPACIDADE MÁXIMA (TEUs)</p>
                                </div>
                                <div>
                                    <div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                        <span>Utilização Projetada</span>
                                        <span id="proj-pct">--%</span>
                                    </div>
                                    <div class="w-full bg-slate-200 dark:bg-slate-705 h-2 rounded-full overflow-hidden">
                                        <div class="bg-emerald-550 h-full rounded-full" id="proj-bar" style="width: 0%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="text-[10px] text-slate-400 font-bold">
                            Alerta de Capacidade: Pátio opera de acordo com parâmetros seguros da diretoria.
                        </div>
                    </div>
                </div>

                <!-- Footer slide control dots -->
                <div class="bg-slate-50 dark:bg-slate-800/80 px-12 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="text-[10px] font-semibold text-slate-400">BYD BRASIL SUPPLY CHAIN SUITE</div>
                    <div class="flex items-center gap-1.5" id="slide-dots">
                        <!-- Instantiated dynamically -->
                    </div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Bilingue PPT</div>
                </div>
            </div>
        </section>

        <!-- SECTION 2: ATA DE REUNIÃO EXECUTIVA (MOM) -->
        <section id="sec-mom" class="hidden space-y-6">
            <div class="bg-white dark:bg-slate-800 rounded-3xl p-10 shadow-xl border border-slate-150 dark:border-slate-700 space-y-8">
                
                <!-- MOM Header Banner in Corporation style -->
                <div class="border-l-8 border-byd-red pl-6 py-2">
                    <h2 class="text-2xl font-black text-slate-850 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <span>会议纪要 / Minutes of Meeting</span>
                        <span class="text-xs bg-byd-red/10 text-byd-red px-3 py-1 rounded-full font-black">BIYADI STYLE</span>
                    </h2>
                    <p class="text-slate-400 dark:text-slate-400 text-xs font-semibold mt-1">BYD SUPPLY CHAIN BRASIL & PARTNERS COLLABORATION</p>
                </div>

                <!-- MOM Details Box -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div>
                        <span class="text-[10px] uppercase font-black text-slate-400 block tracking-widest">会议主题 / Subject</span>
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1" id="mom-subject">${data.momDetails.subject}</p>
                    </div>
                    <div>
                        <span class="text-[10px] uppercase font-black text-slate-400 block tracking-widest">会议日期 / Date</span>
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono" id="mom-date">${data.momDetails.date}</p>
                    </div>
                    <div>
                        <span class="text-[10px] uppercase font-black text-slate-400 block tracking-widest">参会人员 / Attendees</span>
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1" id="mom-attendees">${data.momDetails.attendees}</p>
                    </div>
                </div>

                <!-- Executive Summary in PT/ZH -->
                <div class="space-y-3">
                    <h3 class="text-sm font-black text-byd-blue dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                        <span>会议概要 / Executive Summary</span>
                    </h3>
                    <div class="bg-slate-50 dark:bg-slate-750 p-6 rounded-2xl leading-relaxed text-sm text-slate-650 dark:text-slate-300 space-y-3 border border-slate-100 dark:border-slate-700">
                        <p id="mom-summary" class="whitespace-pre-line">${data.momDetails.summary}</p>
                    </div>
                </div>

                <!-- Action Items bilingue table -->
                <div class="space-y-4">
                    <h3 class="text-sm font-black text-byd-blue dark:text-blue-400 uppercase tracking-wider">具体行动计划 / Action Task Management</h3>
                    <div class="overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-700">
                        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead class="bg-slate-50 dark:bg-slate-800/80">
                                <tr>
                                    <th class="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-wider">具体任务 / Action Task</th>
                                    <th class="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-wider">负责人 / Owner</th>
                                    <th class="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-wider">截止日期 / Deadline</th>
                                    <th class="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-wider">状态 / Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-150 dark:divide-slate-700 bg-white dark:bg-slate-800" id="mom-action-tbody">
                                <!-- Instantiated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        <!-- SECTION 3: EXPLORADOR DE CARGA DETALHADO (DATABASE) -->
        <section id="sec-database" class="hidden space-y-6">
            <div class="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-700 space-y-6">
                
                <div>
                    <h2 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">智能货物浏览器 / Container Freight Explorer</h2>
                    <p class="text-slate-405 text-xs font-semibold">Consolidação e busca instantânea de contêineres do banco de dados unificado.</p>
                </div>

                <!-- Live search and filters -->
                <div class="bg-slate-50 dark:bg-slate-750 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-4">
                    
                    <!-- Search input -->
                    <div class="flex flex-col gap-1 sm:col-span-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">快捷搜索 / Container Search</label>
                        <input type="text" id="db-search" oninput="applyFilters()" placeholder="Código, Bl, Navio..." class="px-4 py-2.5 bg-white dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-byd-blue focus:outline-none dark:text-white transition-all">
                    </div>

                    <!-- Carrier Select -->
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">船东 / Carrier</label>
                        <select id="filter-carrier" onchange="applyFilters()" class="px-4 py-2.5 bg-white dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-byd-blue focus:outline-none dark:text-white">
                            <option value="ALL">ALL CARRIERS</option>
                            <option value="CMA CGM">CMA CGM</option>
                            <option value="MSC">MSC</option>
                        </select>
                    </div>

                    <!-- Vessel Select -->
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">船名 / Mother Vessel</label>
                        <select id="filter-vessel" onchange="applyFilters()" class="px-4 py-2.5 bg-white dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-byd-blue focus:outline-none dark:text-white">
                            <option value="ALL">ALL VESSELS</option>
                            <!-- Dynamically populated -->
                        </select>
                    </div>

                    <!-- Destination Select -->
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">提货港口 / Destination</label>
                        <select id="filter-terminal" onchange="applyFilters()" class="px-4 py-2.5 bg-white dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-byd-blue focus:outline-none dark:text-white">
                            <option value="ALL">ALL DESTINATIONS</option>
                            <option value="TECON">TECON</option>
                            <option value="TPC">TPC</option>
                            <option value="INTERMARITIMA">INTERMARITIMA</option>
                            <option value="CLIA">CLIA EMPORIO</option>
                        </select>
                    </div>
                </div>

                <!-- Dynamic Counter indicator -->
                <div class="flex justify-between items-center text-xs text-slate-500 font-bold">
                    <div>
                        已选中货物数量 / Filtered: 
                        <span id="filtered-count" class="font-bold text-byd-blue dark:text-blue-400 font-mono text-sm bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full ml-1">0</span>
                        <span class="opacity-50 font-medium ml-2">de <span id="total-count">0</span> TEUs</span>
                    </div>
                </div>

                <!-- Main database Table -->
                <div class="overflow-x-auto rounded-3xl border border-slate-150 dark:border-slate-700 shadow-inner">
                    <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                        <thead class="bg-slate-50 dark:bg-slate-800/80">
                            <tr>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">箱号 / Container</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">提单号 / B.Lading</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">船东 / Carrier</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">箱型 / Type</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">母船 / Mother Vessel</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">目的港 / Terminal</th>
                                <th class="px-5 py-4 text-left font-black uppercase text-slate-500 tracking-wider">当前状态 / Status</th>
                            </tr>
                        </thead>
                        <tbody id="db-tbody" class="divide-y divide-slate-150 dark:divide-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px] leading-relaxed">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </main>

    <!-- FOOTER STATUS BRAND -->
    <footer class="bg-slate-100 border-t border-slate-200 py-6 transition-colors dark:bg-transparent dark:border-slate-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
            <div>
                © 2026 BYD BRASIL SUPPLY CHAIN INTEGRATED SYSTEM
            </div>
            <div class="flex items-center gap-3">
                <span class="text-byd-red dark:text-red-400">深圳市比亚迪股份有限公司</span>
                <span class="opacity-50">v4.2 PRO</span>
            </div>
        </div>
    </footer>

    <!-- TOAST MODAL NOTIFICATION -->
    <div id="toast" class="toast fixed bottom-6 right-6 z-[200] opacity-0 pointer-events-none translate-y-3 bg-slate-900 border border-slate-850 text-white dark:bg-white dark:text-slate-900 shadow-xl px-5 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider">
        <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></span>
        <span id="toast-msg">Database loaded and synchronised!</span>
    </div>

    <!-- MAIN JAVASCRIPT CONTROLLERS -->
    <script>
        // Loaded datasets from parameters
        const globalContainerData = ${containerJson};
        const globalMomActions = ${momActionsJson};
        const carrierVessels = ${carrierVesselsJson};
        const terminalStocks = ${terminalStocksJson};

        // UI State
        let activeTab = 'slides';
        let currentSlide = 1;

        // On document load and initial configurations
        window.addEventListener('load', () => {
            initDatabaseFilters();
            renderMomActions();
            renderDynamicSlides();
            applyFilters();
            
            // System auto detection for system dark mode
            if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            updateThemeIcons();
            showToast("DATASET AUTO-COMPILED & ACTIVE");
        });

        // Toggle dark and light mode
        function toggleDarkMode() {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            }
            updateThemeIcons();
            showToast(document.documentElement.classList.contains('dark') ? "DARK THEME ACTIVATED" : "LIGHT THEME ACTIVATED");
        }

        function updateThemeIcons() {
            const sun = document.getElementById('sun-icon');
            const moon = document.getElementById('moon-icon');
            if (document.documentElement.classList.contains('dark')) {
                sun?.classList.add('hidden');
                moon?.classList.remove('hidden');
            } else {
                sun?.classList.remove('hidden');
                moon?.classList.add('hidden');
            }
        }

        // Switch main operational Tabs
        function switchTab(tabId) {
            activeTab = tabId;
            const tabs = ['slides', 'mom', 'database'];
            
            tabs.forEach(t => {
                const sec = document.getElementById('sec-' + t);
                const btn = document.getElementById('tab-btn-' + t);
                
                if (t === tabId) {
                    sec.classList.remove('hidden');
                    btn.classList.add('bg-white', 'text-byd-blue', 'shadow-sm', 'dark:bg-slate-800', 'dark:text-white');
                    btn.classList.remove('text-slate-500', 'hover:text-slate-800', 'dark:text-slate-400');
                } else {
                    sec.classList.add('hidden');
                    btn.classList.remove('bg-white', 'text-byd-blue', 'shadow-sm', 'dark:bg-slate-800', 'dark:text-white');
                    btn.classList.add('text-slate-500', 'hover:text-slate-800', 'dark:text-slate-400');
                }
            });
            showToast("VIEW MOUNTED: " + tabId.toUpperCase());
        }

        // Slide presentation controllers
        function nextSlide() {
            if (currentSlide < 5) {
                goToSlide(currentSlide + 1);
            }
        }

        function prevSlide() {
            if (currentSlide > 1) {
                goToSlide(currentSlide - 1);
            }
        }

        function goToSlide(slideNum) {
            const oldSlide = document.getElementById('slide-' + currentSlide);
            currentSlide = slideNum;
            const newSlide = document.getElementById('slide-' + currentSlide);

            // Handle slide transition styling
            for (let i = 1; i <= 5; i++) {
                const s = document.getElementById('slide-' + i);
                if (i === slideNum) {
                    s.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
                    s.classList.add('translate-x-0', 'opacity-100');
                } else if (i < slideNum) {
                    s.classList.remove('translate-x-0', 'translate-x-full');
                    s.classList.add('-translate-x-full', 'opacity-0', 'pointer-events-none');
                } else {
                    s.classList.remove('translate-x-0', '-translate-x-full');
                    s.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');
                }
            }

            // Update Indicator
            document.getElementById('slide-indicator').innerText = 'Slide ' + slideNum + ' / 5';
            renderSlideDots();
        }

        function renderSlideDots() {
            const container = document.getElementById('slide-dots');
            container.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const dot = document.createElement('button');
                dot.onclick = () => goToSlide(i);
                dot.className = "w-2.5 h-2.5 rounded-full transition-all " + 
                    (i === currentSlide ? 'bg-byd-red w-6' : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-450');
                container.appendChild(dot);
            }
        }

        // Render Slide 3 and Slide 4 and Slide 5 contents dynamically
        function renderDynamicSlides() {
            renderSlideDots();

            // Populate Slide 3 - Armadores lists
            const cmaList = document.getElementById('cma-vessel-list');
            const mscList = document.getElementById('msc-vessel-list');
            
            cmaList.innerHTML = '';
            mscList.innerHTML = '';

            const cmaVessels = carrierVessels.filter(v => v.carrier === 'CMA CGM');
            const mscVessels = carrierVessels.filter(v => v.carrier === 'MSC');

            document.getElementById('cma-vessel-summary').innerText = cmaVessels.reduce((acc, v) => acc + v.count, 0) + ' TEUs';
            document.getElementById('msc-vessel-summary').innerText = mscVessels.reduce((acc, v) => acc + v.count, 0) + ' TEUs';

            if (cmaVessels.length === 0) {
                cmaList.innerHTML = '<div class="text-[11px] text-slate-400 font-bold py-2 text-center select-none">No active en-route vessel</div>';
            } else {
                cmaVessels.forEach(v => {
                    const row = document.createElement('div');
                    row.className = 'flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-705';
                    row.innerHTML = '<div>' +
                        '<div class="font-extrabold text-slate-800 dark:text-white uppercase">' + v.vessel + '</div>' +
                        '<div class="text-[9px] text-slate-400 leading-none mt-1 font-bold tracking-widest uppercase">' + v.status + '</div>' +
                        '</div>' +
                        '<div class="font-extrabold font-mono text-byd-blue dark:text-blue-400">' + v.count + ' c</div>';
                    cmaList.appendChild(row);
                });
            }

            if (mscVessels.length === 0) {
                mscList.innerHTML = '<div class="text-[11px] text-slate-400 font-bold py-2 text-center select-none">No active en-route vessel</div>';
            } else {
                mscVessels.forEach(v => {
                    const row = document.createElement('div');
                    row.className = 'flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-705';
                    row.innerHTML = '<div>' +
                        '<div class="font-extrabold text-slate-800 dark:text-white uppercase">' + v.vessel + '</div>' +
                        '<div class="text-[9px] text-slate-400 leading-none mt-1 font-bold tracking-widest uppercase">' + v.status + '</div>' +
                        '</div>' +
                        '<div class="font-extrabold font-mono text-msc-dark dark:text-msc-gold">' + v.count + ' c</div>';
                    mscList.appendChild(row);
                });
            }

            // Populate Slide 4 Destinação
            const destTecon = globalContainerData.filter(c => c.terminal === 'TECON').length;
            const destTpc = globalContainerData.filter(c => c.terminal === 'TPC').length;
            const destInter = globalContainerData.filter(c => c.terminal === 'INTERMARITIMA').length;
            const destClia = globalContainerData.filter(c => c.terminal === 'CLIA' || c.terminal.includes('CLIA')).length;

            document.getElementById('dest-tecon').innerText = destTecon + ' TEUs';
            document.getElementById('dest-tpc').innerText = destTpc + ' TEUs';
            document.getElementById('dest-inter').innerText = destInter + ' TEUs';
            document.getElementById('dest-clia').innerText = destClia + ' TEUs';

            // Populate Slide 5 Projeção
            const currentTotal = terminalStocks.TECON + terminalStocks.TPC + terminalStocks.INTERMARITIMA;
            const enRouteTotal = carrierVessels.reduce((acc, v) => acc + v.count, 0);
            const rawCapacity = ${data.capacityProjection.capacity};
            const projectedTotal = currentTotal + enRouteTotal;

            document.getElementById('math-current').innerText = currentTotal + ' c';
            document.getElementById('math-transit').innerText = enRouteTotal + ' c';
            document.getElementById('math-projected').innerText = projectedTotal + ' c';

            const utilizationPct = ((projectedTotal / rawCapacity) * 100).toFixed(0);
            document.getElementById('proj-pct').innerText = utilizationPct + '%';
            document.getElementById('proj-bar').style.width = Math.min(utilizationPct, 100) + '%';
            
            if (utilizationPct > 85) {
                document.getElementById('proj-bar').className = "bg-byd-red h-full rounded-full";
            } else if (utilizationPct > 60) {
                document.getElementById('proj-bar').className = "bg-amber-500 h-full rounded-full";
            } else {
                document.getElementById('proj-bar').className = "bg-emerald-500 h-full rounded-full";
            }
        }

        // Render MOM Action Items
        function renderMomActions() {
            const tbody = document.getElementById('mom-action-tbody');
            tbody.innerHTML = '';

            globalMomActions.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors";
                
                let badgeClass = "bg-slate-100 text-slate-600";
                if (item.status.toUpperCase().includes('CONCLU') || item.status.toUpperCase().includes('DONE') || item.status.toUpperCase().includes('OK')) {
                    badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
                } else if (item.status.toUpperCase().includes('ANDAM') || item.status.toUpperCase().includes('PROGRESS')) {
                    badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
                } else if (item.status.toUpperCase().includes('ATRA') || item.status.toUpperCase().includes('DELAY')) {
                    badgeClass = "bg-byd-red/10 text-byd-red dark:bg-red-950/40 dark:text-red-300";
                }

                tr.innerHTML = '<td class="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200 font-medium">' + item.task + '</td>' +
                    '<td class="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-bold uppercase">' + item.owner + '</td>' +
                    '<td class="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono">' + item.deadline + '</td>' +
                    '<td class="px-6 py-4 whitespace-nowrap">' +
                    '<span class="inline-flex items-center px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ' + badgeClass + '">' +
                    item.status +
                    '</span>' +
                    '</td>';
                tbody.appendChild(tr);
            });
        }

        // Initialize unique items to fill database filters
        function initDatabaseFilters() {
            const selectVessel = document.getElementById('filter-vessel');
            const uniqueVessels = [...new Set(globalContainerData.map(c => c.vessel))].filter(Boolean);
            
            uniqueVessels.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.innerText = v.toUpperCase();
                selectVessel.appendChild(opt);
            });
        }

        // Search engine core matrix multiplier
        function applyFilters() {
            const searchQuery = document.getElementById('db-search').value.toLowerCase();
            const carrier = document.getElementById('filter-carrier').value;
            const vessel = document.getElementById('filter-vessel').value;
            const terminal = document.getElementById('filter-terminal').value;

            const tbody = document.getElementById('db-tbody');
            tbody.innerHTML = '';

            const filtered = globalContainerData.filter(c => {
                const matchesSearch = !searchQuery || 
                    c.number.toLowerCase().includes(searchQuery) ||
                    (c.vessel && c.vessel.toLowerCase().includes(searchQuery)) ||
                    c.terminal.toLowerCase().includes(searchQuery);
                    
                const matchesCarrier = carrier === 'ALL' || c.carrier === carrier;
                const matchesVessel = vessel === 'ALL' || c.vessel === vessel;
                let matchesTerminal = true;
                if (terminal !== 'ALL') {
                    if (terminal === 'CLIA') {
                        matchesTerminal = c.terminal.includes('CLIA') || c.terminal.includes('EMPORIO');
                    } else {
                        matchesTerminal = c.terminal === terminal;
                    }
                }

                return matchesSearch && matchesCarrier && matchesVessel && matchesTerminal;
            });

            document.getElementById('filtered-count').innerText = filtered.length;
            document.getElementById('total-count').innerText = globalContainerData.length;

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-10 text-center text-slate-405 font-bold uppercase select-none">Nenhum contêiner correspondente / No containers found</td></tr>';
                return;
            }

            filtered.forEach(c => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors";
                
                let carrierColor = "text-blue-600 dark:text-blue-400";
                if (c.carrier === 'MSC') {
                    carrierColor = "text-amber-600 dark:text-msc-gold";
                }

                tr.innerHTML = '<td class="px-5 py-3 whitespace-nowrap text-slate-800 dark:text-slate-200 font-extrabold font-mono">' + c.number + '</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap text-slate-550 dark:text-slate-400 font-mono">BLND93028</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap font-black font-sans uppercase ' + carrierColor + '">' + c.carrier + '</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap text-slate-400 dark:text-slate-500 font-bold">' + c.type + '</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 uppercase">' + c.vessel + '</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap font-extrabold text-slate-800 dark:text-slate-200">' + c.terminal + '</td>' +
                    '<td class="px-5 py-3 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350 rounded-md font-bold text-[9px] uppercase tracking-wider">' + c.status + '</span></td>';
                tbody.appendChild(tr);
            });
        }

        // Show feedback toast notifications
        function showToast(msg) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-msg').innerText = msg;
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(12px)';
            }, 3000);
        }
    </script>
</body>
</html>`;
};
