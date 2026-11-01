import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ListUnorderedIcon } from '@primer/octicons-react';
import { cardName, isVoucher } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { EngineState, noteText, seatLabel } from '@utils/drafting/draftEngine';
import { getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';

import Link from 'components/base/Link';
import DraftEffects from 'components/draft/table/DraftEffects';
import DraftTable from 'components/draft/table/DraftTable';
import P1P1FromPackGenerator from 'components/p1p1/P1P1FromPackGenerator';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import DraftLocation, { addCard, location, removeCard } from 'drafting/DraftLocation';
import { locations } from 'drafting/DraftLocation';
import useDraftEngine, { HUMAN } from 'drafting/useDraftEngine';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import useLocalStorage from 'hooks/useLocalStorage';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { trackEvent } from 'utils/analytics';

interface CubeDraftPageProps {
  cube: Cube;
  draft: Draft;
}

const LINK_CLASS =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

const removeFromBoard = (board: number[][][], cards: number[]) =>
  board.map((row) => row.map((pile) => pile.filter((card) => !cards.includes(card))));

const CubeDraftPage: React.FC<CubeDraftPageProps> = ({ cube, draft }) => {
  /**
   * Expand a picked card index into board entries. For normal cards, returns [{ cardIndex, row, col }].
   * For vouchers, returns entries for each of the voucher's sub-cards (using pre-expanded indices).
   * The voucher itself is NOT added to the player's board.
   */
  const expandPickForBoard = useCallback(
    (cardIndex: number): { cardIndex: number; row: number; col: number }[] => {
      const card = draft.cards[cardIndex];
      // getCardDefaultRowColumn dereferences the card, so never pass it a missing one.
      if (!card) return [{ cardIndex, row: 1, col: 0 }];

      if (isVoucher(card) && card.voucher_card_indices && card.voucher_card_indices.length > 0) {
        // Use pre-expanded sub-card indices from draft creation
        return card.voucher_card_indices
          .filter((subCardIndex) => draft.cards[subCardIndex])
          .map((subCardIndex) => ({
            cardIndex: subCardIndex,
            ...getCardDefaultRowColumn(draft.cards[subCardIndex]),
          }));
      }

      return [{ cardIndex, ...getCardDefaultRowColumn(card) }];
    },
    [draft.cards],
  );

  // The player's deck and sideboard as they arrange them while drafting.
  const [mainboard, setMainboard] = useLocalStorage(`mainboard-${draft.id}`, setupPicks(2, 8));
  const [sideboard, setSideboard] = useLocalStorage(`sideboard-${draft.id}`, setupPicks(1, 8));
  const [showRatings, setShowRatings] = useState(false);
  const { alerts, addAlert } = useAlerts();
  const { csrfFetch } = useContext(CSRFContext);

  const boards = useRef({ mainboard, sideboard });
  useEffect(() => {
    boards.current = { mainboard, sideboard };
  }, [mainboard, sideboard]);

  // Puts drafted cards on the board: the first at `target` if given, the rest where they belong.
  const addToBoard = useCallback(
    (cards: number[], target?: DraftLocation) => {
      const entries = cards.flatMap(expandPickForBoard);
      if (entries.length === 0) return;
      const place = (board: number[][][], forBoard: 'deck' | 'sideboard') => {
        const next = board.map((row) => row.map((pile) => [...pile]));
        entries.forEach((entry, index) => {
          if (index === 0 && target) {
            if ((target.type === locations.deck ? 'deck' : 'sideboard') === forBoard) {
              next[target.row]?.[target.col]?.splice(target.index, 0, entry.cardIndex);
            }
          } else if (forBoard === 'deck') {
            next[entry.row]?.[entry.col]?.push(entry.cardIndex);
          }
        });
        return next;
      };
      setMainboard((previous) => place(previous, 'deck'));
      if (target && target.type !== locations.deck) setSideboard((previous) => place(previous, 'sideboard'));
    },
    [expandPickForBoard, setMainboard, setSideboard],
  );

  const takeOffBoard = useCallback(
    (cards: number[]) => {
      const all = cards.flatMap((card) => [card, ...(draft.cards[card]?.voucher_card_indices ?? [])]);
      setMainboard((previous) => removeFromBoard(previous, all));
      setSideboard((previous) => removeFromBoard(previous, all));
    },
    [draft.cards, setMainboard, setSideboard],
  );

  const finish = useCallback(
    async (engine: EngineState) => {
      // The server replays the log; `state` is what older servers read.
      const state = {
        seats: engine.seats.map((seat) => ({
          picks: seat.pool.slice().reverse(),
          trashed: seat.trashed.slice().reverse(),
          pack: [],
        })),
        stepQueue: [],
        pack: engine.round + 1,
        pick: 1,
      };
      try {
        const response = await csrfFetch(`/draft/finish/${draft.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            mainboard: boards.current.mainboard,
            sideboard: boards.current.sideboard,
            ...(engine.partialLog ? {} : { log: engine.log }),
          }),
          timeout: 60 * 1000,
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        // Funnel denominator: a finished draft. "Submitted without building" is
        // derived in GA as draft_complete minus deck_build (no save = no event).
        trackEvent('draft_complete', { type: 'draft' });
        window.location.href = `/draft/deckbuilder/${draft.id}`;
      } catch (err) {
        console.error('Error finishing draft:', err);
        addAlert(
          'danger',
          'Error finishing draft, please reach out to the Discord linking the cube, draft, and a screenshot',
        );
        throw err;
      }
    },
    [csrfFetch, draft.id, addAlert],
  );

  const draftEngine = useDraftEngine({ draft, onGain: addToBoard, onLose: takeOffBoard, onFinished: finish });
  const { engine, task, pack, front, arming, picked, picksLeft } = draftEngine;
  const seat = engine.seats[HUMAN]!;
  const ctx = draftEngine.ctx;

  const getLocationReferences = useCallback(
    (type: location): { board: any[][][]; setter: React.Dispatch<React.SetStateAction<any[][][]>> } =>
      type === locations.deck ? { board: mainboard, setter: setMainboard } : { board: sideboard, setter: setSideboard },
    [mainboard, setMainboard, setSideboard, sideboard],
  );

  const dragCardBetweenDeckStacks = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      const { board: sourceBoard, setter: sourceSetter } = getLocationReferences(source.type);
      if (source.type === target.type) {
        const [card, newCards] = removeCard(sourceBoard, source);
        sourceSetter(addCard(newCards, target, card));
      } else {
        const { board: targetBoard, setter: targetSetter } = getLocationReferences(target.type);
        const [card, newCards] = removeCard(sourceBoard, source);
        targetSetter(addCard(targetBoard, target, card));
        sourceSetter(newCards);
      }
    },
    [getLocationReferences],
  );

  // A card picked from the pack on screen goes on the board straight away, unless an
  // armed Grinder or Animus is removing it.
  const removingNext = arming.remove;
  const pickAt = useCallback(
    (packIndex: number, target?: DraftLocation) => {
      const card = pack[packIndex];
      if (card === undefined) return;
      if (!removingNext) addToBoard([card], target);
      draftEngine.pick(card);
    },
    [pack, removingNext, addToBoard, draftEngine],
  );
  const clickPickCard = useCallback((packIndex: number) => pickAt(packIndex), [pickAt]);
  const pickCardTo = useCallback((packIndex: number, target: DraftLocation) => pickAt(packIndex, target), [pickAt]);
  const clickTrashPick = useCallback(
    (packIndex: number) => {
      const card = pack[packIndex];
      if (card !== undefined) draftEngine.trash(card);
    },
    [pack, draftEngine],
  );

  const toggleRatings = useCallback(() => setShowRatings((prev) => !prev), []);

  // Sends a pool card to the other board, where it belongs there.
  const moveToOtherBoard = useCallback(
    (card: number) => {
      const find = (board: number[][][]) => {
        for (let row = 0; row < board.length; row += 1) {
          for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
            const index = board[row]![col]!.indexOf(card);
            if (index >= 0) return { row, col, index };
          }
        }
        return null;
      };
      const details = draft.cards[card];
      if (!details) return;
      const { row, col } = getCardDefaultRowColumn(details);
      const inDeck = find(mainboard);
      if (inDeck) {
        dragCardBetweenDeckStacks(
          DraftLocation.deck(inDeck.row, inDeck.col, inDeck.index),
          DraftLocation.sideboard(0, col, sideboard[0]?.[col]?.length ?? 0),
        );
        return;
      }
      const inSide = find(sideboard);
      if (inSide) {
        dragCardBetweenDeckStacks(
          DraftLocation.sideboard(inSide.row, inSide.col, inSide.index),
          DraftLocation.deck(row, col, mainboard[row]?.[col]?.length ?? 0),
        );
      }
    },
    [draft.cards, mainboard, sideboard, dragCardBetweenDeckStacks],
  );

  // A pressed ready card opens its prompt; pressing an armed one disarms it.
  const [pressed, setPressed] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const seatName = useCallback((index: number) => (index === HUMAN ? 'You' : seatLabel(index)), []);

  // ---- What the header says ----
  const round = engine.round + 1;
  const pickInRound = seat.draftedThisRound + 1;
  const lorePack = front?.loreSource !== null && front?.loreSource !== undefined;
  const packName = lorePack ? 'Lore Seeker pack' : `Pack ${round}`;
  const packTitle = useMemo(() => {
    if (engine.done) return 'Finishing up draft...';
    switch (task.kind) {
      case 'idle':
        return 'Waiting for next pack...';
      case 'pick':
        if (task.blind) return `${packName} Pick ${pickInRound}: Random pick (${seat.randomLeft} left)`;
        if (task.random) return 'Picking random selection...';
        if (picked > 0) return `${packName} Pick ${pickInRound}: Pick ${picksLeft} more`;
        if (picksLeft > 1) return `${packName} Pick ${pickInRound}: Pick ${picksLeft} cards`;
        return `${packName} Pick ${pickInRound}: Pick 1 card`;
      case 'trash':
        return task.random ? 'Trashing random selection...' : `${packName} Pick ${pickInRound}: Trash 1 card`;
      case 'pass':
        return `${packName}: Pass`;
      case 'dredge':
        return `${packName}: Last card`;
      default:
        return '';
    }
  }, [engine.done, task, picked, picksLeft, packName, pickInRound, seat.randomLeft]);

  const subtitle = draftEngine.waiting
    ? 'Waiting for Bot Picks...'
    : engine.addedThisRound > 0
      ? `+${engine.addedThisRound} pack${engine.addedThisRound > 1 ? 's' : ''} this round`
      : undefined;

  const packTag =
    front && lorePack
      ? `Lore Seeker pack (${front.opener === HUMAN ? 'yours' : `from ${seatName(front.opener)}`})`
      : undefined;

  // ---- The player's pool ----
  const armedCards = useMemo(
    () => [
      ...arming.librarians,
      ...arming.operatives,
      ...(arming.remove
        ? seat.faceUp.filter((card) => ['grinder', 'animus'].includes(ctx.effectOf(card)?.id ?? ''))
        : []),
      ...seat.armed,
    ],
    [arming, seat.faceUp, seat.armed, ctx],
  );
  const notes = useMemo(() => {
    const text: Record<number, string[]> = {};
    for (const [card, list] of Object.entries(seat.notes)) {
      text[Number(card)] = list.map((note) => noteText(note, seatName, draft.cards));
    }
    // Cogwork Grinder and Animus show how many cards they've removed.
    const removedCount = seat.removed.length;
    if (removedCount > 0) {
      for (const card of seat.faceUp) {
        if (['grinder', 'animus'].includes(ctx.effectOf(card)?.id ?? '')) {
          text[card] = [...(text[card] ?? []), `Removed: ${removedCount}`];
        }
      }
    }
    // Archdemon of Paliano shows its random picks left.
    if (seat.randomLeft > 0) {
      for (const card of seat.faceUp) {
        if (ctx.effectOf(card)?.id === 'archdemon')
          text[card] = [...(text[card] ?? []), `${seat.randomLeft} random left`];
      }
    }
    return text;
  }, [seat, seatName, draft.cards, ctx]);

  // At pack 1 pick 1 the visible pack is still the full opened pack, so the user
  // can turn it into a shareable/votable P1P1 instead of screenshotting it.
  const isFirstPick = engine.round === 0 && seat.draftedThisRound === 0 && task.kind === 'pick' && !lorePack;
  const packCards = pack.map((index) => draft.cards[index]);
  const hasLog = draftEngine.events.some((line) => line.event.kind !== 'round');
  const logLink = hasLog && (
    <Link onClick={() => setLogOpen(true)} className={LINK_CLASS}>
      <ListUnorderedIcon size={16} />
      Table log
    </Link>
  );
  const packHeaderActions = (isFirstPick || hasLog) && (
    <>
      {logLink}
      {isFirstPick && (
        <P1P1FromPackGenerator cubeId={cube.id} seed={draft.id} pack={packCards} label="Share as P1P1" openInNewTab />
      )}
    </>
  );
  const packMenuActions = (isFirstPick || hasLog) && (
    <>
      {isFirstPick && (
        <P1P1FromPackGenerator
          cubeId={cube.id}
          seed={draft.id}
          pack={packCards}
          label="Share as P1P1"
          openInNewTab
          variant="link"
        />
      )}
      {logLink}
    </>
  );

  const totalPacks = draft.InitialState?.[0]?.length ?? 0;
  const packLabel = lorePack
    ? `Lore Seeker pack · ${front?.size ?? 0} cards`
    : totalPacks > 0
      ? `Pack ${round} of ${totalPacks}`
      : undefined;
  const largestPack = Math.max(0, ...(draft.InitialState?.[0] ?? []).map((initialPack) => initialPack.cards.length));

  const packDisabled =
    (task.kind === 'pick' && task.random && !task.blind) ||
    task.kind === 'idle' ||
    task.kind === 'pass' ||
    task.kind === 'dredge' ||
    (task.kind === 'trash' && task.random) ||
    draftEngine.predictError ||
    draftEngine.waiting;

  // The table sizes itself to the viewport and sets its own side margins, so it
  // gets the full content width.
  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="playtest" fullScreen>
        <div>
          <Alerts alerts={alerts} />
          <DraftTable
            cards={draft.cards}
            pack={pack}
            packNumber={round}
            pickNumber={pickInRound}
            cubeName={cube.name}
            packArt={cube.image?.uri}
            packLabel={packLabel}
            freshPack={front ? front.lastHolder === null : undefined}
            packSize={largestPack}
            mainboard={mainboard}
            sideboard={sideboard}
            title={packTitle}
            subtitle={subtitle}
            ratings={draftEngine.ratings}
            showRatings={showRatings}
            onToggleRatings={toggleRatings}
            loading={draftEngine.predictionsLoading || task.kind === 'idle'}
            disabled={packDisabled || draftEngine.retryInProgress}
            locked={engine.done}
            pendingPick={null}
            isTrashStep={task.kind === 'trash'}
            error={draftEngine.predictError}
            onRetry={draftEngine.retryPredict}
            retryInProgress={draftEngine.retryInProgress}
            headerActions={packHeaderActions || undefined}
            menuActions={packMenuActions || undefined}
            onPick={clickPickCard}
            onTrash={clickTrashPick}
            onPickTo={pickCardTo}
            onMovePoolCard={dragCardBetweenDeckStacks}
            blind={task.kind === 'pick' && task.blind}
            onPickBlind={draftEngine.pickRandom}
            passOnly={task.kind === 'pass'}
            onPass={draftEngine.pass}
            readyCards={draftEngine.ready}
            armedCards={armedCards}
            notes={notes}
            packTag={packTag}
            queueCount={seat.queue.length}
            onPoolCardPress={(card) => {
              if (armedCards.includes(card)) draftEngine.toggleArm(card);
              else if (draftEngine.ready.includes(card)) setPressed(card);
            }}
            removed={seat.removed}
            poolToPack={draftEngine.ready.filter(
              (card) => ctx.effectOf(card)?.id === 'librarian' && !arming.librarians.includes(card),
            )}
            onPoolCardToPack={draftEngine.toggleArm}
            inPack={arming.librarians}
            effects={
              <DraftEffects
                draft={draft}
                engine={draftEngine}
                seatName={seatName}
                cardName={(card) => (draft.cards[card] ? cardName(draft.cards[card]) : '')}
                pressed={pressed}
                onClosePressed={() => setPressed(null)}
                onMoveToOtherBoard={moveToOtherBoard}
                logOpen={logOpen}
                onCloseLog={() => setLogOpen(false)}
              />
            }
          />
        </div>
      </CubeLayout>
    </MainLayout>
  );
};

CubeDraftPage.displayName = 'CubeDraftPage';

export default RenderToRoot(CubeDraftPage);
