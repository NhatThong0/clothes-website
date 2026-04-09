import React from 'react';

export function AdminPage({ children, className = '' }) {
  return <div className={`admin-page min-h-screen ${className}`}>{children}</div>;
}

export function AdminPageBody({ children, className = '' }) {
  return <div className={`admin-page-body mx-auto max-w-[1440px] px-4 py-5 sm:px-6 xl:px-8 ${className}`}>{children}</div>;
}

export function AdminPageHeader({ title, description, action, meta }) {
  return (
    <div className="admin-page-header sticky top-0 z-20 border-b border-slate-200/70 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6 xl:px-8">
        <div>
          {meta && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {meta}
            </p>
          )}
          <h1 className="text-xl font-black tracking-[-0.04em] text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function AdminSectionCard({ children, className = '' }) {
  return <section className={`admin-section-card rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}

export function AdminEmptyState({ icon = '◌', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-[0_12px_32px_rgba(15,23,42,0.03)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-3xl text-slate-500">
        {icon}
      </div>
      <p className="mt-5 text-base font-bold text-slate-800">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AdminSkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-[linear-gradient(90deg,#eef2f7_0%,#f8fafc_50%,#eef2f7_100%)] bg-[length:200%_100%] ${className}`} />;
}

export function AdminTableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <AdminSkeletonBlock className="h-4 w-40" />
      </div>
      <div className="space-y-3 px-5 py-5">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, colIndex) => (
              <AdminSkeletonBlock key={colIndex} className="h-11" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
