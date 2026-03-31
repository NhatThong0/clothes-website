import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';
import { Link } from 'react-router-dom';
import apiClient from '@features/shared/services/apiClient';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt      = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
const fmtShort = v => {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)         return (v / 1_000).toFixed(0) + 'K';
  return String(Math.round(v));
};
const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const STATUS_CFG = {
  pending:    { label:'Chờ xác nhận', dot:'#F59E0B', bg:'#FFFBEB', text:'#B45309' },
  confirmed:  { label:'Đã xác nhận',  dot:'#3B82F6', bg:'#EFF6FF', text:'#1D4ED8' },
  processing: { label:'Đang xử lý',   dot:'#8B5CF6', bg:'#F5F3FF', text:'#6D28D9' },
  shipped:    { label:'Đang giao',    dot:'#06B6D4', bg:'#ECFEFF', text:'#0E7490' },
  delivered:  { label:'Đã giao',      dot:'#10B981', bg:'#ECFDF5', text:'#047857' },
  cancelled:  { label:'Đã hủy',       dot:'#EF4444', bg:'#FEF2F2', text:'#B91C1C' },
};
const sc = s => STATUS_CFG[s] || { label:s, dot:'#94A3B8', bg:'#F8FAFC', text:'#475569' };
const CAT_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#84CC16'];

// ── Animated Counter ──────────────────────────────────────────────────────────
function Counter({ target, duration = 1000 }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const run = now => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return <>{val.toLocaleString('vi-VN')}</>;
}

// ── Change Badge ──────────────────────────────────────────────────────────────
function ChangeBadge({ value }) {
  if (!value && value !== 0) return null;
  if (value === 0) return <span className="text-xs text-slate-400 font-semibold">— Không đổi</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}% so với kỳ trước
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, rawValue, sub, icon, gradient, delay = 0 }) {
  return (
    <div className="kpi-card relative overflow-hidden rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300"
      style={{ background: gradient, animationDelay: `${delay}ms` }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10"/>
      <div className="absolute -bottom-8 right-2 w-16 h-16 rounded-full bg-white/5"/>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl mb-3">{icon}</div>
        <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">{label}</p>
        <p className="text-white text-3xl font-bold tracking-tight"><Counter target={rawValue || 0}/></p>
        {sub && <p className="text-white/50 text-[11px] mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Area Chart ────────────────────────────────────────────────────────────────
function AreaChart({ series, period }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  if (!series || series.length === 0) return (
    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">Chưa có dữ liệu</div>
  );

  const W = 600, H = 180;
  const PAD = { t: 10, r: 10, b: 32, l: 52 };
  const iW  = W - PAD.l - PAD.r;
  const iH  = H - PAD.t - PAD.b;
  const maxVal = Math.max(...series.map(d => Math.max(d.revenue || 0, d.profit || 0)), 1);
  const xS = i  => PAD.l + (i / Math.max(series.length - 1, 1)) * iW;
  const yS = v  => PAD.t + iH - (v / maxVal) * iH;
  const toPath = key => series.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(d[key] || 0)}`).join('');
  const toArea = key => `${toPath(key)}L${xS(series.length-1)},${PAD.t+iH}L${xS(0)},${PAD.t+iH}Z`;
  const getLabel = d => d._id?.day ? `${d._id.day}/${d._id.month}` : MONTHS[(d._id?.month || 1) - 1];

  const xLabels = series.length <= 12
    ? series.map((d, i) => ({ i, label: getLabel(d) }))
    : series.reduce((acc, d, i) => {
        if (i % Math.ceil(series.length / 7) === 0 || i === series.length - 1) acc.push({ i, label: getLabel(d) });
        return acc;
      }, []);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ pct: p, v: Math.round(p * maxVal), y: yS(p * maxVal) }));

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={e => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const mx = (e.clientX - rect.left) / rect.width * W;
          let ci = 0, md = Infinity;
          series.forEach((_, i) => { const d = Math.abs(xS(i) - mx); if (d < md) { md = d; ci = i; } });
          setHovered(md < 36 ? ci : null);
        }}>
        <defs>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {yTicks.map(({ pct, v, y }) => (
          <g key={pct}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#E2E8F0" strokeWidth="1"/>
            <text x={PAD.l - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{fmtShort(v)}</text>
          </g>
        ))}
        <path d={toArea('revenue')} fill="url(#gRev)"/>
        <path d={toArea('profit')}  fill="url(#gPro)"/>
        <path d={toPath('revenue')} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={toPath('profit')}  fill="none" stroke="#10B981" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"/>
        {hovered !== null && (
          <>
            <line x1={xS(hovered)} y1={PAD.t} x2={xS(hovered)} y2={PAD.t+iH} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3"/>
            <circle cx={xS(hovered)} cy={yS(series[hovered].revenue||0)} r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
            <circle cx={xS(hovered)} cy={yS(series[hovered].profit||0)}  r="4" fill="#10B981" stroke="white" strokeWidth="2"/>
          </>
        )}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xS(i)} y={H - 2} textAnchor="middle" fontSize="9"
            fill={hovered === i ? '#3B82F6' : '#94A3B8'} fontWeight={hovered === i ? '700' : '500'}>{label}</text>
        ))}
      </svg>

      {hovered !== null && (() => {
        const d = series[hovered];
        const xPct = (xS(hovered) / W) * 100;
        const isRight = xPct > 65;
        return (
          <div className="absolute top-2 pointer-events-none z-20"
            style={{ left: isRight ? 'auto' : `${xPct}%`, right: isRight ? `${100 - xPct}%` : 'auto', marginLeft: isRight ? 0 : 12 }}>
            <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl min-w-[145px]">
              <p className="font-bold text-slate-300 mb-2">{getLabel(d)}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-400"/>Doanh thu</span>
                  <span className="font-bold text-blue-300">{fmtShort(d.revenue||0)}₫</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-400"/>Lợi nhuận</span>
                  <span className="font-bold text-emerald-300">{fmtShort(d.profit||0)}₫</span>
                </div>
                <div className="border-t border-slate-700 pt-1 flex items-center justify-between">
                  <span className="text-slate-400">Đơn hàng</span>
                  <span className="font-bold">{d.orders}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-end gap-4 mt-2">
        {[['#3B82F6','Doanh thu'],['#10B981','Lợi nhuận']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded" style={{ background: c }}/>
            <span className="text-[11px] text-slate-400 font-medium">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Category Donut ────────────────────────────────────────────────────────────
function CategoryDonut({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <div className="h-48 flex items-center justify-center text-slate-300 text-sm">Chưa có dữ liệu</div>;

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const r = 15.9, circ = 2 * Math.PI * r;
  let cum = 0;
  const segs = data.map((d, i) => {
    const pct = d.revenue / total;
    const off = cum;
    cum += pct;
    return { ...d, pct, off, color: CAT_COLORS[i % CAT_COLORS.length] };
  });

  return (
    <div className="flex gap-5 items-center">
      <div className="relative w-40 h-40 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#F1F5F9" strokeWidth="3.5"/>
          {segs.map((seg, i) => (
            <circle key={i} cx="18" cy="18" r={r} fill="none" stroke={seg.color}
              strokeWidth={hovered === i ? 5 : 3.5}
              strokeDasharray={`${seg.pct * circ} ${circ}`}
              strokeDashoffset={-seg.off * circ}
              style={{ cursor:'pointer', transition:'stroke-width .15s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}/>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
          {hovered !== null ? (
            <>
              <span className="text-lg font-bold text-slate-800">{segs[hovered].percentage}%</span>
              <span className="text-[10px] text-slate-400 leading-tight">{segs[hovered].name}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-slate-800">{data.length}</span>
              <span className="text-[10px] text-slate-400">danh mục</span>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {segs.map((seg, i) => (
          <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${hovered===i?'bg-slate-50':''}`}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: seg.color }}/>
            <span className="text-xs text-slate-600 truncate flex-1">{seg.name}</span>
            <div className="flex-shrink-0 text-right">
              <span className="text-xs font-bold text-slate-700">{seg.percentage}%</span>
              <p className="text-[10px] text-slate-400">{fmtShort(seg.revenue)}₫</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Products ──────────────────────────────────────────────────────────────
function TopProductsChart({ data }) {
  const [hov, setHov] = useState(null);
  if (!data?.length) return <div className="h-48 flex items-center justify-center text-slate-300 text-sm">Chưa có dữ liệu</div>;

  return (
    <div className="space-y-3">
      {data.map((p, i) => (
        <div key={p._id || i}
          className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${hov===i?'bg-slate-50':''}`}
          onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
            i===0?'bg-amber-100 text-amber-700':i===1?'bg-slate-200 text-slate-600':i===2?'bg-orange-100 text-orange-700':'bg-slate-100 text-slate-500'
          }`}>{i+1}</div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
            {p.image
              ? <img src={p.image} alt={p.name} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">📦</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-700 truncate pr-2">{p.name}</p>
              <span className="text-xs font-bold text-slate-800 flex-shrink-0">{p.quantity} đã bán</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${p.percentage}%`,
                  background: i < 3 ? 'linear-gradient(90deg,#2563EB,#60A5FA)' : 'linear-gradient(90deg,#6366F1,#A5B4FC)',
                }}/>
            </div>
          </div>
          <div className="text-right flex-shrink-0 w-20 hidden sm:block">
            <p className="text-[10px] text-slate-400">Doanh thu</p>
            <p className="text-xs font-bold text-slate-700">{fmtShort(p.revenue)}₫</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label:'Sản phẩm',   icon:'📦', to:'/admin/products',   color:'#3B82F6', desc:'Quản lý kho' },
  { label:'Danh mục',   icon:'🗂️', to:'/admin/categories', color:'#8B5CF6', desc:'Phân loại' },
  { label:'Đơn hàng',   icon:'🛒', to:'/admin/orders',     color:'#06B6D4', desc:'Xử lý đơn' },
  { label:'Người dùng', icon:'👥', to:'/admin/users',      color:'#10B981', desc:'Tài khoản' },
  { label:'Đánh giá',   icon:'⭐', to:'/admin/reviews',    color:'#F59E0B', desc:'Phản hồi' },
  { label:'Voucher',    icon:'🎟️', to:'/admin/vouchers',   color:'#EF4444', desc:'Khuyến mãi' },
];

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { fetchDashboardStats, dashboardStats, loading } = useAdmin();
  const [now]       = useState(new Date());
  const [revPeriod, setRevPeriod]   = useState('month');
  const [revData,   setRevData]     = useState(null);
  const [revLoading,setRevLoading]  = useState(false);
  const [catData,   setCatData]     = useState(null);
  const [topData,   setTopData]     = useState(null);
  const [topLimit,  setTopLimit]    = useState(8);

  useEffect(() => { fetchDashboardStats(); }, []);

  // ✅ FIX: /admin/analytics → /admin/dashboard
  useEffect(() => {
    setRevLoading(true);
    apiClient.get(`/admin/dashboard/revenue?period=${revPeriod}`)
      .then(r => {
        const d = r.data.data;
        // Backend trả về: { current[], totalRevenue, totalProfit, revenueChange, profitChange }
        // Map sang format mà AreaChart + summary cần
        setRevData({
          series: (d.current || []).map(item => ({
            _id:     item._id,
            revenue: item.revenue || 0,
            profit:  item.profit  || 0,
            orders:  item.orders  || 0,
          })),
          summary: {
            currentRevenue: d.totalRevenue  || 0,
            currentProfit:  d.totalProfit   || 0,
            revenueChange:  d.revenueChange,
            profitChange:   d.profitChange,
          },
        });
      })
      .catch(console.error)
      .finally(() => setRevLoading(false));
  }, [revPeriod]);

  // ✅ FIX: /admin/analytics → /admin/dashboard
  useEffect(() => {
    apiClient.get('/admin/dashboard/categories')
      .then(r => setCatData(r.data.data))
      .catch(console.error);
  }, []);

  // ✅ FIX: /admin/analytics → /admin/dashboard
  useEffect(() => {
    apiClient.get(`/admin/dashboard/top-products?limit=${topLimit}`)
      .then(r => setTopData(r.data.data))
      .catch(console.error);
  }, [topLimit]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100"/>
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"/>
        </div>
        <p className="text-slate-400 text-sm font-medium">Đang tải dữ liệu...</p>
      </div>
    </div>
  );

  const stats        = dashboardStats?.summary      || {};
  const recentOrders = dashboardStats?.recentOrders || [];
  const summary      = revData?.summary             || {};
  const hour = now.getHours();
  const greeting = hour < 12 ? '☀️ Chào buổi sáng' : hour < 18 ? '🌤️ Chào buổi chiều' : '🌙 Chào buổi tối';
  const dateStr = now.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .kpi-card{animation:slideUp .5s ease both}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .fade-in{animation:fadeIn .4s ease both}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-400 font-medium mb-1">{greeting}</p>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5 capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/>
              Hệ thống hoạt động
            </div>
            <Link to="/admin/orders"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-200">
              Xem đơn hàng
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Người dùng"    rawValue={stats.totalUsers    ||0} sub="tài khoản đăng ký"  icon="👤" gradient="linear-gradient(135deg,#1D4ED8,#3B82F6)" delay={0}/>
          <KpiCard label="Sản phẩm"      rawValue={stats.totalProducts ||0} sub="đang kinh doanh"    icon="📦" gradient="linear-gradient(135deg,#6D28D9,#8B5CF6)" delay={80}/>
          <KpiCard label="Đơn hàng"      rawValue={stats.totalOrders   ||0} sub="tổng tất cả đơn giao thành công"   icon="🛒" gradient="linear-gradient(135deg,#0E7490,#06B6D4)" delay={160}/>
          <KpiCard label="Tổng Doanh Thu" rawValue={Math.round((stats.totalRevenue||0)/1000)} sub={stats.totalDeliveredRevenue ? `Đã nhận: ${fmt(stats.totalDeliveredRevenue)}` : fmt(stats.totalRevenue||0)} icon="💰" gradient="linear-gradient(135deg,#047857,#10B981)" delay={240}/>
        </div>

        {/* Revenue & Profit Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 fade-in">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Doanh thu & Lợi nhuận</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                `Lợi nhuận thực từ giá vốn sản phẩm`
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {!revLoading && revData && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Tổng doanh thu</p>
                    <p className="text-sm font-bold text-slate-800">{fmtShort(summary.currentRevenue||0)}₫</p>
                    <ChangeBadge value={summary.revenueChange}/>
                  </div>
                  <div className="w-px h-10 bg-slate-200"/>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Lợi nhuận</p>
                    <p className="text-sm font-bold text-emerald-600">{fmtShort(summary.currentProfit||0)}₫</p>
                    <ChangeBadge value={summary.profitChange}/>
                  </div>
                </div>
              )}
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {[['week','Tuần'],['month','Tháng'],['year','Năm']].map(([v,l]) => (
                  <button key={v} onClick={() => setRevPeriod(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${revPeriod===v?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {revLoading
            ? <div className="h-56 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
            : <AreaChart series={revData?.series||[]} period={revPeriod}/>
          }
        </div>

        {/* Category + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 fade-in">
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900">Cơ cấu danh mục</h2>
              <p className="text-xs text-slate-400 mt-0.5">Tỉ trọng doanh thu theo nhóm hàng</p>
            </div>
            {!catData
              ? <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
              : <CategoryDonut data={catData}/>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 fade-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Sản phẩm bán chạy</h2>
                <p className="text-xs text-slate-400 mt-0.5">Xếp hạng theo số lượng đã bán</p>
              </div>
              <select value={topLimit} onChange={e => setTopLimit(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-600 font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={10}>Top 10</option>
              </select>
            </div>
            {!topData
              ? <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
              : <TopProductsChart data={topData}/>}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-in">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Đơn hàng gần đây</h2>
              <p className="text-xs text-slate-400 mt-0.5">{recentOrders.length} đơn mới nhất</p>
            </div>
            <Link to="/admin/orders"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              Xem tất cả
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  {['Mã đơn','Khách hàng','Tổng tiền','Trạng thái','Ngày đặt',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <span className="text-5xl">📋</span>
                      <span className="text-sm">Chưa có đơn hàng nào</span>
                    </div>
                  </td></tr>
                ) : recentOrders.map(order => {
                  const cfg = sc(order.status);
                  return (
                    <tr key={order._id} className="border-t border-slate-50 hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          #{order._id.slice(0,8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {(order.userId?.name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm leading-tight">{order.userId?.name||'—'}</p>
                            <p className="text-[11px] text-slate-400">{order.userId?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><span className="font-bold text-slate-800 text-sm">{fmt(order.total||0)}</span></td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background:cfg.bg, color:cfg.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background:cfg.dot }}/>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link to="/admin/orders"
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap">
                          Chi tiết <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Nav */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quản lý nhanh</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {NAV_ITEMS.map(item => (
              <Link key={item.to} to={item.to}
                className="group bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-slate-100 hover:border-blue-100 flex flex-col items-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-200"
                  style={{ background: item.color + '15' }}>{item.icon}</div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">{item.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
