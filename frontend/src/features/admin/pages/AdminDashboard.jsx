import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@features/admin/hooks/useAdmin';
import apiClient from '@features/shared/services/apiClient';
import { AdminPage, AdminPageBody, AdminSectionCard, AdminSkeletonBlock } from '@features/admin/components/AdminUI';

const fmt = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
const fmtShort = (value) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value || 0));
};
const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const STATUS_CFG = {
  pending: { label: 'Chờ xác nhận', dot: '#F59E0B', bg: '#FFFBEB', text: '#B45309' },
  confirmed: { label: 'Đã xác nhận', dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
  processing: { label: 'Đang xử lý', dot: '#8B5CF6', bg: '#F5F3FF', text: '#6D28D9' },
  shipped: { label: 'Đang giao', dot: '#06B6D4', bg: '#ECFEFF', text: '#0E7490' },
  delivered: { label: 'Đã giao', dot: '#10B981', bg: '#ECFDF5', text: '#047857' },
  cancelled: { label: 'Đã hủy', dot: '#EF4444', bg: '#FEF2F2', text: '#B91C1C' },
};
const CAT_COLORS = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

const QUICK_LINKS = [
  { label: 'Sản phẩm', desc: 'Quản lý kho', to: '/admin/products', icon: 'product', tint: 'bg-blue-50 text-blue-700' },
  { label: 'Danh mục', desc: 'Phân loại', to: '/admin/categories', icon: 'category', tint: 'bg-violet-50 text-violet-700' },
  { label: 'Đơn hàng', desc: 'Xử lý đơn', to: '/admin/orders', icon: 'order', tint: 'bg-cyan-50 text-cyan-700' },
  { label: 'Người dùng', desc: 'Tài khoản', to: '/admin/users', icon: 'user', tint: 'bg-emerald-50 text-emerald-700' },
  { label: 'Đánh giá', desc: 'Phản hồi', to: '/admin/reviews', icon: 'review', tint: 'bg-amber-50 text-amber-700' },
  { label: 'Voucher', desc: 'Khuyến mãi', to: '/admin/vouchers', icon: 'voucher', tint: 'bg-rose-50 text-rose-700' },
];

const statusConfig = (status) => STATUS_CFG[status] || { label: status, dot: '#94A3B8', bg: '#F8FAFC', text: '#475569' };

function Glyph({ name, className = 'h-5 w-5' }) {
  switch (name) {
    case 'users':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 7.75a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.75 18a6.25 6.25 0 0112.5 0M17 8.5a2.5 2.5 0 012.25 2.25M18.5 18a4.75 4.75 0 00-1.3-3.25" />
        </svg>
      );
    case 'product':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3.75l7 3.5-7 3.5-7-3.5 7-3.5zm7 3.5v9.5l-7 3.5-7-3.5v-9.5m7 3.5v9.5" />
        </svg>
      );
    case 'order':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7.25h10.25M8 12h10.25M8 16.75h6.25M5.75 7.25h.01M5.75 12h.01M5.75 16.75h.01" />
        </svg>
      );
    case 'revenue':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 15.25l3.25-3.25 2.5 2.5 4.75-5.25M19 19.25H5" />
        </svg>
      );
    case 'category':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 6.5h14M5 12h14M5 17.5h14M3.75 6.5h.01M3.75 12h.01M3.75 17.5h.01" />
        </svg>
      );
    case 'user':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 7.75a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.75 18a6.25 6.25 0 0112.5 0" />
        </svg>
      );
    case 'review':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.75l1.93 3.92 4.32.63-3.13 3.05.74 4.31L12 14.63l-3.86 2.03.74-4.31-3.13-3.05 4.32-.63L12 4.75z" />
        </svg>
      );
    case 'voucher':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6.75h8.75a2 2 0 012 2V11a1.75 1.75 0 010 3.5v2.25a2 2 0 01-2 2H8a2 2 0 01-2-2V14.5a1.75 1.75 0 010-3.5V8.75a2 2 0 012-2zm3-1.5l2 14" />
        </svg>
      );
    default:
      return null;
  }
}

function Counter({ target, duration = 900, formatter = (value) => value.toLocaleString('vi-VN') }) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const run = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * (target || 0)));
      if (progress < 1) raf.current = requestAnimationFrame(run);
    };

    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return formatter(value);
}

function ChangeBadge({ value }) {
  if (value === undefined || value === null) return null;
  if (value === 0) return <span className="text-xs font-semibold text-slate-400">Không đổi</span>;

  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
      <span>{positive ? '↑' : '↓'}</span>
      <span>{Math.abs(value)}% so với kỳ trước</span>
    </span>
  );
}

function MetricCard({ title, value, caption, icon, tone, formatter }) {
  const tones = {
    blue: 'from-blue-600 to-blue-500 text-white shadow-[0_18px_40px_rgba(37,99,235,0.18)]',
    violet: 'from-violet-600 to-violet-500 text-white shadow-[0_18px_40px_rgba(124,58,237,0.18)]',
    cyan: 'from-cyan-600 to-cyan-500 text-white shadow-[0_18px_40px_rgba(8,145,178,0.18)]',
    emerald: 'from-emerald-600 to-emerald-500 text-white shadow-[0_18px_40px_rgba(5,150,105,0.18)]',
  };

  return (
    <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute bottom-0 right-0 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
      <div className="relative">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/14 backdrop-blur">
          <Glyph name={icon} className="h-5 w-5" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">{title}</p>
        <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
          <Counter target={value || 0} formatter={formatter} />
        </p>
        <p className="mt-2 text-sm text-white/70">{caption}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function AreaChart({ series }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  if (!series?.length) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-300">Chưa có dữ liệu</div>;
  }

  const width = 640;
  const height = 210;
  const pad = { top: 14, right: 12, bottom: 34, left: 56 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...series.map((item) => Math.max(item.revenue || 0, item.profit || 0)), 1);
  const xScale = (index) => pad.left + (index / Math.max(series.length - 1, 1)) * innerWidth;
  const yScale = (value) => pad.top + innerHeight - (value / maxValue) * innerHeight;
  const labelOf = (item) => (item._id?.day ? `${item._id.day}/${item._id.month}` : MONTHS[(item._id?.month || 1) - 1]);

  const linePath = (key) => series.map((item, index) => `${index === 0 ? 'M' : 'L'}${xScale(index)},${yScale(item[key] || 0)}`).join(' ');
  const areaPath = (key) => `${linePath(key)} L${xScale(series.length - 1)},${pad.top + innerHeight} L${xScale(0)},${pad.top + innerHeight} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((point) => ({ value: Math.round(point * maxValue), y: yScale(point * maxValue) }));
  const xLabels = series.length <= 12
    ? series.map((item, index) => ({ index, label: labelOf(item) }))
    : series.reduce((result, item, index) => {
        const step = Math.ceil(series.length / 7);
        if (index % step === 0 || index === series.length - 1) result.push({ index, label: labelOf(item) });
        return result;
      }, []);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(event) => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const mouseX = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let minDistance = Infinity;
          series.forEach((_, index) => {
            const distance = Math.abs(xScale(index) - mouseX);
            if (distance < minDistance) {
              minDistance = distance;
              nearest = index;
            }
          });
          setHovered(minDistance < 40 ? nearest : null);
        }}
      >
        <defs>
          <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dashboardProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line x1={pad.left} y1={tick.y} x2={width - pad.right} y2={tick.y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={pad.left - 8} y={tick.y + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{fmtShort(tick.value)}</text>
          </g>
        ))}

        <path d={areaPath('revenue')} fill="url(#dashboardRevenue)" />
        <path d={areaPath('profit')} fill="url(#dashboardProfit)" />
        <path d={linePath('revenue')} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath('profit')} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {hovered !== null && (
          <>
            <line x1={xScale(hovered)} y1={pad.top} x2={xScale(hovered)} y2={pad.top + innerHeight} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx={xScale(hovered)} cy={yScale(series[hovered].revenue || 0)} r="5" fill="#2563EB" stroke="white" strokeWidth="2" />
            <circle cx={xScale(hovered)} cy={yScale(series[hovered].profit || 0)} r="4.5" fill="#10B981" stroke="white" strokeWidth="2" />
          </>
        )}

        {xLabels.map((item) => (
          <text
            key={item.index}
            x={xScale(item.index)}
            y={height - 4}
            textAnchor="middle"
            fontSize="9"
            fill={hovered === item.index ? '#2563EB' : '#94A3B8'}
            fontWeight={hovered === item.index ? '700' : '500'}
          >
            {item.label}
          </text>
        ))}
      </svg>

      {hovered !== null && (
        <div className="pointer-events-none absolute left-0 top-2 z-10" style={{ transform: `translateX(${Math.min((xScale(hovered) / width) * 100, 82)}%)` }}>
          <div className="min-w-[160px] rounded-2xl bg-slate-950 px-3.5 py-3 text-xs text-white shadow-2xl">
            <p className="mb-2 font-bold text-slate-300">{labelOf(series[hovered])}</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Doanh thu</span><span className="font-bold text-blue-300">{fmtShort(series[hovered].revenue || 0)}₫</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Lợi nhuận</span><span className="font-bold text-emerald-300">{fmtShort(series[hovered].profit || 0)}₫</span></div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1.5"><span className="text-slate-400">Đơn hàng</span><span className="font-bold">{series[hovered].orders || 0}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-5">
        {[['#2563EB', 'Doanh thu'], ['#10B981', 'Lợi nhuận']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="h-0.5 w-5 rounded" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDonut({ data }) {
  const [hovered, setHovered] = useState(null);

  if (!data?.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-300">Chưa có dữ liệu</div>;
  }

  const total = data.reduce((sum, item) => sum + (item.revenue || 0), 0) || 1;
  const radius = 15.9;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  const segments = data.map((item, index) => {
    const ratio = (item.revenue || 0) / total;
    const segment = { ...item, ratio, offset: cumulative, color: CAT_COLORS[index % CAT_COLORS.length] };
    cumulative += ratio;
    return segment;
  });

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
      <div className="relative mx-auto h-40 w-40 flex-shrink-0 xl:mx-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="3.6" />
          {segments.map((segment, index) => (
            <circle
              key={segment._id || index}
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={hovered === index ? 5 : 3.6}
              strokeDasharray={`${segment.ratio * circumference} ${circumference}`}
              strokeDashoffset={-segment.offset * circumference}
              style={{ transition: 'stroke-width .15s ease', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hovered !== null ? (
            <>
              <span className="text-xl font-black tracking-[-0.04em] text-slate-900">{segments[hovered].percentage}%</span>
              <span className="mt-1 max-w-[90px] text-[11px] leading-4 text-slate-400">{segments[hovered].name}</span>
            </>
          ) : (
            <>
              <span className="text-xl font-black tracking-[-0.04em] text-slate-900">{data.length}</span>
              <span className="mt-1 text-[11px] text-slate-400">danh mục</span>
            </>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {segments.map((segment, index) => (
          <div
            key={segment._id || index}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${hovered === index ? 'bg-slate-50' : 'bg-transparent'}`}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: segment.color }} />
            <span className="flex-1 truncate text-sm font-medium text-slate-600">{segment.name}</span>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{segment.percentage}%</p>
              <p className="text-[11px] text-slate-400">{fmtShort(segment.revenue || 0)}₫</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductsChart({ data }) {
  const [hovered, setHovered] = useState(null);

  if (!data?.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-300">Chưa có dữ liệu</div>;
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div
          key={item._id || index}
          className={`flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-all ${hovered === index ? 'border-slate-200 bg-slate-50' : 'bg-transparent'}`}
          onMouseEnter={() => setHovered(index)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className={`flex h-7 w-7 items-center justify-center rounded-xl text-[11px] font-black ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</div>
          <div className="h-10 w-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><Glyph name="product" className="h-4 w-4" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
              <span className="text-xs font-bold text-slate-800">{item.quantity} đã bán</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.percentage}%`, background: index < 3 ? 'linear-gradient(90deg,#2563EB,#60A5FA)' : 'linear-gradient(90deg,#64748B,#CBD5E1)' }} />
            </div>
          </div>
          <div className="hidden w-24 flex-shrink-0 text-right sm:block">
            <p className="text-[10px] text-slate-400">Doanh thu</p>
            <p className="text-xs font-bold text-slate-700">{fmtShort(item.revenue || 0)}₫</p>
          </div>
        </div>
      ))}
    </div>
  );
}
export default function AdminDashboard() {
  const { fetchDashboardStats, dashboardStats, loading } = useAdmin();
  const [now] = useState(new Date());
  const [revPeriod, setRevPeriod] = useState('month');
  const [revData, setRevData] = useState(null);
  const [revLoading, setRevLoading] = useState(false);
  const [catData, setCatData] = useState(null);
  const [topData, setTopData] = useState(null);
  const [topLimit, setTopLimit] = useState(8);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    setRevLoading(true);
    apiClient.get(`/admin/dashboard/revenue?period=${revPeriod}`)
      .then((response) => {
        const data = response.data.data;
        setRevData({
          series: (data.current || []).map((item) => ({
            _id: item._id,
            revenue: item.revenue || 0,
            profit: item.profit || 0,
            orders: item.orders || 0,
          })),
          summary: {
            currentRevenue: data.totalRevenue || 0,
            currentProfit: data.totalProfit || 0,
            revenueChange: data.revenueChange,
            profitChange: data.profitChange,
          },
        });
      })
      .catch(console.error)
      .finally(() => setRevLoading(false));
  }, [revPeriod]);

  useEffect(() => {
    apiClient.get('/admin/dashboard/categories')
      .then((response) => setCatData(response.data.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    apiClient.get(`/admin/dashboard/top-products?limit=${topLimit}`)
      .then((response) => setTopData(response.data.data))
      .catch(console.error);
  }, [topLimit]);

  if (loading) {
    return (
      <AdminPage>
        <AdminPageBody className="space-y-6">
          <AdminSkeletonBlock className="h-[220px] rounded-[34px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <AdminSkeletonBlock key={index} className="h-[172px] rounded-[28px]" />)}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.72fr]">
            <AdminSkeletonBlock className="h-[420px] rounded-[30px]" />
            <AdminSkeletonBlock className="h-[420px] rounded-[30px]" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <AdminSkeletonBlock className="h-[320px] rounded-[30px]" />
            <AdminSkeletonBlock className="h-[320px] rounded-[30px]" />
          </div>
        </AdminPageBody>
      </AdminPage>
    );
  }

  const stats = dashboardStats?.summary || {};
  const recentOrders = dashboardStats?.recentOrders || [];
  const summary = revData?.summary || {};
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <AdminPage className="text-slate-900">
      <AdminPageBody className="space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#2563eb_100%)] px-6 py-7 text-white shadow-[0_22px_60px_rgba(15,23,42,0.16)] sm:px-8">
          <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Hệ thống đang hoạt động ổn định
              </div>
              <p className="mt-5 text-sm text-white/70">{greeting}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Dashboard điều hành</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">Tổng quan hiệu suất kinh doanh, dòng doanh thu và các chỉ số vận hành quan trọng được trình bày theo cấu trúc rõ ràng hơn để hỗ trợ theo dõi nhanh và ra quyết định.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Hôm nay</p>
                <p className="mt-1 text-sm font-semibold text-white/90 capitalize">{dateString}</p>
              </div>
              <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                <span>Xem đơn hàng</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Người dùng" value={stats.totalUsers || 0} caption="Tài khoản đã đăng ký" icon="users" tone="blue" />
          <MetricCard title="Sản phẩm" value={stats.totalProducts || 0} caption="Đang kinh doanh" icon="product" tone="violet" />
          <MetricCard title="Đơn hàng" value={stats.totalOrders || 0} caption="Tổng số đơn đã ghi nhận" icon="order" tone="cyan" />
          <MetricCard title="Doanh thu" value={Math.round((stats.totalRevenue || 0) / 1000)} caption={stats.totalDeliveredRevenue ? `Đã nhận: ${fmt(stats.totalDeliveredRevenue)}` : fmt(stats.totalRevenue || 0)} icon="revenue" tone="emerald" formatter={(value) => `${value.toLocaleString('vi-VN')}K`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.72fr]">
          <SectionCard title="Doanh thu và lợi nhuận" subtitle="Theo dõi biến động theo từng kỳ để nắm nhanh hiệu suất kinh doanh." action={<div className="flex items-center gap-3">{!revLoading && revData && <div className="hidden items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:flex"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Doanh thu</p><p className="mt-1 text-sm font-bold text-slate-800">{fmtShort(summary.currentRevenue || 0)}₫</p><ChangeBadge value={summary.revenueChange} /></div><div className="h-10 w-px bg-slate-200" /><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Lợi nhuận</p><p className="mt-1 text-sm font-bold text-emerald-600">{fmtShort(summary.currentProfit || 0)}₫</p><ChangeBadge value={summary.profitChange} /></div></div>}<div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">{[['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm']].map(([value, label]) => <button key={value} onClick={() => setRevPeriod(value)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${revPeriod === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>)}</div></div>}>
            {revLoading ? <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /></div> : <AreaChart series={revData?.series || []} />}
          </SectionCard>

          <SectionCard title="Tóm tắt hiệu suất" subtitle="Nhìn nhanh các tín hiệu chính của kỳ đang chọn.">
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Doanh thu hiện tại</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900">{fmt(summary.currentRevenue || 0)}</p><div className="mt-3"><ChangeBadge value={summary.revenueChange} /></div></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Lợi nhuận hiện tại</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-emerald-600">{fmt(summary.currentProfit || 0)}</p><div className="mt-3"><ChangeBadge value={summary.profitChange} /></div></div>
              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Gợi ý quan sát</p><p className="mt-2 text-sm leading-7 text-slate-600">Ưu tiên theo dõi các ngày có chênh lệch lớn giữa doanh thu và lợi nhuận để kiểm tra giá vốn, mức giảm giá và hiệu suất chuyển đổi.</p></div>
            </div>
          </SectionCard>
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Cơ cấu danh mục" subtitle="Tỷ trọng doanh thu theo từng nhóm hàng.">
            {!catData ? <div className="flex h-56 items-center justify-center"><div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /></div> : <CategoryDonut data={catData} />}
          </SectionCard>

          <SectionCard title="Sản phẩm bán chạy" subtitle="Xếp hạng theo số lượng bán ra và đóng góp doanh thu." action={<select value={topLimit} onChange={(event) => setTopLimit(Number(event.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 outline-none ring-0"><option value={5}>Top 5</option><option value={8}>Top 8</option><option value={10}>Top 10</option></select>}>
            {!topData ? <div className="flex h-56 items-center justify-center"><div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /></div> : <TopProductsChart data={topData} />}
          </SectionCard>
        </section>

        <SectionCard title="Đơn hàng gần đây" subtitle={`${recentOrders.length} đơn mới nhất được cập nhật từ hệ thống.`} action={<Link to="/admin/orders" className="rounded-2xl bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">Xem tất cả</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Mã đơn', 'Khách hàng', 'Tổng tiền', 'Trạng thái', 'Ngày đặt', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-300">Chưa có đơn hàng nào.</td></tr>
                ) : recentOrders.map((order) => {
                  const status = statusConfig(order.status);
                  return (
                    <tr key={order._id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-4"><span className="rounded-xl bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-500">#{order._id.slice(0, 8).toUpperCase()}</span></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#1d4ed8_100%)] text-xs font-bold text-white">{(order.userId?.name || '?')[0].toUpperCase()}</div><div><p className="text-sm font-semibold text-slate-800">{order.userId?.name || '—'}</p><p className="text-[11px] text-slate-400">{order.userId?.email}</p></div></div></td>
                      <td className="px-4 py-4 text-sm font-bold text-slate-800">{fmt(order.total || 0)}</td>
                      <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: status.bg, color: status.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />{status.label}</span></td>
                      <td className="px-4 py-4 text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-4 text-right"><Link to="/admin/orders" className="text-xs font-semibold text-blue-600 transition hover:text-blue-700">Chi tiết</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Quản lý nhanh" subtitle="Đi tới các khu vực vận hành thường dùng.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {QUICK_LINKS.map((item) => (
              <Link key={item.to} to={item.to} className="group rounded-[26px] border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tint}`}><Glyph name={item.icon} className="h-5 w-5" /></div>
                <p className="mt-4 text-sm font-bold text-slate-800">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </AdminPageBody>
    </AdminPage>
  );
}
