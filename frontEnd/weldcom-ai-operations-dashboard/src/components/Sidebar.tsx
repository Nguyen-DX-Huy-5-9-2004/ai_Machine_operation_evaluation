import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faChartLine,
  faChevronLeft,
  faChevronRight,
  faFileLines,
  faGaugeHigh,
  faGear,
  faIndustry,
  faLanguage,
  faMicrochip,
  faNetworkWired,
  faRobot,
  faServer,
  faShieldHalved,
  faSignal,
  faScrewdriverWrench
} from '@fortawesome/free-solid-svg-icons';
import type { DashboardPayload } from '../types/dashboard';
import { WeldcomLogo } from './WeldcomLogo';
import { sidebarCopy, translateUiText, type AppLanguage, type SidebarMenuKey } from '../i18n/appTranslations';
import type { ModelMonitorDto } from '../types/aiModelMonitor';
import { getSystemEvaluationState } from './aiModelMonitor/systemEvaluationState';
import { runtimeConfig } from '../config/runtimeConfig';

export type AppPage = 'dashboard' | 'control-room' | 'machines' | 'machine-detail' | 'alerts' | 'risk-analytics' | 'data-quality' | 'energy-consistency' | 'ai-model-monitor';

const menu = [
  { key: 'dashboard' as SidebarMenuKey, page: 'dashboard' as AppPage, icon: faGaugeHigh },
  { key: 'controlRoom' as SidebarMenuKey, page: 'control-room' as AppPage, icon: faNetworkWired },
  { key: 'machines' as SidebarMenuKey, page: 'machines' as AppPage, icon: faRobot },
  { key: 'machineDetail' as SidebarMenuKey, page: 'machine-detail' as AppPage, icon: faIndustry },
  { key: 'alerts' as SidebarMenuKey, page: 'alerts' as AppPage, icon: faBell },
  { key: 'riskAnalytics' as SidebarMenuKey, page: 'risk-analytics' as AppPage, icon: faChartLine },
  { key: 'dataQuality' as SidebarMenuKey, page: 'data-quality' as AppPage, icon: faShieldHalved },
  { key: 'energyConsistency' as SidebarMenuKey, page: 'energy-consistency' as AppPage, icon: faSignal },
  { key: 'maintenance' as SidebarMenuKey, icon: faScrewdriverWrench },
  { key: 'aiModelMonitor' as SidebarMenuKey, page: 'ai-model-monitor' as AppPage, icon: faMicrochip },
  { key: 'reports' as SidebarMenuKey, icon: faFileLines },
  { key: 'settings' as SidebarMenuKey, icon: faGear }
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  plantStatus: DashboardPayload['plantStatus'];
  lastUpdated: string;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  modelMonitor?: { data: Pick<ModelMonitorDto, 'systemStatus'> | null; loading: boolean; error: string | null };
}

export function Sidebar({ collapsed, onToggle, activePage, onNavigate, plantStatus, lastUpdated, language, onLanguageChange, modelMonitor }: SidebarProps) {
  const copy = sidebarCopy[language];
  const t = (value: string) => translateUiText(value, language);
  const updated = new Date(lastUpdated).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  // Mock mode is known before the monitor route has mounted. API mode stays
  // yellow until real monitor readiness evidence has been loaded.
  const monitorState = runtimeConfig.isMockMode
    ? { tone: 'red', label: 'DEMO DATA', description: 'Local fixture data', green: false }
    : getSystemEvaluationState(modelMonitor?.data ?? null, modelMonitor?.loading ?? false, modelMonitor?.error ?? null);

  return (
    <aside className={['sidebar', collapsed ? 'is-collapsed' : ''].join(' ')}>
      <div className="relative z-10 flex h-full flex-col">
        <WeldcomLogo collapsed={collapsed} />
        <button className="sidebar-toggle" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={onToggle}>
          <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
        </button>

        <nav className="mt-7 space-y-1.5">
          {menu.map((item) => (
            <button
              key={item.key}
              className={['nav-item group', item.page === activePage ? 'nav-item-active' : ''].join(' ')}
              aria-label={copy.menu[item.key]}
              onClick={() => item.page && onNavigate(item.page)}
            >
              <FontAwesomeIcon icon={item.icon} className={item.page === activePage ? 'text-blue-300' : 'text-slate-400 group-hover:text-blue-300'} />
              <span className="sidebar-label flex-1">{copy.menu[item.key]}</span>
              <span className="nav-tooltip">{copy.tooltips[item.key]}</span>
            </button>
          ))}
        </nav>

        <div className="plant-card mt-auto">
          <div className="plant-card-header">
            <FontAwesomeIcon icon={faServer} />
            <span className="sidebar-label">{copy.plantSystemStatus}</span>
            <div className="language-toggle sidebar-label" role="group" aria-label="Language">
              <FontAwesomeIcon icon={faLanguage} />
              <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => onLanguageChange('en')}>EN</button>
              <button type="button" className={language === 'vi' ? 'is-active' : ''} onClick={() => onLanguageChange('vi')}>VI</button>
            </div>
          </div>
          <div className="sidebar-label mt-3">
            <div className="font-bold text-white">{plantStatus.plantName}</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-glowGreen" /> {copy.statuses[plantStatus.status]}
            </div>
          </div>
          <div className="plant-stat-grid sidebar-label">
            <div><span>{copy.activeMachines}</span><strong>{plantStatus.activeMachines}/{plantStatus.totalMachines}</strong></div>
            <div><span>{copy.dataPipeline}</span><strong>{copy.statuses[plantStatus.dataPipeline]}</strong></div>
            <div><span>{copy.lastUpdated}</span><strong>{updated}</strong></div>
          </div>
          <div className={`monitor-sidebar-status sidebar-label is-${monitorState.tone}`}><span /><div><small>{t('System evaluation')}</small><strong>{t(monitorState.label)}</strong><p>{t(monitorState.green ? 'SQL runtime ready. Some AI Monitor charts show historical model-evaluation series.' : monitorState.description)}</p></div></div>
        </div>
      </div>
    </aside>
  );
}
