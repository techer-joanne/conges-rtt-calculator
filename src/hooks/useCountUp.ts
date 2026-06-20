import { useEffect, useRef, useState } from 'react';

/**
 * Anime une valeur numérique de son ancienne valeur vers la nouvelle
 * (easeOutCubic). Respecte « prefers-reduced-motion ».
 */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const to = target;

    if (reduce || from === to || !Number.isFinite(from) || !Number.isFinite(to)) {
      fromRef.current = to;
      setValue(to);
      return;
    }

    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setValue(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [target, duration]);

  return value;
}
