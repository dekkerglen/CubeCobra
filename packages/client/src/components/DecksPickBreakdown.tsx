import React, { useEffect, useMemo, useState } from 'react';

import Deck from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';

import useLocalStorage from '../hooks/useLocalStorage';
import useQueryParam from '../hooks/useQueryParam';
import Text from './base/Text';
import DraftBreakdownDisplay from './draft/DraftBreakdownDisplay';

export const ACTION_LABELS = Object.freeze({
  pick: 'Picked ',
  trash: 'Trash ',
  pickrandom: 'Randomly Picked ',
  trashrandom: 'Randomly Trashed ',
});

interface BreakdownProps {
  draft: Deck;
  seatNumber: number;
  pickNumber: string;
  setPickNumber: (pickNumber: string) => void;
}

const CubeBreakdown: React.FC<BreakdownProps> = ({ draft, seatNumber, pickNumber, setPickNumber }) => {
  const [ratings, setRatings] = useState<number[]>([]);
  const [showRatings, setShowRatings] = useLocalStorage(`showDraftRatings-${draft.id}`, true);
  // Cube context embedding (32-dim) — same value used by CubeDraftPage; fetched once per cube and reused.
  const [cubeContextEmbedding, setCubeContextEmbedding] = useLocalStorage<number[] | null>(
    `cube-context-${draft.cube}`,
    null,
  );
  // Gate predict calls until the context fetch resolves so the breakdown ratings
  // match the with-context predictions the bots actually used during the live draft.
  const [cubeContextReady, setCubeContextReady] = useState<boolean>(
    Boolean(cubeContextEmbedding && cubeContextEmbedding.length > 0),
  );

  useEffect(() => {
    if (cubeContextEmbedding && cubeContextEmbedding.length > 0) {
      setCubeContextReady(true);
      return;
    }
    if (!draft.cube) {
      setCubeContextReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/draftbots/cubecontext', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cubeId: draft.cube }),
        });
        if (!response.ok) {
          if (!cancelled) setCubeContextReady(true);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        if (Array.isArray(data?.embedding)) {
          setCubeContextEmbedding(data.embedding);
        }
        setCubeContextReady(true);
      } catch {
        // Non-fatal: server falls back to zero context.
        if (!cancelled) setCubeContextReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.cube, cubeContextEmbedding, setCubeContextEmbedding]);

  // Handle both CubeCobra and Draftmancer drafts
  const {
    cardsInPack,
    pick = 0,
    pack = 0,
    picksList,
  } = useMemo(() => {
    // Draftmancer drafts
    if (draft.DraftmancerLog) {
      const log = draft.DraftmancerLog.players[seatNumber];
      if (!log) {
        return { cardsInPack: [], pick: 0, pack: 0, picksList: [] };
      }

      const draftPicksList = [];
      let subList = [];
      let draftCardsInPack: number[] = [];
      let currentPack = 0;
      const pickNum = parseInt(pickNumber);

      // Track pick number within current pack and total picks
      let totalPicks = 0;
      let currentPick = 1; // Start at 1, not 0

      for (let i = 0; i < log.length; i++) {
        subList.push({ cardIndex: log[i].pick });

        // When we hit a pack boundary or the end
        if (i === log.length - 1 || (i + 1 < log.length && log[i].booster.length < log[i + 1].booster.length)) {
          draftPicksList.push([...subList]);

          // If this pack contains our target pick
          if (totalPicks <= pickNum && totalPicks + subList.length > pickNum) {
            currentPick = pickNum - totalPicks + 1;
          }

          totalPicks += subList.length;
          subList = [];

          // Only increment pack if we haven't reached our target pick
          if (totalPicks <= pickNum) {
            currentPack += 1;
          }
        }

        if (i === pickNum) {
          draftCardsInPack = log[i].booster;
        }
      }

      return {
        cardsInPack: draftCardsInPack.map((index) => ({ cardIndex: index })),
        pick: currentPick,
        pack: currentPack,
        picksList: draftPicksList,
      };
    }

    // CubeCobra drafts
    const drafterState = getDrafterState(draft, seatNumber, parseInt(pickNumber));
    return {
      cardsInPack: drafterState.cardsInPack.map((index) => ({ cardIndex: index })),
      pick: drafterState.pick ?? 0,
      pack: drafterState.pack ?? 0,
      picksList: drafterState.picksList.map((list) =>
        list.map((item) => ({ cardIndex: typeof item === 'number' ? item : item.cardIndex })),
      ),
    };
  }, [draft, seatNumber, pickNumber]);

  // Get the actual pick that was made in this pack
  const currentPackPicks = picksList[pack] ?? [];
  const currentPickData = currentPackPicks[pick - 1];
  const actualPickIndex = cardsInPack.findIndex(
    (item) => item.cardIndex === (currentPickData ? currentPickData.cardIndex : undefined),
  );

  useEffect(() => {
    // Same gating as CubeDraftPage: don't fire the analysis until the cube-context
    // fetch settles. Otherwise we'd briefly display zero-context ratings, then
    // re-render with full context — making the displayed ratings disagree with
    // whatever the bot actually picked during the draft.
    if (!cubeContextReady) return;

    const fetchPredictions = async () => {
      if (!cardsInPack.length) return;

      try {
        const allPicks: number[] = [];
        for (let packIndex = 0; packIndex <= (pack || 0); packIndex++) {
          const packPicks = picksList[packIndex] || [];
          const picksToInclude = packIndex === pack ? pick - 1 : packPicks.length;
          for (let i = 0; i < picksToInclude; i++) {
            const pick = packPicks[i];
            if (pick?.cardIndex !== undefined) {
              allPicks.push(pick.cardIndex);
            }
          }
        }

        // Build pack oracle_ids, tracking which ones belong to vouchers
        type PackCardInfo = { cardIndex: number; oracleIds: string[] };
        const packCardInfos: PackCardInfo[] = cardsInPack.map((item) => ({
          cardIndex: item.cardIndex,
          oracleIds: getCardOracleIds(item.cardIndex),
        }));

        // Flatten oracle_ids for the API call
        const packOracleIds = packCardInfos.flatMap((info) => info.oracleIds);
        const picksOracleIds = allPicks.flatMap((idx) => getCardOracleIds(idx));

        const body: { pack: string[]; picks: string[]; cubeContext?: number[] } = {
          pack: packOracleIds,
          picks: picksOracleIds,
        };
        if (cubeContextEmbedding && cubeContextEmbedding.length > 0) {
          body.cubeContext = cubeContextEmbedding;
        }

        const response = await fetch(`/api/draftbots/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          const newRatings = new Array(cardsInPack.length).fill(0);
          data.prediction.forEach((pred: { oracle: string; rating: number }) => {
            const cardIndex = cardsInPack.findIndex(
              (idx) => draft.cards[idx.cardIndex].details?.oracle_id === pred.oracle,
            );
            if (cardIndex !== -1) {
              newRatings[cardIndex] = pred.rating;
            }
          });

          setRatings(newRatings);
        }
      } catch (error) {
        console.error('Error fetching predictions:', error);
      }
    };

    fetchPredictions();
  }, [cardsInPack, draft.cards, pack, pick, picksList, getCardOracleIds, cubeContextEmbedding, cubeContextReady]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const totalPicks = picksList.reduce((sum, pack) => sum + pack.length, 0);
      const currentPickNum = parseInt(pickNumber);

      if (e.key === 'ArrowLeft' && currentPickNum > 0) {
        setPickNumber((currentPickNum - 1).toString());
      } else if (e.key === 'ArrowRight' && currentPickNum < totalPicks - 1) {
        setPickNumber((currentPickNum + 1).toString());
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pickNumber, picksList, setPickNumber]);

  const onPickClick = (packIndex: number, pickIndex: number) => {
    let picks = 0;
    for (let i = 0; i < packIndex; i++) {
      if (picksList[i]?.length) {
        picks += picksList[i].length;
      }
    }
    setPickNumber((picks + pickIndex).toString());
  };

  return (
    <DraftBreakdownDisplay
      showRatings={showRatings}
      setShowRatings={setShowRatings}
      packNumber={pack}
      pickNumber={pick}
      cardsInPack={cardsInPack}
      picksList={picksList}
      ratings={showRatings ? ratings : undefined}
      actualPickIndex={actualPickIndex}
      cards={draft.cards}
      onPickClick={onPickClick}
    />
  );
};

interface DecksPickBreakdownProps {
  draft: Deck;
  seatNumber: number;
  defaultIndex?: string;
  currentPickNumber?: string;
  basePickNumber?: string;
}

const DecksPickBreakdown: React.FC<DecksPickBreakdownProps> = ({ draft, seatNumber, defaultIndex = '0' }) => {
  const [pickNumber, setPickNumber] = useQueryParam('pick', defaultIndex);

  if (!draft.InitialState && !draft.DraftmancerLog) {
    return <Text>Sorry, we cannot display the pick breakdown for this draft.</Text>;
  }

  return <CubeBreakdown pickNumber={pickNumber} seatNumber={seatNumber} draft={draft} setPickNumber={setPickNumber} />;
};

export default DecksPickBreakdown;
