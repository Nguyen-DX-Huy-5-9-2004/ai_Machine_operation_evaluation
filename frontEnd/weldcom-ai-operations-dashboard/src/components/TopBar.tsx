import { Bell, CalendarDays, ChevronDown, Filter, Search } from 'lucide-react';

export function TopBar() {
  return (
    <header className="mb-5 flex items-start justify-between gap-6">
      <div>
        <div className="flex items-center gap-4">
          <button className="neon-button px-3 py-2 text-slate-300">☰</button>
          <div>
            <h1 className="text-[28px] font-black tracking-tight">Good morning, Arjun 👋</h1>
            <p className="mt-1 text-sm text-slate-300">Here&apos;s what&apos;s happening across your operations today.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-4">
        <div className="flex items-center gap-4">
          <button className="text-slate-300 transition hover:text-white"><Search size={20} /></button>
          <button className="relative text-slate-300 transition hover:text-white">
            <Bell size={20} />
            <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">12</span>
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-black">AV</div>
          <ChevronDown size={18} className="text-slate-300" />
        </div>
        <div className="flex items-center gap-3">
          <button className="select-pill min-w-[210px]"><CalendarDays size={16} /> May 12 – May 18, 2025 <ChevronDown className="ml-auto" size={16} /></button>
          <button className="select-pill">All Machines <ChevronDown className="ml-auto" size={16} /></button>
          <button className="select-pill">All Locations <ChevronDown className="ml-auto" size={16} /></button>
          <button className="select-pill">All Status <ChevronDown className="ml-auto" size={16} /></button>
          <button className="neon-button flex min-w-[128px] items-center justify-center gap-2 bg-blue-600/35"><Filter size={17} /> Filters</button>
        </div>
      </div>
    </header>
  );
}
