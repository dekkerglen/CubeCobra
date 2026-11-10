import React, { useContext, useEffect, useMemo, useState } from 'react';

import { cardId, cardOracleId } from '@utils/cardutil';
import type Card from '@utils/datatypes/Card';

import { Flexbox } from '../components/base/Layout';
import Link from '../components/base/Link';
import Spinner from '../components/base/Spinner';
import Table from '../components/base/Table';
import Text from '../components/base/Text';
import withAutocard from '../components/WithAutocard';
import { useAnalysisCards } from '../contexts/AnalysisViewContext';
import { CSRFContext } from '../contexts/CSRFContext';

const AutocardLink = withAutocard(Link);

interface CubeArchetype {
  label: string;
  share: number;
  topCards: { oracleId: string; name: string }[];
}

// The archetypes the analyzed cards support (POST /cube/api/archetypes), with the cards behind each.
const Archetypes: React.FC = () => {
  const cards = useAnalysisCards();
  const { csrfFetch } = useContext(CSRFContext);
  const [archetypes, setArchetypes] = useState<CubeArchetype[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const oracles = useMemo(() => [...new Set(cards.map(cardOracleId).filter(Boolean))], [cards]);
  const cardByOracle = useMemo(() => {
    const byOracle = new Map<string, Card>();
    for (const card of cards) {
      const oracleId = cardOracleId(card);
      if (oracleId && !byOracle.has(oracleId)) byOracle.set(oracleId, card);
    }
    return byOracle;
  }, [cards]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const response = await csrfFetch('/cube/api/archetypes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oracles }),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        if (!cancelled) setArchetypes(data.archetypes ?? []);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csrfFetch, oracles]);

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Text semibold lg>
        Archetypes
      </Text>
      {loading ? (
        <Flexbox direction="row" justify="center" className="m-2">
          <Spinner xl />
          <Text className="ml-2">Loading...</Text>
        </Flexbox>
      ) : failed ? (
        <Text className="text-red-600">Failed to load archetypes.</Text>
      ) : !archetypes || archetypes.length === 0 ? (
        <Text className="text-text-secondary">No archetypes found.</Text>
      ) : (
        <Table
          headers={['Archetype', 'Share', 'Cards']}
          wrapCells
          rows={archetypes.map((archetype) => ({
            Archetype: <span className="font-semibold">{archetype.label}</span>,
            Share: `${(archetype.share * 100).toFixed(1)}%`,
            Cards: (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {archetype.topCards.map(({ oracleId, name }) => {
                  const card = cardByOracle.get(oracleId);
                  return card ? (
                    <AutocardLink key={oracleId} card={card} href={`/tool/card/${encodeURIComponent(cardId(card))}`}>
                      {name}
                    </AutocardLink>
                  ) : (
                    <span key={oracleId}>{name}</span>
                  );
                })}
              </span>
            ),
          }))}
        />
      )}
    </Flexbox>
  );
};

export default Archetypes;
