import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { cardId, cardName, isCustomOrVoucher } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import useLocalStorage from '../hooks/useLocalStorage';
import AutocardContext from './AutocardContext';
import { CSRFContext } from './CSRFContext';

// A single saved destination: a board within one of the user's cubes. These are
// persisted to localStorage and shown in the floating cube tray as drop targets.
export interface CubeBoardCombo {
  cubeId: string;
  cubeName: string;
  boardKey: string; // boardNameToKey(name) — what the addtocube API expects
  boardLabel: string; // human-readable board name
  // Optional "advanced" defaults applied to every card dropped on this board.
  // Empty/omitted means the card is added as-is (the common case).
  notes?: string;
  status?: string;
  tags?: string[];
}

export const comboKey = (c: { cubeId: string; boardKey: string }): string => `${c.cubeId}::${c.boardKey}`;

interface Toast {
  message: string;
  color: 'success' | 'danger';
}

interface Point {
  x: number;
  y: number;
}

interface CubeTrayContextValue {
  combos: CubeBoardCombo[];
  addCombo: (combo: CubeBoardCombo) => void;
  removeCombo: (key: string) => void;
  hasCombo: (key: string) => boolean;
  // Drag gesture
  isDragging: boolean;
  dragCard: Card | null;
  getPointer: () => Point;
  startCardDrag: (card: Card, e: React.PointerEvent) => void;
  // After a real drag, the trailing click on the card should be swallowed so it
  // doesn't navigate / open a modal. CardGrid consumes this in onClickCapture.
  consumeClickSuppression: () => boolean;
  // Drop feedback
  toast: Toast | null;
}

const CubeTrayContext = createContext<CubeTrayContextValue | null>(null);

const STORAGE_KEY = 'cubeTrayCombos';
const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag
const TOAST_MS = 2600;

export const CubeTrayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { hideCard, setStopAutocard } = useContext(AutocardContext);

  const [combos, setCombos] = useLocalStorage<CubeBoardCombo[]>(STORAGE_KEY, []);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCard, setDragCard] = useState<Card | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Per-gesture mutable state. Kept in refs (not state) so a fast stream of
  // pointermove events never re-renders the (96-card) grid under the provider.
  const startRef = useRef<Point | null>(null);
  const cardRef = useRef<Card | null>(null);
  const pointerRef = useRef<Point>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPointer = useCallback(() => pointerRef.current, []);

  const showToast = useCallback((message: string, color: Toast['color']) => {
    setToast({ message, color });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const addCombo = useCallback(
    (combo: CubeBoardCombo) => {
      // Upsert by key so re-adding the same board updates its advanced defaults.
      setCombos((prev) => {
        const idx = prev.findIndex((c) => comboKey(c) === comboKey(combo));
        if (idx === -1) return [...prev, combo];
        const next = [...prev];
        next[idx] = combo;
        return next;
      });
    },
    [setCombos],
  );

  const removeCombo = useCallback(
    (key: string) => setCombos((prev) => prev.filter((c) => comboKey(c) !== key)),
    [setCombos],
  );

  const hasCombo = useCallback((key: string) => combos.some((c) => comboKey(c) === key), [combos]);

  const addCardToBoard = useCallback(
    async (card: Card, combo: CubeBoardCombo) => {
      try {
        // For catalog cards the server resolves every printed attribute from the
        // cardID alone; only custom/voucher cards need the full payload (mirrors
        // AddToCubeModal).
        const cardData: any = { cardID: cardId(card) };
        if (isCustomOrVoucher(card)) {
          if (card.tags && card.tags.length > 0) cardData.tags = card.tags;
          if (card.notes) cardData.notes = card.notes;
          if (card.finish) cardData.finish = card.finish;
          if (card.status) cardData.status = card.status;
          if (card.colors && card.colors.length > 0) cardData.colors = card.colors;
          if (card.type_line) cardData.type_line = card.type_line;
          if (card.rarity) cardData.rarity = card.rarity;
          if (card.cmc !== undefined) cardData.cmc = card.cmc;
          if (card.custom_name) cardData.custom_name = card.custom_name;
          if (card.imgUrl) cardData.imgUrl = card.imgUrl;
          if (card.imgBackUrl) cardData.imgBackUrl = card.imgBackUrl;
          if (card.colorCategory) cardData.colorCategory = card.colorCategory;
        }

        // Apply the board's advanced defaults (notes / status / tags) to the
        // card being added. Tags from the card and the board are merged.
        if (combo.tags && combo.tags.length > 0) {
          cardData.tags = [...(cardData.tags ?? []), ...combo.tags];
        }
        if (combo.notes) cardData.notes = combo.notes;
        if (combo.status) cardData.status = combo.status;

        const res = await csrfFetch(`/cube/api/addtocube/${combo.cubeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: [cardData], board: combo.boardKey }),
        });
        const json = res.ok ? await res.json() : null;
        if (json?.success === 'true') {
          showToast(`Added ${cardName(card)} to ${combo.cubeName} · ${combo.boardLabel}`, 'success');
        } else {
          showToast(`Couldn't add ${cardName(card)}`, 'danger');
        }
      } catch {
        showToast(`Couldn't add ${cardName(card)}`, 'danger');
      }
    },
    [csrfFetch, showToast],
  );

  const endGesture = useCallback(() => {
    startRef.current = null;
    cardRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);
    setDragCard(null);
    setStopAutocard(false);
  }, [setStopAutocard]);

  const startCardDrag = useCallback(
    (card: Card, e: React.PointerEvent) => {
      // Leave touch alone so the page still scrolls; only mouse/pen drag.
      if (e.pointerType === 'touch') return;
      startRef.current = { x: e.clientX, y: e.clientY };
      pointerRef.current = { x: e.clientX, y: e.clientY };
      cardRef.current = card;

      const handleMove = (ev: PointerEvent) => {
        const start = startRef.current;
        if (!start) return;
        pointerRef.current = { x: ev.clientX, y: ev.clientY };
        if (!draggingRef.current && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > DRAG_THRESHOLD) {
          draggingRef.current = true;
          setIsDragging(true);
          setDragCard(cardRef.current);
          hideCard();
          setStopAutocard(true);
        }
      };

      const handleUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);

        if (draggingRef.current) {
          // Swallow the click the browser fires after this pointerup. If the
          // drag ended off the source card (e.g. over the tray) no click fires
          // at all, so clear the flag on the next tick to avoid eating a later,
          // unrelated click.
          suppressClickRef.current = true;
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
          const card2 = cardRef.current;
          // The drag ghost is pointer-events:none, so elementsFromPoint sees the
          // tray row underneath the cursor.
          const target = document
            .elementsFromPoint(ev.clientX, ev.clientY)
            .find((el) => (el as HTMLElement).dataset?.cubetrayBoard !== undefined) as HTMLElement | undefined;
          if (target && card2) {
            void addCardToBoard(card2, {
              cubeId: target.dataset.cubeId || '',
              cubeName: target.dataset.cubeName || '',
              boardKey: target.dataset.boardKey || '',
              boardLabel: target.dataset.boardLabel || target.dataset.boardKey || '',
            });
          }
        }
        endGesture();
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [addCardToBoard, endGesture, hideCard, setStopAutocard],
  );

  const consumeClickSuppression = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const value: CubeTrayContextValue = {
    combos,
    addCombo,
    removeCombo,
    hasCombo,
    isDragging,
    dragCard,
    getPointer,
    startCardDrag,
    consumeClickSuppression,
    toast,
  };

  return <CubeTrayContext.Provider value={value}>{children}</CubeTrayContext.Provider>;
};

export const useCubeTray = (): CubeTrayContextValue | null => useContext(CubeTrayContext);

export default CubeTrayContext;
