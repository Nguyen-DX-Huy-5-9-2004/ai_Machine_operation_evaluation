import { CalendarDays, ChevronDown, Filter, RefreshCw, Star } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { MonitorFilterState } from '../../types/aiModelMonitor';
import { useUiText } from '../../i18n/appTranslations';

interface MonitorHeaderProps {
  filters: MonitorFilterState;
  options: { dateRanges: string[]; modelVersions: string[]; runScopes: string[] };
  loading: boolean;
  dataMode: string;
  onChange: (patch: Partial<MonitorFilterState>) => void;
  onRefresh: () => void;
}

export function MonitorHeader({ filters, options, loading, dataMode, onChange, onRefresh }: MonitorHeaderProps) {
  const t = useUiText();
  return (
    <header className="amm-header">
      <div className="amm-header__title">
        <div className="amm-header__title-row"><h1>AI Model Monitor</h1><span className={`amm-mode-badge is-${dataMode}`}>{t(dataMode === 'mock' ? 'MOCK DATA' : 'API DATA')}</span></div>
        <p>{t('Monitor AI runtime, model accuracy, scoring health, data contract and model governance.')}</p>
      </div>
      <div className="amm-header__right">
        <div className="amm-header__status-row">
          <span className="amm-top-badge">◷ {t('Historical Mode')} <i /></span>
          <span className="amm-top-badge"><Star size={13} fill="currentColor" /> {t('Production Candidate')} <i /></span>
        </div>
        <div className="amm-filter-row">
          <label className="amm-select-wrap"><CalendarDays size={15} /><select value={filters.dateRange} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ dateRange: event.target.value })}>{options.dateRanges.map((value) => <option key={value}>{t(value)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="amm-select-wrap"><select value={filters.modelVersion} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ modelVersion: event.target.value })}>{options.modelVersions.map((value) => <option key={value}>{t(value)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="amm-select-wrap"><select value={filters.runScope} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ runScope: event.target.value })}>{options.runScopes.map((value) => <option key={value}>{t(value)}</option>)}</select><ChevronDown size={14} /></label>
          <button type="button" className="amm-primary-button"><Filter size={15} /> {t('Filters')}</button>
          <button type="button" className="amm-icon-button" onClick={onRefresh} disabled={loading} aria-label={t('Refresh monitor')}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /></button>
        </div>
      </div>
    </header>
  );
}
