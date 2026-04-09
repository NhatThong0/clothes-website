import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function BannerCarousel({ banners = [], autoPlay = true, interval = 4500 }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const startRef = useRef(null);

  const active = banners.filter((banner) => banner.isActive !== false);
  const count = active.length;

  const go = useCallback(
    (index) => {
      if (count === 0) return;
      setCurrent((index + count) % count);
      setProgress(0);
      startRef.current = performance.now();
    },
    [count]
  );

  const next = useCallback(() => go(current + 1), [current, go]);
  const previous = useCallback(() => go(current - 1), [current, go]);

  useEffect(() => {
    if (!autoPlay || paused || count < 2) return undefined;

    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - (startRef.current || now);
      const percentage = Math.min((elapsed / interval) * 100, 100);
      setProgress(percentage);

      if (percentage >= 100) {
        next();
        return;
      }

      progressRef.current = requestAnimationFrame(tick);
    };

    progressRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(progressRef.current);
    };
  }, [autoPlay, count, current, interval, next, paused]);

  if (!active.length) return null;

  return (
    <section
      className="editorial-card relative overflow-hidden rounded-[36px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 editorial-grid opacity-30" />

      <div className="relative aspect-[16/8] min-h-[420px] w-full sm:min-h-[500px] lg:min-h-[620px]">
        {active.map((banner, index) => {
          const isCurrent = index === current;

          return (
            <article
              key={banner._id || index}
              className={`absolute inset-0 transition-all duration-700 ease-out ${
                isCurrent
                  ? 'translate-y-0 opacity-100 scale-100'
                  : index < current
                    ? '-translate-y-4 opacity-0 scale-[0.985]'
                    : 'translate-y-4 opacity-0 scale-[1.015]'
              }`}
            >
              <img
                src={banner.image}
                alt={banner.title || 'Banner'}
                className="h-full w-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.84)_0%,rgba(10,10,10,0.38)_45%,rgba(10,10,10,0.08)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_32%)]" />

              <div className="relative flex h-full flex-col justify-between p-7 text-white sm:p-10 lg:p-14">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] backdrop-blur">
                    Giao diện cảm hứng từ Figma
                  </div>
                  <div className="hidden rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70 lg:block">
                    Bố cục 16:9 nổi bật
                  </div>
                </div>

                <div className="max-w-3xl space-y-6">
                  {banner.title && (
                    <h1 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                      {banner.title}
                    </h1>
                  )}
                  {banner.subtitle && (
                    <p className="max-w-xl text-sm leading-7 text-white/78 sm:text-base lg:text-lg">
                      {banner.subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to={banner.link || '/products'}
                      className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#ecece8]"
                    >
                      Khám phá bộ sưu tập
                    </Link>
                    <Link
                      to="/products"
                      className="rounded-full border border-white/18 bg-white/8 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/14"
                    >
                      Xem tất cả sản phẩm
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {count > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-white/12 bg-black/16 px-5 py-4 backdrop-blur sm:px-8">
              <div className="flex items-center gap-2">
                {active.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => go(index)}
                    aria-label={`Đi tới banner ${index + 1}`}
                    className={`rounded-full transition-all ${
                      index === current ? 'h-2 w-10 bg-white' : 'h-2 w-2 bg-white/35 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={previous}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/10 text-lg text-white transition hover:bg-white/18"
                  aria-label="Banner trước"
                >
                  ‹
                </button>
                <button
                  onClick={next}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white text-lg text-black transition hover:bg-[#ecece8]"
                  aria-label="Banner sau"
                >
                  ›
                </button>
              </div>
            </div>

            {autoPlay && !paused && (
              <div className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-white/10">
                <div className="h-full bg-white transition-none" style={{ width: `${progress}%` }} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
