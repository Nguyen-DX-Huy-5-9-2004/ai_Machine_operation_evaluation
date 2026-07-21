import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faChevronDown, faFilter } from '@fortawesome/free-solid-svg-icons';

interface FilterDropdownProps {
  label: string;
  icon?: typeof faCalendarDays;
  options: string[];
}

function FilterDropdown({ label, icon, options }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(label);

  return (
    <div className="filter-dropdown">
      <button className={['select-pill', open ? 'is-active' : ''].join(' ')} onClick={() => setOpen((value) => !value)}>
        {icon ? <FontAwesomeIcon icon={icon} /> : null}
        <span>{selected}</span>
        <FontAwesomeIcon icon={faChevronDown} className="ml-auto text-[11px]" />
      </button>
      {open ? (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              key={option}
              className={option === selected ? 'is-selected' : ''}
              onClick={() => {
                setSelected(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar() {
  return (
    <header className="dashboard-header mb-4 flex items-center justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-[25px] font-black leading-tight tracking-tight">Weldcom AI Operations Control Center</h1>
        <p className="mt-0.5 text-sm text-slate-300">Current SQL scoring &amp; operational risk intelligence.</p>
      </div>

      <div className="filter-strip flex items-center gap-3">
        <FilterDropdown label="Current SQL range" icon={faCalendarDays} options={['Current SQL range', 'Last 24 Hours', 'Last 7 Days', 'Last 30 Days']} />
        <FilterDropdown label="All Machines" options={['All Machines', 'Critical Machines', 'Line A Machines', 'Line B Machines']} />
        <FilterDropdown label="All Locations" options={['All Locations', 'Line A', 'Line B', 'Line C', 'Line D']} />
        <FilterDropdown label="All Action Levels" options={['All Action Levels', 'Critical', 'High', 'Medium', 'Low']} />
        <button className="neon-button flex min-w-[120px] items-center justify-center gap-2 bg-blue-600/[0.35]">
          <FontAwesomeIcon icon={faFilter} />
          Filters
        </button>
      </div>
    </header>
  );
}
