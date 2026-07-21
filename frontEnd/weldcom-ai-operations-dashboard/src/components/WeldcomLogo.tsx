import logoUrl from '../logo.png';

interface WeldcomLogoProps {
  collapsed?: boolean;
}

export function WeldcomLogo({ collapsed = false }: WeldcomLogoProps) {
  return (
    <div className={['weldcom-logo', collapsed ? 'justify-center' : ''].join(' ')}>
      <div className="logo-mark">
        <img className="logo-image" src={logoUrl} alt="Weldcom" />
      </div>
      <div className="logo-copy leading-tight sidebar-label">
        <div className="text-[23px] font-black tracking-wide">WELDCOM</div>
        <div className="text-[13px] tracking-[0.28em] text-slate-300 text-right">AI OPERATIONS</div>
      </div>
    </div>
  );
}
