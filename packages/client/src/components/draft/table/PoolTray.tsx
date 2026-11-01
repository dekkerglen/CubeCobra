import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ChevronRightIcon, ZapIcon } from '@primer/octicons-react';
import { cardCmc, cardCost, cardName, cardType, getCardColorClass, makeSubtitle } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import CardType from '@utils/datatypes/Card';
import { AnimatePresence, motion } from 'framer-motion';

import DraftLocation from '../../../drafting/DraftLocation';
import Text from '../../base/Text';
import FoilCardImage from '../../FoilCardImage';
import withAutocard from '../../WithAutocard';
import { CARD_ASPECT } from './tableLayout';

export type PoolTab = 'mainboard' | 'sideboard' | 'removed';

interface PoolTrayProps {
  open: boolean;
  onClose: () => void;
  tab: PoolTab;
  onTabChange: (tab: PoolTab) => void;
  // All draft cards; the boards refer to cards by their index in here.
  cards: CardType[];
  mainboard: number[][][];
  sideboard: number[][][];
  // A tap on a row: send one copy to the other board.
  onToggle: (source: DraftLocation) => void;
  // Cards with an ability ready to use, and abilities switched on for the next pick.
  readyCards?: number[];
  armedCards?: number[];
  // A tap on a ready or armed card's row, instead of moving it.
  onPress?: (card: number) => void;
  // What draft-matters cards noted, by card index.
  notes?: Record<number, string[]>;
  // Cards the player removed from the draft.
  removed?: number[];
}

// One row of the list: every copy of a card on the board, and where each one is.
interface Entry {
  name: string;
  card: CardType;
  ids: number[];
  locations: DraftLocation[];
}

// Holding a row this long shows the card; moving this far first cancels it (it's a scroll).
const LONG_PRESS = 400;
const PRESS_SLOP = 8;
// The preview's size, and its distance from the row and the screen's edges.
const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * CARD_ASPECT);
const PREVIEW_GAP = 8;

// With a mouse (where the window is wide enough for it), hovering a row shows the usual preview.
const AutocardButton = withAutocard('button');

const isLand = (card: CardType) => cardType(card).includes('Land');

const entriesOf = (cards: CardType[], board: number[][][], type: 'deck' | 'sideboard'): Entry[] => {
  const byName = new Map<string, Entry>();
  board.forEach((row, r) =>
    row.forEach((pile, c) =>
      pile.forEach((cardIndex, i) => {
        const card = cards[cardIndex];
        if (!card) return;
        const name = cardName(card);
        const location = type === 'deck' ? DraftLocation.deck(r, c, i) : DraftLocation.sideboard(r, c, i);
        const entry = byName.get(name);
        if (entry) {
          entry.ids.push(cardIndex);
          entry.locations.push(location);
        } else byName.set(name, { name, card, ids: [cardIndex], locations: [location] });
      }),
    ),
  );
  // By mana value, then name; lands last.
  return [...byName.values()].sort(
    (a, b) =>
      Number(isLand(a.card)) - Number(isLand(b.card)) ||
      cardCmc(a.card) - cardCmc(b.card) ||
      a.name.localeCompare(b.name),
  );
};

const count = (board: number[][][]) => board.flat(2).length;
const NO_BOARD: number[][][] = [];

const removedEntries = (cards: CardType[], removed: number[]): Entry[] =>
  removed.flatMap((cardIndex) => {
    const card = cards[cardIndex];
    return card ? [{ name: cardName(card), card, ids: [cardIndex], locations: [] }] : [];
  });

// Above the row if it fits, otherwise below; centered on it, inside the screen.
const previewPosition = (row: DOMRect) => {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const above = row.top - PREVIEW_GAP - PREVIEW_HEIGHT;
  const top = above >= PREVIEW_GAP ? above : Math.min(row.bottom + PREVIEW_GAP, height - PREVIEW_GAP - PREVIEW_HEIGHT);
  const left = Math.max(
    PREVIEW_GAP,
    Math.min(width - PREVIEW_GAP - PREVIEW_WIDTH, row.left + row.width / 2 - PREVIEW_WIDTH / 2),
  );
  return { top, left };
};

/**
 * The draft pool on phones: a tray from the right with the mainboard and
 * sideboard as tabs, each a list of cards by mana value. Tapping a card sends
 * it to the other board. Hovering it with a mouse shows the card, as does
 * holding it on touch.
 */
const PoolTray: React.FC<PoolTrayProps> = ({
  open,
  onClose,
  tab,
  onTabChange,
  cards,
  mainboard,
  sideboard,
  onToggle,
  readyCards = [],
  armedCards = [],
  onPress,
  notes = {},
  removed = [],
}) => {
  const board = tab === 'mainboard' ? mainboard : tab === 'sideboard' ? sideboard : NO_BOARD;
  const entries = useMemo(
    () =>
      tab === 'removed'
        ? removedEntries(cards, removed)
        : entriesOf(cards, board, tab === 'mainboard' ? 'deck' : 'sideboard'),
    [cards, board, tab, removed],
  );
  const boardCards = useMemo(
    () => (tab === 'removed' ? removed : board.flat(2)).map((index) => cards[index]).filter(Boolean),
    [board, cards, tab, removed],
  );

  const [preview, setPreview] = useState<{ card: CardType; top: number; left: number } | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; shown: boolean } | null>(null);

  const startPress = (event: React.PointerEvent<HTMLButtonElement>, card: CardType) => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
    // A mouse has the hover preview instead.
    if (event.pointerType !== 'touch') return;
    const row = event.currentTarget.getBoundingClientRect();
    const current = {
      x: event.clientX,
      y: event.clientY,
      shown: false,
      timer: setTimeout(() => {
        current.shown = true;
        navigator.vibrate?.(10);
        setPreview({ card, ...previewPosition(row) });
      }, LONG_PRESS),
    };
    press.current = current;
  };

  const movePress = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (current && !current.shown && Math.hypot(event.clientX - current.x, event.clientY - current.y) > PRESS_SLOP) {
      clearTimeout(current.timer);
      press.current = null;
    }
  };

  // The preview goes when the finger lifts; the press is kept so the click that follows is ignored.
  const endPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    setPreview(null);
  };

  const special = (entry: Entry) =>
    entry.ids.find((id) => armedCards.includes(id)) ?? entry.ids.find((id) => readyCards.includes(id));

  const tap = (entry: Entry) => {
    const held = press.current?.shown;
    press.current = null;
    if (held) return;
    const card = special(entry);
    if (card !== undefined && onPress) onPress(card);
    else if (entry.locations.length > 0) onToggle(entry.locations[entry.locations.length - 1]);
  };

  const tabButton = (key: PoolTab, label: string, total: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => onTabChange(key)}
      className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
        tab === key ? 'border-link text-text' : 'border-transparent text-text-secondary'
      }`}
    >
      {label} · {total}
    </button>
  );

  // Over the page (but not its bottom nav), so outside the page's layout.
  const clearOfNav = { bottom: 'var(--bottom-nav-height, 0px)' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          className="fixed inset-x-0 top-0 z-40 bg-black/50"
          style={clearOfNav}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {open && (
        <motion.div
          key="tray"
          className="fixed top-0 right-0 z-50 flex flex-col w-2/3 bg-bg-accent border-l border-border"
          style={clearOfNav}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
        >
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="text-text hover:text-text-secondary transition-colors"
                aria-label="Close pool"
              >
                <ChevronRightIcon size={20} />
              </button>
              <h2 className="text-lg font-semibold">Pool</h2>
            </div>
            <div role="tablist" className="flex">
              {tabButton('mainboard', 'Mainboard', count(mainboard))}
              {tabButton('sideboard', 'Sideboard', count(sideboard))}
              {removed.length > 0 && tabButton('removed', 'Removed', removed.length)}
            </div>
            <Text xs className="block px-3 py-1 text-text-secondary">
              {makeSubtitle(boardCards)}
            </Text>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {entries.map((entry) => {
              const card = special(entry);
              const armed = card !== undefined && armedCards.includes(card);
              const entryNotes = entry.ids.flatMap((id) => notes[id] ?? []);
              return (
                <AutocardButton
                  key={entry.name}
                  card={entry.card}
                  type="button"
                  onClick={() => tap(entry)}
                  onPointerDown={(event) => startPress(event, entry.card)}
                  onPointerMove={movePress}
                  onPointerUp={endPress}
                  onPointerCancel={endPress}
                  onPointerLeave={endPress}
                  onContextMenu={(event) => event.preventDefault()}
                  style={{ WebkitTouchCallout: 'none' }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left select-none border-b border-border bg-card-${getCardColorClass(entry.card)} ${
                    armed ? 'ring-2 ring-inset ring-[#f59e0b]' : ''
                  }`}
                >
                  <span className="w-6 shrink-0 text-xs font-semibold">{entry.ids.length}x</span>
                  <span className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-sm font-medium">{entry.name}</span>
                    {entryNotes.length > 0 && (
                      <span className="truncate text-xs text-text-secondary">{entryNotes.join(' · ')}</span>
                    )}
                  </span>
                  {card !== undefined && (
                    <motion.span
                      className="shrink-0 text-[#f59e0b]"
                      animate={armed ? { rotate: 0 } : { rotate: [0, 12, 0, -12, 0] }}
                      transition={armed ? { duration: 0.2 } : { duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
                    >
                      <ZapIcon size={14} />
                    </motion.span>
                  )}
                  <span className="inline-flex shrink-0 items-center">
                    {cardCost(entry.card)
                      .slice(0)
                      .reverse()
                      .map((symbol, index) => (
                        <img
                          key={`${symbol}-${index}`}
                          alt={symbol}
                          className="mana-symbol-sm"
                          src={cdnUrl(`/content/symbols/${symbol}.png`)}
                        />
                      ))}
                  </span>
                </AutocardButton>
              );
            })}
          </div>
        </motion.div>
      )}
      {open && preview && (
        <div
          key="preview"
          className="fixed z-[55] pointer-events-none card-border overflow-hidden shadow-2xl"
          style={{ top: preview.top, left: preview.left, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
        >
          <FoilCardImage card={preview.card} height="100%" />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default PoolTray;
