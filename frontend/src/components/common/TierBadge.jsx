import React from 'react';
import bronzeIcon from '@assets/loyalty/Bronze.png';
import silverIcon from '@assets/loyalty/silver.png';
import goldIcon from '@assets/loyalty/gold.png';
import platinumIcon from '@assets/loyalty/platium.png';
import diamondIcon from '@assets/loyalty/diamon.png';

const DEFAULTS = {
  bronze: { label: 'Bronze', emoji: '🥉', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  silver: { label: 'Silver', emoji: '🥈', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  gold: { label: 'Gold', emoji: '🥇', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  platinum: { label: 'Platinum', emoji: '💠', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  diamond: { label: 'Diamond', emoji: '💎', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export default function TierBadge({ tier, size = 'sm', showLabel = true, className = '' }) {
  if (!tier) return null;
  const iconKey = tier.icon_key || tier.iconKey || tier.icon || null;
  const name = tier.name || tier.label || '';
  const config = (iconKey && DEFAULTS[String(iconKey).toLowerCase()]) || null;

  const pad = size === 'lg' ? 'px-3 py-1.5' : 'px-2.5 py-1';
  const text = size === 'lg' ? 'text-xs' : 'text-[11px]';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-extrabold uppercase tracking-[0.14em]',
        pad,
        text,
        config?.className || 'bg-slate-50 text-slate-700 border-slate-200',
        className,
      ].join(' ')}
      title={name}
    >
      <span className="text-sm leading-none">{config?.emoji || '🏷️'}</span>
      {showLabel && <span className="leading-none">{name || config?.label || 'Tier'}</span>}
    </span>
  );
}
