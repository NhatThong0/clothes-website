import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function BannerCarousel({ banners = [], autoPlay = true, interval = 5000 }) {
  const active = banners.filter((b) => b.isActive !== false);
  const count  = active.length;

  const [current,    setCurrent]    = useState(0);
  const [dragDelta,  setDragDelta]  = useState(0);   // live px offset while dragging
  const [isDragging, setIsDragging] = useState(false);
  const [progress,   setProgress]   = useState(0);   // 0-100 for active dot fill

  const containerRef   = useRef(null);
  const rafRef         = useRef(null);
  const progressStart  = useRef(null);
  const pausedRef      = useRef(false); // hover pause (avoids RAF stale closure)
  const dragStartX     = useRef(null);

  // ── Navigation ───────────────────────────────────────────────────────────
  const go = useCallback((index) => {
    setCurrent(((index % count) + count) % count);
    setProgress(0);
    progressStart.current = null;
  }, [count]);

  const goNext = useCallback(() => go(current + 1), [current, go]);
  const goPrev = useCallback(() => go(current - 1), [current, go]);

  // ── Auto-play (requestAnimationFrame for smooth progress bar) ─────────────
  useEffect(() => {
    if (!autoPlay || count < 2) return;
    cancelAnimationFrame(rafRef.current);

    const tick = (ts) => {
      if (pausedRef.current) {
        progressStart.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!progressStart.current) progressStart.current = ts;
      const pct = Math.min(((ts - progressStart.current) / interval) * 100, 100);
      setProgress(pct);
      if (pct >= 100) { goNext(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoPlay, count, current, goNext, interval]);

  // ── Drag / swipe handlers ─────────────────────────────────────────────────
  const onDragStart = useCallback((clientX) => {
    dragStartX.current = clientX;
    setIsDragging(true);
    pausedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setProgress(0);
    progressStart.current = null;
  }, []);

  const onDragMove = useCallback((clientX) => {
    if (dragStartX.current === null) return;
    const delta = clientX - dragStartX.current;
    const atEdge = (current === 0 && delta > 0) || (current === count - 1 && delta < 0);
    setDragDelta(atEdge ? delta * 0.18 : delta);
  }, [count, current]);

  const onDragEnd = useCallback((clientX) => {
    if (dragStartX.current === null) return;
    const delta     = clientX - dragStartX.current;
    const threshold = (containerRef.current?.offsetWidth || 400) * 0.18;
    dragStartX.current = null;
    setDragDelta(0);
    setIsDragging(false);
    pausedRef.current = false;

    if (delta < -threshold) goNext();
    else if (delta > threshold) goPrev();
  }, [goNext, goPrev]);

  if (!count) return null;

  // Flex-strip: width = count × 100%, each slide = 100% of section
  // translateX to slide N = -(N / count × 100)%  (% of flex-strip's own width)
  const tx = `calc(${-(current / count) * 100}% + ${dragDelta}px)`;

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden rounded-[32px] select-none"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseEnter={() => { if (!isDragging) pausedRef.current = true;  }}
      onMouseLeave={() => {
        pausedRef.current = false;
        if (dragStartX.current !== null) onDragEnd(dragStartX.current);
      }}
      onMouseDown={(e) => { e.preventDefault(); onDragStart(e.clientX); }}
      onMouseMove={(e) => { if (dragStartX.current !== null) onDragMove(e.clientX); }}
      onMouseUp={(e)   => onDragEnd(e.clientX)}
      onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
      onTouchMove={(e)  => { e.preventDefault(); onDragMove(e.touches[0].clientX); }}
      onTouchEnd={(e)   => onDragEnd(e.changedTouches[0].clientX)}
    >
      <div className="relative aspect-[16/8] min-h-[420px] w-full sm:min-h-[500px] lg:min-h-[580px]">

        {/* ── Slide strip ────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex h-full"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(${tx})`,
            transition: isDragging ? 'none' : 'transform 0.52s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'transform',
          }}
        >
          {active.map((banner, i) => (
            <div
              key={banner._id || i}
              className="relative h-full flex-shrink-0"
              style={{ width: `${100 / count}%` }}
            >
              <img
                src={banner.image}
                alt={banner.title || 'Banner'}
                className="h-full w-full object-cover"
                draggable={false}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/30 to-black/5" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              {/* Text content */}
              <div className="absolute inset-0 flex flex-col justify-end p-7 pb-16 sm:p-10 sm:pb-20 lg:p-14 lg:pb-24">
                {banner.subtitle && (
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.32em] text-white/55">
                    {banner.subtitle}
                  </p>
                )}
                {banner.title && (
                  <h2 className="mb-5 max-w-lg text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-4xl lg:text-[3.2rem]">
                    {banner.title}
                  </h2>
                )}
                <Link
                  to={banner.link || '/products'}
                  onClick={(e) => isDragging && e.preventDefault()}
                  draggable={false}
                  className="w-fit rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-gray-100 active:scale-[0.97]"
                >
                  Khám phá ngay →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── Dot indicators (no arrows) ──────────────────────────────── */}
        {count > 1 && (
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
            {active.map((_, i) => {
              const isActive = i === current;
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Banner ${i + 1}`}
                  className="relative overflow-hidden rounded-full transition-all duration-300"
                  style={{
                    width:      isActive ? 32 : 7,
                    height:     7,
                    background: isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.30)',
                    flexShrink: 0,
                  }}
                >
                  {/* Animated progress fill on active dot */}
                  {isActive && autoPlay && (
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-white"
                      style={{ width: `${progress}%`, transition: 'none' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
