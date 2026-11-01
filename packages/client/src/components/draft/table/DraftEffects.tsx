import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import Draft from '@utils/datatypes/Draft';
import { COLORS, DraftEvent, frontPack, noteText } from '@utils/drafting/draftEngine';
import { AnimatePresence, motion } from 'framer-motion';

import { HUMAN } from '../../../drafting/useDraftEngine';
import type useDraftEngine from '../../../drafting/useDraftEngine';
import useMediaQuery from '../../../hooks/useMediaQuery';
import Button from '../../base/Button';
import Text from '../../base/Text';
import FoilCardImage from '../../FoilCardImage';

type Engine = ReturnType<typeof useDraftEngine>;

interface DraftEffectsProps {
  draft: Draft;
  engine: Engine;
  seatName: (seat: number) => string;
  cardName: (card: number) => string;
  // A ready pool card the player pressed, if any.
  pressed: number | null;
  onClosePressed: () => void;
  onMoveToOtherBoard: (card: number) => void;
  logOpen: boolean;
  onCloseLog: () => void;
}

// How long a toast shows, and how many show at once (phones show one, at the top).
const TOAST_MS = { desktop: 4000, phone: 3500 };
const TOAST_COUNT = { desktop: 3, phone: 1 };
// A long burst drops its oldest toasts rather than queueing for a minute.
const TOAST_BACKLOG = 8;

// Above the page, but not its bottom nav (on phones).
const clearOfNav = { bottom: 'var(--bottom-nav-height, 0px)' };

/**
 * A dialog for one choice. Desktop: centered over the table. Phones: small ones are a
 * sheet above the bottom nav, grids of cards a tray from the right like the pool tray.
 */
const Panel: React.FC<{
  title: string;
  onClose?: () => void;
  grid?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, grid = false, children }) => {
  const phone = useMediaQuery('(max-width: 767px)');
  const body = (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex-1 min-w-0 truncate">{title}</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="text-text hover:text-text-secondary">
            <XIcon size={20} />
          </button>
        )}
      </div>
      <div className={grid ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain p-3' : 'p-4'}>{children}</div>
    </>
  );
  return createPortal(
    <>
      <div
        className="fixed inset-x-0 top-0 z-[55] bg-black/50"
        style={clearOfNav}
        onClick={onClose}
        aria-hidden="true"
      />
      {phone ? (
        <motion.div
          className={
            grid
              ? 'fixed top-0 right-0 z-[60] flex flex-col w-2/3 bg-bg-accent border-l border-border'
              : 'fixed inset-x-0 z-[60] flex flex-col bg-bg-accent border-t border-border rounded-t-lg'
          }
          style={grid ? clearOfNav : { bottom: 'var(--bottom-nav-height, 0px)' }}
          initial={grid ? { x: '100%' } : { y: '100%' }}
          animate={grid ? { x: 0 } : { y: 0 }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        >
          {body}
        </motion.div>
      ) : (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-6">
          <motion.div
            className={`pointer-events-auto flex flex-col bg-bg-accent border border-border rounded-lg shadow-2xl ${
              grid ? 'w-full max-w-3xl max-h-[80vh]' : 'w-full max-w-sm'
            }`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {body}
          </motion.div>
        </div>
      )}
    </>,
    document.body,
  );
};

// Times out from when it first shows, not from when it was queued.
const Toast: React.FC<{
  id: number;
  text: string;
  duration: number;
  paused: boolean;
  onDone: (id: number) => void;
  onHover: (hovering: boolean) => void;
}> = ({ id, text, duration, paused, onDone, onHover }) => {
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDone(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, paused, onDone]);
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onDone(id)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="pointer-events-auto text-left px-3 py-2 rounded-md bg-bg-active/95 border border-border shadow-lg text-sm"
    >
      {text}
    </motion.button>
  );
};

const CardTile: React.FC<{ card: any; onClick?: () => void }> = ({ card, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`block rounded-lg overflow-hidden ${onClick ? 'hover:ring-2 hover:ring-link' : ''}`}
  >
    <FoilCardImage card={card} />
  </button>
);

const ColorButton: React.FC<{ color: string; disabled: boolean; onClick: () => void }> = ({
  color,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-label={color}
    className="rounded-full p-1 disabled:opacity-30 enabled:hover:ring-2 enabled:hover:ring-link"
  >
    <img src={cdnUrl(`/content/symbols/${color.toLowerCase()}.png`)} alt={color} className="w-10 h-10" />
  </button>
);

/**
 * Everything the draft-matters cards put on top of the table: the prompt for a ready
 * card, choices the player has to make, toasts for what the bots do, and the table log.
 */
const DraftEffects: React.FC<DraftEffectsProps> = ({
  draft,
  engine,
  seatName,
  cardName,
  pressed,
  onClosePressed,
  onMoveToOtherBoard,
  logOpen,
  onCloseLog,
}) => {
  const state = engine.engine;
  const ctx = engine.ctx;
  const phone = useMediaQuery('(max-width: 767px)');
  const effectName = (card: number) => ctx.effectOf(card)?.id;

  // Informant and Whispergear need a second step: which seat, which pack.
  const [picking, setPicking] = useState<{ kind: 'informant' | 'whispergear'; card: number } | null>(null);
  const [peek, setPeek] = useState<{ title: string; cards: number[] } | null>(null);

  // ---- Toasts ----
  const toastText = (event: DraftEvent): string | null => {
    switch (event.kind) {
      case 'drafted':
        return event.seat === HUMAN ? null : `${seatName(event.seat)} drafted ${cardName(event.card)}`;
      case 'used': {
        if (event.seat === HUMAN) return null;
        const effect = effectName(event.card);
        return effect === 'librarian' || effect === 'operative' || effect === 'agent' || effect === 'loreSeeker'
          ? `${seatName(event.seat)} used ${cardName(event.card)}`
          : null;
      }
      case 'spy':
        return event.seat === HUMAN ? `${seatName(event.by)} drafted ${cardName(event.card)}` : null;
      case 'informant':
        return event.seat === HUMAN ? `${seatName(event.target)} drafted ${cardName(event.card)}` : null;
      case 'note':
        return event.seat === HUMAN ? `${cardName(event.card)}: ${noteText(event.note, seatName, draft.cards)}` : null;
      default:
        return null;
    }
  };
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [seen, setSeen] = useState(0);
  const latest = engine.events[engine.events.length - 1]?.id ?? 0;
  if (latest !== seen) {
    const fresh = engine.events
      .filter((line) => line.id > seen)
      .map((line) => ({ id: line.id, text: toastText(line.event) }))
      .filter((toast): toast is { id: number; text: string } => toast.text !== null);
    setSeen(latest);
    if (fresh.length > 0) setToasts((current) => [...current, ...fresh].slice(-TOAST_BACKLOG));
  }
  const [hovering, setHovering] = useState(false);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    setHovering(false);
  }, []);
  const visible = toasts.slice(0, phone ? TOAST_COUNT.phone : TOAST_COUNT.desktop);

  // ---- The table log ----
  const logText = (event: DraftEvent): string | null => {
    const seat = (index: number) => seatName(index);
    switch (event.kind) {
      case 'drafted':
      case 'revealed':
        return `${seat(event.seat)} drafted ${cardName(event.card)}`;
      case 'used':
        return `${seat(event.seat)} used ${cardName(event.card)}`;
      case 'removed': {
        if (event.seat === HUMAN) return `You removed ${cardName(event.card)}`;
        // Animus of Predation removes face up, Cogwork Grinder face down.
        const grinder = state.seats[event.seat]?.faceUp.find((card) => effectName(card) === 'grinder');
        if (grinder === undefined) return `${seat(event.seat)} removed ${cardName(event.card)}`;
        return `${seat(event.seat)} used ${cardName(grinder)}`;
      }
      case 'received':
        return event.seat === event.from ? null : `${seat(event.seat)} used Canal Dredger`;
      case 'skipped':
        return `${seat(event.seat)} passed without drafting`;
      case 'color':
        return `${seat(event.seat)} chose ${event.color} for ${cardName(event.card)}`;
      case 'spy':
      case 'informant':
      case 'note':
        return toastText(event);
      case 'round':
        return null;
      default:
        return null;
    }
  };
  const logLines = useMemo(
    () =>
      engine.events
        .map((line) => ({ id: line.id, round: line.round, text: logText(line.event) }))
        .filter((line): line is { id: number; round: number; text: string } => line.text !== null)
        .reverse(),
    // logText reads only stable lookups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine.events],
  );

  // ---- What to show ----
  const choice = engine.humanChoice;
  const task = engine.task;
  const pressedEffect = pressed !== null ? effectName(pressed) : undefined;

  const applyPressed = () => {
    if (pressed === null) return;
    if (pressedEffect === 'agent') engine.takeAll(pressed);
    else if (pressedEffect === 'informant' || pressedEffect === 'whispergear') {
      setPicking({ kind: pressedEffect, card: pressed });
    } else engine.toggleArm(pressed);
    onClosePressed();
  };

  // Packs Whispergear Sneak can look at: unopened ones, and ones waiting behind another.
  const peekable = useMemo(() => {
    const options: { title: string; cards: number[] }[] = [];
    (draft.InitialState ?? []).forEach((seatPacks, seat) => {
      seatPacks.forEach((pack, round) => {
        if (round > state.round) options.push({ title: `${seatName(seat)} · Pack ${round + 1}`, cards: pack.cards });
      });
    });
    state.seats.forEach((seat, index) => {
      seat.queue.slice(1).forEach((id) => {
        const pack = state.packs[id];
        if (pack) options.push({ title: `Waiting for ${seatName(index)}`, cards: pack.cards });
      });
    });
    return options;
  }, [draft.InitialState, state, seatName]);

  let panel: React.ReactNode = null;
  if (peek) {
    panel = (
      <Panel title={peek.title} onClose={() => setPeek(null)} grid>
        <div className={`grid gap-2 ${phone ? 'grid-cols-2' : 'grid-cols-5'}`}>
          {peek.cards.map((card) => (
            <CardTile key={card} card={draft.cards[card]} />
          ))}
        </div>
      </Panel>
    );
  } else if (picking?.kind === 'informant') {
    panel = (
      <Panel title={cardName(picking.card)} onClose={() => setPicking(null)}>
        <div className="flex flex-col gap-2">
          {state.seats.map((_, seat) =>
            seat === HUMAN ? null : (
              <Button
                key={seat}
                color="secondary"
                block
                onClick={() => {
                  engine.watchWithInformant(picking.card, seat);
                  setPicking(null);
                }}
              >
                {seatName(seat)}
              </Button>
            ),
          )}
        </div>
      </Panel>
    );
  } else if (picking?.kind === 'whispergear') {
    panel = (
      <Panel title={cardName(picking.card)} onClose={() => setPicking(null)}>
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
          {peekable.map((option, index) => (
            <Button
              // Two packs can wait for the same seat.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              color="secondary"
              block
              onClick={() => {
                engine.peekWithWhispergear(picking.card);
                setPicking(null);
                setPeek(option);
              }}
            >
              {option.title}
            </Button>
          ))}
          {peekable.length === 0 && <Text className="text-text-secondary">No packs to look at.</Text>}
        </div>
      </Panel>
    );
  } else if (choice?.kind === 'lore') {
    const lorePack = ctx.lorePacks.get(choice.card);
    panel = (
      <Panel title={cardName(choice.card)}>
        <Text className="block mb-4">Add a booster pack? ({lorePack?.cards.length ?? 0} cards)</Text>
        <div className="flex gap-2">
          <Button
            color="primary"
            block
            onClick={() => engine.answer({ kind: 'lore', seat: HUMAN, card: choice.card, add: true })}
          >
            Add
          </Button>
          <Button
            color="secondary"
            block
            onClick={() => engine.answer({ kind: 'lore', seat: HUMAN, card: choice.card, add: false })}
          >
            Don't add
          </Button>
        </div>
      </Panel>
    );
  } else if (choice?.kind === 'colors') {
    const own = choice.seat === HUMAN;
    panel = (
      <Panel title={own ? cardName(choice.card) : `${seatName(choice.seat)}: ${cardName(choice.card)}`}>
        {choice.colors.length > 0 && (
          <Text className="block mb-3 text-text-secondary">
            {choice.colors.map((color, index) => `${seatName(choice.choosers[index]!)}: ${color}`).join(' · ')}
          </Text>
        )}
        <div className="flex justify-center gap-2">
          {COLORS.map((color) => (
            <ColorButton
              key={color}
              color={color}
              disabled={choice.colors.includes(color)}
              onClick={() => engine.answer({ kind: 'color', seat: HUMAN, card: choice.card, color })}
            />
          ))}
        </div>
      </Panel>
    );
  } else if (choice?.kind === 'guess') {
    const pack = state.packs[choice.pack];
    panel = (
      <Panel title={`${cardName(choice.card)}: guess`} grid>
        <div className={`grid gap-2 ${phone ? 'grid-cols-2' : 'grid-cols-5'}`}>
          {(pack?.cards ?? [])
            .filter((card, index, cards) => cards.findIndex((other) => cardName(other) === cardName(card)) === index)
            .map((card) => (
              <CardTile
                key={card}
                card={draft.cards[card]}
                onClick={() => engine.answer({ kind: 'guess', seat: HUMAN, card: choice.card, guess: card })}
              />
            ))}
        </div>
      </Panel>
    );
  } else if (task.kind === 'dredge' && task.holders.length > 1 && !engine.waiting) {
    const last = frontPack(state, HUMAN)?.cards[0];
    panel = (
      <Panel title={last !== undefined ? `Last card: ${cardName(last)}` : 'Last card'}>
        <div className="flex flex-col gap-2">
          {task.holders
            .slice()
            .sort((a, b) => a - b)
            .map((holder) => (
              <Button key={holder} color="secondary" block onClick={() => engine.dredge(holder)}>
                {seatName(holder)}
              </Button>
            ))}
        </div>
      </Panel>
    );
  } else if (pressed !== null && engine.ready.includes(pressed)) {
    panel = (
      <Panel title={cardName(pressed)} onClose={onClosePressed}>
        <div className="flex flex-col gap-2">
          <Button color="primary" block onClick={applyPressed}>
            Use
          </Button>
          <Button
            color="secondary"
            block
            onClick={() => {
              onMoveToOtherBoard(pressed);
              onClosePressed();
            }}
          >
            Move to other board
          </Button>
          <Button color="secondary" outline block onClick={onClosePressed}>
            Cancel
          </Button>
        </div>
      </Panel>
    );
  } else if (logOpen) {
    panel = (
      <Panel title="Table log" onClose={onCloseLog} grid>
        <div className="flex flex-col gap-1">
          {logLines.map((line, index) => (
            <React.Fragment key={line.id}>
              {(index === 0 || logLines[index - 1]!.round !== line.round) && (
                <Text xs className="block pt-2 text-text-secondary uppercase tracking-wide">
                  Pack {line.round + 1}
                </Text>
              )}
              <Text sm className="block">
                {line.text}
              </Text>
            </React.Fragment>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <>
      {/* Over the table, under the header; never changes the table's size. */}
      <div
        className={`absolute z-30 flex flex-col gap-2 pointer-events-none ${
          phone ? 'inset-x-2 top-14 items-stretch' : 'right-4 top-16 items-end w-80'
        }`}
      >
        <AnimatePresence initial={false}>
          {visible.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              text={toast.text}
              duration={phone ? TOAST_MS.phone : TOAST_MS.desktop}
              paused={hovering}
              onDone={dismiss}
              onHover={setHovering}
            />
          ))}
        </AnimatePresence>
      </div>
      {panel}
    </>
  );
};

export default DraftEffects;
