import React from 'react';
import bronzeIcon from '@assets/loyalty/Bronze.png';
import silverIcon from '@assets/loyalty/silver.png';
import goldIcon from '@assets/loyalty/gold.png';
import platinumIcon from '@assets/loyalty/platium.png';
import diamondIcon from '@assets/loyalty/diamon.png';

const DEFAULTS = {
  bronze: {
    label: 'Bronze',
    iconSrc: bronzeIcon,
    chipClass: 'border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 text-amber-800',
    frameClass: 'border-amber-200/80 bg-[radial-gradient(circle_at_top,#fff7ed_0%,#fde7c7_52%,#f5d1a8_100%)] shadow-[0_16px_36px_rgba(180,83,9,0.18)]',
    haloClass: 'bg-[radial-gradient(circle,rgba(251,191,36,0.22)_0%,rgba(251,191,36,0)_72%)]',
  },
  silver: {
    label: 'Silver',
    iconSrc: silverIcon,
    chipClass: 'border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-100 text-slate-700',
    frameClass: 'border-slate-200/80 bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef2f7_58%,#dce3ec_100%)] shadow-[0_16px_36px_rgba(100,116,139,0.16)]',
    haloClass: 'bg-[radial-gradient(circle,rgba(148,163,184,0.22)_0%,rgba(148,163,184,0)_72%)]',
  },
  gold: {
    label: 'Gold',
    iconSrc: goldIcon,
    chipClass: 'border-yellow-200 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-100 text-yellow-800',
    frameClass: 'border-yellow-200/80 bg-[radial-gradient(circle_at_top,#fffbe8_0%,#fde68a_48%,#f3c24f_100%)] shadow-[0_16px_40px_rgba(202,138,4,0.24)]',
    haloClass: 'bg-[radial-gradient(circle,rgba(250,204,21,0.28)_0%,rgba(250,204,21,0)_74%)]',
  },
  platinum: {
    label: 'Platinum',
    iconSrc: platinumIcon,
    chipClass: 'border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-cyan-100 text-cyan-800',
    frameClass: 'border-cyan-200/80 bg-[radial-gradient(circle_at_top,#f0fdff_0%,#c8f1f7_55%,#92dce8_100%)] shadow-[0_16px_38px_rgba(8,145,178,0.18)]',
    haloClass: 'bg-[radial-gradient(circle,rgba(34,211,238,0.26)_0%,rgba(34,211,238,0)_74%)]',
  },
  diamond: {
    label: 'Diamond',
    iconSrc: diamondIcon,
    chipClass: 'border-indigo-200 bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-indigo-100 text-indigo-800',
    frameClass: 'border-indigo-200/80 bg-[radial-gradient(circle_at_top,#f5f7ff_0%,#dddfff_52%,#c7c9ff_100%)] shadow-[0_16px_40px_rgba(79,70,229,0.2)]',
    haloClass: 'bg-[radial-gradient(circle,rgba(99,102,241,0.28)_0%,rgba(99,102,241,0)_74%)]',
  },
};

const SIZE_MAP = {
  sm: { frame: 'h-9 w-9 rounded-full', icon: 'h-6 w-6', image: 'h-[82%] w-[82%]', chipPad: 'px-2.5 py-1', text: 'text-[11px]' },
  md: { frame: 'h-10 w-10 rounded-full', icon: 'h-7 w-7', image: 'h-[84%] w-[84%]', chipPad: 'px-2.5 py-1', text: 'text-[11px]' },
  lg: { frame: 'h-16 w-16 rounded-[26px]', icon: 'h-11 w-11', image: 'h-[86%] w-[86%]', chipPad: 'px-3 py-1.5', text: 'text-xs' },
  xl: { frame: 'h-20 w-20 rounded-[32px]', icon: 'h-14 w-14', image: 'h-[88%] w-[88%]', chipPad: 'px-3.5 py-2', text: 'text-xs' },
};

export default function TierImageBadge({ tier, size = 'sm', showLabel = true, className = '', variant = 'pill' }) {
  if (!tier) return null;

  const iconKey = String(tier.icon_key || tier.iconKey || tier.icon || '').toLowerCase();
  const name = tier.name || tier.label || '';
  const config = DEFAULTS[iconKey] || null;
  const sizing = SIZE_MAP[size] || SIZE_MAP.sm;
  const label = name || config?.label || 'Tier';

  const frame = (
    <span className={`relative inline-flex items-center justify-center ${sizing.frame}`}>
      <span className={`absolute inset-[-8px] ${config?.haloClass || 'bg-slate-100/70'} blur-md`} />
      <span
        className={[
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] border backdrop-blur-sm',
          config?.frameClass || 'border-slate-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]',
        ].join(' ')}
      >
        {config?.iconSrc ? (
          <img
            src={config.iconSrc}
            alt={label}
            className={
              variant === 'icon'
                ? `${sizing.image} rounded-full object-cover drop-shadow-[0_12px_18px_rgba(15,23,42,0.14)]`
                : `${sizing.icon} object-contain drop-shadow-[0_10px_16px_rgba(15,23,42,0.12)]`
            }
          />
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tier</span>
        )}
      </span>
    </span>
  );

  if (variant === 'icon') {
    return (
      <div className={['inline-flex items-center justify-center', className].join(' ')} title={label}>
        {frame}
      </div>
    );
  }

  return (
    <div
      className={[
        'inline-flex items-center gap-2.5 rounded-full border font-extrabold uppercase tracking-[0.14em]',
        sizing.chipPad,
        sizing.text,
        config?.chipClass || 'border-slate-200 bg-slate-50 text-slate-700',
        className,
      ].join(' ')}
      title={label}
    >
      {frame}
      {showLabel && <span className="leading-none">{label}</span>}
    </div>
  );
}
