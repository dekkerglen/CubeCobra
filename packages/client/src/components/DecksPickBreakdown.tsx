import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { isVoucher } from '@utils/cardutil';
import Deck from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';

import useLocalStorage from '../hooks/useLocalStorage';
import useQueryParam from '../hooks/useQueryParam';
import { modelScoresToProbabilities } from '../utils/botRatings';
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

  // Helper to get oracle_ids from a card index, expanding vouchers to sub-card oracle_ids
  const getCardOracleIds = useCallback(
    (cardIndex: number): string[] => {
      const card = draft.cards[cardIndex];
      if (!card) return [];

      if (isVoucher(card)) {
        // Prefer voucher_card_indices (new drafts), fallback to voucher_cards (legacy)
        if (card.voucher_card_indices && card.voucher_card_indices.length > 0) {
          return card.voucher_card_indices
            .map((idx) => draft.cards[idx]?.details?.oracle_id)
            .filter((id): id is string => Boolean(id));
        }
        if (card.voucher_cards && card.voucher_cards.length > 0) {
          return card.voucher_cards.map((vc) => vc.details?.oracle_id).filter((id): id is string => Boolean(id));
        }
      }

      return card.details?.oracle_id ? [card.details.oracle_id] : [];
    },
    [draft.cards],
  );

  useEffect(() => {
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

        const response = await fetch(`/api/draftbots/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pack: packOracleIds,
            picks: picksOracleIds,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Build a map of oracle -> rating
          // /api/draftbots/predict returns { prediction: [{ oracle, rating }, ...] } - flat array
          const oracleRatings = new Map<string, number>();
          (data.prediction || []).forEach((pred: { oracle: string; rating: number }) => {
            oracleRatings.set(pred.oracle, pred.rating);
          });

          // For each card in pack, sum the ratings of its unique oracle_ids (handles vouchers)
          // Deduplicate to avoid counting same oracle multiple times if voucher has duplicate cards
          // For vouchers, SUM is correct because picking a voucher gives you ALL sub-cards
          const rawRatings = packCardInfos.map((info) => {
            if (info.oracleIds.length === 0) return 0;
            const uniqueOracleIds = [...new Set(info.oracleIds)];
            return uniqueOracleIds.reduce((acc, oracleId) => acc + (oracleRatings.get(oracleId) || 0), 0);
          });

          setRatings(modelScoresToProbabilities(rawRatings));
        }
      } catch (error) {
        console.error('Error fetching predictions:', error);
      }
    };

    fetchPredictions();
  }, [cardsInPack, draft.cards, pack, pick, picksList, getCardOracleIds]);

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
