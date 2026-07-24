import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faChevronDown, faFilter } from '@fortawesome/free-solid-svg-icons';
import { useUiText } from '../i18n/appTranslations';

interface FilterDropdownProps {
  label: string;
  icon?: typeof faCalendarDays;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}

function FilterDropdown({ label, icon, options, value, onChange }: FilterDropdownProps) {
  const t = useUiText();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(label);
  const displayValue = value ?? selected;

  return (
    <div className="filter-dropdown">
      <button className={['select-pill', open ? 'is-active' : ''].join(' ')} onClick={() => setOpen((value) => !value)}>
        {icon ? <FontAwesomeIcon icon={icon} /> : null}
        <span>{t(displayValue)}</span>
        <FontAwesomeIcon icon={faChevronDown} className="ml-auto text-[11px]" />
      </button>
      {open ? (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              key={option}
              className={option === displayValue ? 'is-selected' : ''}
              onClick={() => {
                setSelected(option);
                onChange?.(option);
                setOpen(false);
              }}
            >
              {t(option)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ datasetMode = 'historical', rangePreset = 'Last 30 Days', onRangePresetChange }: { datasetMode?: 'historical' | 'current'; rangePreset?: string; onRangePresetChange?: (value: 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Full Historical Range') => void }) {
  const historical = datasetMode === 'historical';
  const t = useUiText();
  return (
    <header className="dashboard-header mb-4 flex items-center justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-[25px] font-black leading-tight tracking-tight">Weldcom AI Operations Control Center</h1>
        <p className="mt-0.5 text-sm text-slate-300">{t(historical ? 'Historical production scoring and operational-risk intelligence' : 'Current SQL scoring and operational-risk intelligence')}</p>
      </div>

      <div className="filter-strip flex items-center gap-3">
        <FilterDropdown label={rangePreset} value={rangePreset} onChange={(value) => onRangePresetChange?.(value as 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Full Historical Range')} icon={faCalendarDays} options={['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Full Historical Range']} />
        <FilterDropdown label="All Machines" options={['All Machines', 'Critical Machines', 'Line A Machines', 'Line B Machines']} />
        <FilterDropdown label="All Locations" options={['All Locations', 'Line A', 'Line B', 'Line C', 'Line D']} />
        <FilterDropdown label="All Action Levels" options={['All Action Levels', 'Critical', 'High', 'Medium', 'Low']} />
        <button className="neon-button flex min-w-[120px] items-center justify-center gap-2 bg-blue-600/[0.35]">
          <FontAwesomeIcon icon={faFilter} />
          {t('Filters')}
        </button>
      </div>
    </header>
  );
}
