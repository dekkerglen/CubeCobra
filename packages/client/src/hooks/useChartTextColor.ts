import { useEffect, useState } from 'react';

/** Reads the --text CSS variable as an rgb() string, reacting to theme changes. */
export default function useChartTextColor(): string {
  const read = () => {
    if (typeof document === 'undefined') return 'rgb(33,37,41)';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    return v ? `rgb(${v})` : 'rgb(33,37,41)';
  };
  const [color, setColor] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setColor(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);
  return color;
}
