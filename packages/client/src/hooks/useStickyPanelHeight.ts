import { useLayoutEffect, useState } from 'react';

// Sizes a `sticky top-0` panel to the part of its parent column that is on screen. A plain
// `h-screen` overshoots the viewport while the navbar above (or the footer below) is still
// visible, which pushes the bottom of the panel out of reach. Returns a callback ref so panels
// that mount later (e.g. on expand) are picked up too.
const useStickyPanelHeight = <T extends HTMLElement>() => {
  const [panel, setPanel] = useState<T | null>(null);

  useLayoutEffect(() => {
    const column = panel?.parentElement;
    if (!panel || !column) return undefined;

    const update = () => {
      const { top, bottom } = column.getBoundingClientRect();
      const height = Math.min(window.innerHeight, bottom) - Math.max(0, top);
      panel.style.setProperty('height', `${Math.max(0, height)}px`);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Content above or inside the column can shift it without a scroll or resize event.
    const observer = new ResizeObserver(update);
    observer.observe(column);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [panel]);

  return setPanel;
};

export default useStickyPanelHeight;
