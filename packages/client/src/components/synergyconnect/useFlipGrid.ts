import { useCallback, useLayoutEffect, useRef } from 'react';

const DURATION_MS = 450;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * FLIP animation for a reorderable grid: when `order` changes, every tile
 * glides from where it used to be to where it now is, instead of snapping.
 * This is what makes shuffling and lifting a solved group into the top rows
 * feel physical.
 *
 * Returns a ref callback to attach to each tile, keyed by card id.
 */
const useFlipGrid = (order: string[]) => {
  const nodes = useRef<Map<string, HTMLElement>>(new Map());
  const positions = useRef<Map<string, DOMRect>>(new Map());
  // Ref callbacks must keep a stable identity per key: a fresh closure each
  // render makes React detach and re-attach every ref, which would throw away
  // the measurement the animation needs to start from.
  const callbacks = useRef<Map<string, (element: HTMLElement | null) => void>>(new Map());

  const register = useCallback((key: string) => {
    const existing = callbacks.current.get(key);
    if (existing) {
      return existing;
    }

    const callback = (element: HTMLElement | null) => {
      if (element) {
        nodes.current.set(key, element);
      } else {
        nodes.current.delete(key);
      }
    };
    callbacks.current.set(key, callback);
    return callback;
  }, []);

  // Runs before paint, so the "last" measurement is the post-reorder layout
  // while `positions` still holds the pre-reorder one.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();

    nodes.current.forEach((element, key) => {
      const last = element.getBoundingClientRect();
      const first = positions.current.get(key);
      positions.current.set(key, last);

      if (!first || reduced) {
        return;
      }

      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        return;
      }

      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
        duration: DURATION_MS,
        easing: EASING,
      });
    });
  }, [order]);

  return register;
};

export default useFlipGrid;
