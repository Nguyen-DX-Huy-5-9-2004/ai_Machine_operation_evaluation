import { Activity, AlertTriangle, BarChart3, Bot, BrainCircuit, Database, FileText, Grid2X2, Settings, ShieldCheck, Wrench } from 'lucide-react';
import { WeldcomLogo } from './WeldcomLogo';

const menu = [
  { label: 'Dashboard', icon: Grid2X2, active: true },
  { label: 'Machines', icon: Bot },
  { label: 'Monitoring', icon: Activity },
  { label: 'AI Insights', icon: BrainCircuit },
  { label: 'Alerts', icon: AlertTriangle, badge: 12 },
  { label: 'Maintenance', icon: Wrench },
  { label: 'Reports', icon: FileText },
  { label: 'Quality', icon: ShieldCheck },
  { label: 'Data Explorer', icon: BarChart3 },
  { label: 'Models', icon: Database },
  { label: 'Settings', icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="relative z-10 flex h-full flex-col">
        <WeldcomLogo />
        <nav className="mt-10 space-y-2">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={[
                  'group flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left text-[15px] transition',
                  item.active
                    ? 'border border-blue-500/45 bg-blue-500/18 text-white shadow-glowBlue'
                    : 'text-slate-300 hover:bg-blue-500/10 hover:text-white'
                ].join(' ')}
              >
                <Icon size={20} className={item.active ? 'text-blue-300' : 'text-slate-400 group-hover:text-blue-300'} />
                <span className="sidebar-label flex-1">{item.label}</span>
                {item.badge ? <span className="sidebar-label rounded-full bg-red-500/80 px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="plant-card mt-auto space-y-4 rounded-xl border border-blue-300/15 bg-slate-950/44 p-5">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Plant Overview</div>
          <div>
            <div className="font-bold text-white">Weldcom Plant 01</div>
            <div className="text-sm text-slate-400">Gurugram, India</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-glowGreen" /> Operational
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-blue-200/10 pt-4">
            <div>
              <div className="text-2xl font-bold">32°C</div>
              <div className="text-xs text-slate-400">Partly Cloudy</div>
            </div>
            <div>
              <div className="text-2xl font-bold">48%</div>
              <div className="text-xs text-slate-400">Humidity</div>
            </div>
            <div>
              <div className="text-sm font-semibold">12 km/h</div>
              <div className="text-xs text-slate-400">Wind</div>
            </div>
            <div>
              <div className="text-sm font-semibold">NW</div>
              <div className="text-xs text-slate-400">Direction</div>
            </div>
          </div>
        </div>
        <div className="user-card mt-4 flex items-center gap-3 rounded-xl border border-blue-300/15 bg-slate-950/42 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-bold">AV</div>
          <div className="user-text">
            <div className="text-sm font-bold">Arjun Verma</div>
            <div className="text-xs text-slate-400">Operations Director</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
