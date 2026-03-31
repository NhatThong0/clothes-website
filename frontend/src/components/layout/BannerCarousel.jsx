import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * BannerCarousel — auto-sliding 3D carousel
 * Props:
 *   banners: Array<{ _id, image, title, subtitle, link, isActive }>
 *   autoPlay: boolean (default true)
 *   interval: ms (default 4500)
 */
export default function BannerCarousel({ banners = [], autoPlay = true, interval = 4500 }) {
  const [current,   setCurrent]   = useState(0);
  const [prev,      setPrev]      = useState(null);
  const [direction, setDirection] = useState(1); // 1=forward, -1=backward
  const [paused,    setPaused]    = useState(false);
  const [progress,  setProgress]  = useState(0);
  const timerRef    = useRef(null);
  const progRef     = useRef(null);
  const startRef    = useRef(null);

  const active = banners.filter(b => b.isActive !== false);
  const count  = active.length;

  const go = useCallback((idx, dir = 1) => {
    if (count < 2) return;
    setPrev(current);
    setDirection(dir);
    setCurrent((idx + count) % count);
    setProgress(0);
    startRef.current = performance.now();
  }, [current, count]);

  const next = useCallback(() => go(current + 1,  1), [go, current]);
  const prev_ = useCallback(() => go(current - 1, -1), [go, current]);

  // Auto-play + progress bar
  useEffect(() => {
    if (!autoPlay || paused || count < 2) return;
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - (startRef.current || now);
      const pct = Math.min((elapsed / interval) * 100, 100);
      setProgress(pct);
      if (pct >= 100) { next(); return; }
      progRef.current = requestAnimationFrame(tick);
    };
    progRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(progRef.current); };
  }, [current, paused, autoPlay, interval, count, next]);

  if (!active.length) return null;
  if (active.length === 1) {
    const b = active[0];
    return (
      <div className="relative w-full overflow-hidden rounded-3xl" style={{aspectRatio:'16/7'}}>
        <img src={b.image} alt={b.title} className="w-full h-full object-cover"/>
        {(b.title || b.subtitle) && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex flex-col justify-center px-12">
            {b.title    && <h2 className="text-white text-3xl font-black mb-2">{b.title}</h2>}
            {b.subtitle && <p className="text-white/80 text-lg">{b.subtitle}</p>}
            {b.link && <Link to={b.link} className="mt-4 w-fit px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-blue-50 transition">Xem ngay →</Link>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: '16/7', perspective: '1200px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {active.map((b, i) => {
        const isCurrent = i === current;
        const isPrev    = i === prev;
        const isNext    = i === (current + 1) % count;
        const isPrevSlide = i === (current - 1 + count) % count;

        let transform = 'translateX(100%) scale(0.85)';
        let opacity   = 0;
        let zIndex    = 0;
        let transition = 'transform 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.7s ease';

        if (isCurrent) {
          transform = 'translateX(0%) scale(1) rotateY(0deg)';
          opacity   = 1;
          zIndex    = 3;
        } else if (isPrev) {
          transform = `translateX(${direction * -110}%) scale(0.85) rotateY(${direction * 15}deg)`;
          opacity   = 0;
          zIndex    = 2;
        } else if (isNext) {
          transform = 'translateX(8%) scale(0.88)';
          opacity   = 0.45;
          zIndex    = 1;
        } else if (isPrevSlide) {
          transform = 'translateX(-8%) scale(0.88)';
          opacity   = 0.45;
          zIndex    = 1;
        }

        return (
          <div key={b._id || i}
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{ transform, opacity, zIndex, transition, transformStyle: 'preserve-3d' }}>
            {/* Image */}
            <img src={b.image} alt={b.title || ''}
              className="w-full h-full object-cover"
              draggable={false}/>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent"/>

            {/* Content */}
            {isCurrent && (b.title || b.subtitle) && (
              <div className="absolute inset-0 flex flex-col justify-center px-10 md:px-16"
                style={{animation:'bannerFadeUp .6s .2s both'}}>
                {b.title && (
                  <h2 className="text-white font-black text-2xl md:text-4xl lg:text-5xl leading-tight drop-shadow-lg max-w-lg">
                    {b.title}
                  </h2>
                )}
                {b.subtitle && (
                  <p className="text-white/80 text-sm md:text-lg mt-3 max-w-sm leading-relaxed">
                    {b.subtitle}
                  </p>
                )}
                {b.link && (
                  <Link to={b.link}
                    className="mt-5 w-fit px-6 py-2.5 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-blue-50 shadow-lg transition-all hover:-translate-y-0.5">
                    Xem ngay →
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Prev / Next buttons */}
      <button onClick={prev_}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 text-slate-700 font-bold text-lg"
        aria-label="Previous">
        ‹
      </button>
      <button onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 text-slate-700 font-bold text-lg"
        aria-label="Next">
        ›
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {active.map((_, i) => (
          <button key={i} onClick={() => go(i, i > current ? 1 : -1)}
            className={`transition-all rounded-full ${
              i === current
                ? 'w-6 h-2 bg-white shadow-sm'
                : 'w-2 h-2 bg-white/50 hover:bg-white/80'
            }`}/>
        ))}
      </div>

      {/* Progress bar */}
      {autoPlay && !paused && (
        <div className="absolute bottom-0 left-0 right-0 z-10 h-0.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/70 rounded-full transition-none"
            style={{ width: `${progress}%` }}/>
        </div>
      )}

      <style>{`
        @keyframes bannerFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}