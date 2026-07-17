import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DataQualityOverview, L1StatusSummary, L2ConfidenceSummary, RiskDistributionItem, TopMachine, TrendPoint } from '../types/dashboard';
import { Sparkline } from './Sparkline';

const tooltipStyle = {
  background: 'rgba(5, 16, 30, .96)',
  border: '1px solid rgba(80,145,208,.35)',
  borderRadius: 10,
  color: '#eaf4ff'
};

export function RiskDistributionChart({ data }: { data: RiskDistributionItem[] }) {
  return (
    <section className="glass-panel p-5">
      <div className="panel-title mb-4">Machine Risk Distribution <span className="text-slate-500">ⓘ</span></div>
      <div className="grid grid-cols-[230px_1fr] items-center gap-6">
        <div className="relative h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={0} stroke="rgba(255,255,255,.08)" strokeWidth={1}>
                {data.map((item) => <Cell key={item.name} fill={item.tone} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black">128</div>
            <div className="text-sm text-slate-300">Total Machines</div>
          </div>
        </div>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.name} className="grid grid-cols-[1fr_72px_64px] items-center gap-3 text-sm">
              <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: item.tone, boxShadow: `0 0 14px ${item.tone}` }} />{item.name}</div>
              <div className="text-right font-semibold">{item.value}</div>
              <div className="text-right text-slate-400">({item.percent}%)</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-400">Risk distribution across all machines</div>
    </section>
  );
}

export function OperationalRiskChart({ data }: { data: TrendPoint[] }) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="panel-title">Operational Risk Over Time <span className="text-slate-500">ⓘ</span></div>
        <button className="select-pill min-w-[92px] py-2 text-xs">Daily</button>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 28, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(92, 152, 214, .16)" vertical={true} />
            <XAxis dataKey="label" tick={{ fill: '#98b3d1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#98b3d1', fontSize: 12 }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="risk" stroke="#b96cff" strokeWidth={3} fill="url(#riskFill)" dot={{ r: 4, fill: '#fff', stroke: '#b96cff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-sm text-slate-400">Overall risk score trend over time</div>
    </section>
  );
}

export function TopMachinesChart({ data }: { data: TopMachine[] }) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="panel-title">Top Machines by Risk <span className="text-slate-500">ⓘ</span></div>
        <button className="select-pill min-w-[80px] py-2 text-xs">Top 10</button>
      </div>
      <div className="space-y-2">
        {data.map((machine) => {
          const color = machine.riskScore >= 80 ? '#ff3648' : machine.riskScore >= 55 ? '#ff9800' : '#00e889';
          return (
            <div key={machine.machineId} className="grid grid-cols-[76px_1fr_36px] items-center gap-3 text-sm">
              <span className="font-semibold text-slate-300">{machine.machineId}</span>
              <div className="h-2 rounded-full bg-slate-700/60"><div className="h-full rounded-full" style={{ width: `${machine.riskScore}%`, background: color, boxShadow: `0 0 18px ${color}` }} /></div>
              <span className="font-bold" style={{ color }}>{machine.riskScore}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-[76px_1fr_36px] gap-3 text-xs text-slate-400"><span /> <div className="flex justify-between"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div><span /></div>
    </section>
  );
}

export function StatusDonut({ title, value, summary, color }: { title: string; value: string; summary: L1StatusSummary | L2ConfidenceSummary; color: string }) {
  const donutData = 'normal' in summary
    ? [{ name: 'Normal', value: summary.normal, color: '#00e889' }, { name: 'Anomaly', value: summary.anomaly, color: '#ff9800' }, { name: 'No Data', value: summary.noData, color: '#94a3b8' }]
    : [{ name: 'High (>=80%)', value: summary.high, color: '#1677ff' }, { name: 'Medium (50-79%)', value: summary.medium, color: '#ffb300' }, { name: 'Low (<50%)', value: summary.low, color: '#ff3648' }];
  return (
    <section className="glass-panel p-5">
      <div className="panel-title mb-3">{title} <span className="text-slate-500">ⓘ</span></div>
      <div className="grid grid-cols-[110px_1fr_120px] items-center gap-5">
        <div className="relative h-[108px]">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} innerRadius={42} outerRadius={54} dataKey="value" stroke="rgba(255,255,255,.06)">{donutData.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie></PieChart></ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-2xl font-black">{value}</div><div className="text-[10px] font-bold" style={{ color }}>{title.includes('L1') ? 'Normal' : 'Confidence'}</div></div>
        </div>
        <div className="space-y-2 text-sm">
          {donutData.map((d) => <div key={d.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: d.color }} />{d.name}</span><span>{d.value} ({Math.round((d.value / summary.total) * 100)}%)</span></div>)}
        </div>
        <Sparkline data={summary.spark} color={color} />
      </div>
    </section>
  );
}

export function QualityIssueTrend({ data }: { data: TrendPoint[] }) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-3 flex items-center justify-between"><div className="panel-title">Quality Issue Trend <span className="text-slate-500">ⓘ</span></div><button className="select-pill min-w-[112px] py-2 text-xs">Last 7 Days</button></div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(92,152,214,.14)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="minor" stackId="a" fill="#1677ff" radius={[0,0,0,0]} />
            <Bar dataKey="major" stackId="a" fill="#ffb300" />
            <Bar dataKey="critical" stackId="a" fill="#ff3648" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs"><span><b className="text-red-400">●</b> Critical</span><span><b className="text-yellow-400">●</b> Major</span><span><b className="text-blue-400">●</b> Minor</span></div>
    </section>
  );
}

export function DataQualityOverviewCard({ data }: { data: DataQualityOverview }) {
  const items = [
    { label: 'Completeness', value: data.completeness, icon: '⌘' },
    { label: 'Timeliness', value: data.timeliness, icon: '◷' },
    { label: 'Consistency', value: data.consistency, icon: '◇' },
    { label: 'Accuracy', value: data.accuracy, icon: '◎' }
  ];
  return (
    <section className="glass-panel p-5">
      <div className="mb-4 flex items-center justify-between"><div className="panel-title">Data Quality Overview <span className="text-slate-500">ⓘ</span></div><button className="text-sm font-semibold text-blue-400">View Details</button></div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => <div key={item.label} className="rounded-lg border border-blue-200/15 bg-slate-950/35 p-4"><div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><span className="text-xl text-blue-400">{item.icon}</span>{item.label}</div><div className="flex items-end justify-between"><span className="text-2xl font-black">{item.value}%</span><Sparkline data={[10,12,11,14,13,18,16,22,20]} color="#00e889" height={26} /></div></div>)}
      </div>
    </section>
  );
}
