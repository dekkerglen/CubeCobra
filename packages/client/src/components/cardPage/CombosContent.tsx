import React, { useContext, useEffect, useMemo, useState } from 'react';

import { cardId, detailsToCard } from '@utils/cardutil';

import { Combo } from '@utils/datatypes/cardCatalog';
import { CSRFContext } from '../../contexts/CSRFContext';
import { Card, CardBody } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';
import CardGrid from '../card/CardGrid';
import Markdown from '../Markdown';

const zoneLocations: Record<string, string> = {
  B: 'on the battlefield',
  G: 'in the graveyard',
  E: 'exiled',
  L: 'in the library',
  H: 'in your hand',
  C: 'in your command zone',
  D: 'in the deck',
  S: 'in the stack',
};

// Minimal placeholder CardDetails so CardGrid can render something while loading.
const createPlaceholderCard = (use: any) => ({
  scryfall_id: String(use.card.id ?? use.card.oracleId),
  oracle_id: use.card.oracleId,
  name: use.card.name,
  type: use.card.typeLine,
  set: '',
  collector_number: '',
  released_at: '',
  promo: false,
  reprint: false,
  digital: false,
  isToken: false,
  full_name: use.card.name,
  name_lower: use.card.name.toLowerCase(),
  artist: '',
  scryfall_uri: '',
  rarity: '',
  legalities: {},
  oracle_text: '',
  image_normal: '/content/default_card.png',
  cmc: 0,
  colors: [],
  color_identity: [],
  colorcategory: 'Colorless' as const,
  keywords: [],
  parsed_cost: [],
  border_color: 'black' as const,
  language: 'en',
  mtgo_id: -1,
  layout: '',
  full_art: false,
  error: false,
  prices: {},
  tokens: [],
  set_name: '',
  finishes: [],
});

const useFetchCardDetails = (combo?: Combo) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [byOracle, setByOracle] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const run = async () => {
      try {
        const uses = combo?.uses ?? [];
        const oracleIds = [...new Set(uses.map((u) => u.card.oracleId))];
        if (oracleIds.length === 0) {
          setByOracle(new Map());
          return;
        }

        const res = await csrfFetch('/cube/api/getdetailsforcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: oracleIds }),
        });

        if (!res.ok) throw new Error('Failed to fetch card details');
        const data = await res.json();

        const map = new Map<string, any>();
        const detailsArr: any[] = Array.isArray(data?.details) ? data.details : [];
        for (const d of detailsArr) {
          if (d?.oracle_id) map.set(d.oracle_id, d);
        }

        setByOracle(map);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        setByOracle(new Map());
      }
    };

    run();
  }, [combo, csrfFetch]);

  return { byOracle };
};

interface ComboCardProps {
  combo?: Combo;
}

const ComboCard: React.FC<ComboCardProps> = ({ combo }) => {
  const { byOracle } = useFetchCardDetails(combo);

  const cards = useMemo(() => {
    if (!combo) return [];
    const uses = combo?.uses ?? [];

    // Use fetched details, then placeholders
    return uses.map((u) => {
      const oid = u.card?.oracleId;
      const details = (oid && byOracle.get(oid)) ?? createPlaceholderCard(u);
      return detailsToCard(details);
    });
  }, [combo, byOracle]);

  if (!combo) return null;

  const usesForTitle = (combo?.uses ?? []).map((u) => u.card?.name ?? 'Unknown').join(' + ');

  return (
    <Card className="mb-3">
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Link href={`https://commanderspellbook.com/combo/${combo.id}`}>{usesForTitle}</Link>

          <CardGrid
            cards={cards}
            className="gap-2"
            xs={4}
            hrefFn={(card) => `/tool/card/${cardId(card)}`}
            cardProps={{ autocard: true }}
          />

          <ComboDetails combo={combo} />
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const ComboDetails: React.FC<{ combo: Combo }> = ({ combo }) => (
  <>
    <Text className="mt-2" semibold>
      Initial Card State
    </Text>
    {(combo?.uses ?? []).map((use, i) => (
      <Flexbox key={i} direction="col">
        <Text>
          <strong>{use?.quantity && use.quantity > 1 ? `${use.quantity}x ` : ''}</strong>
          {use?.card?.oracleId ? (
            <Link href={`/tool/card/${use.card.oracleId}`}>{use.card.name ?? 'Unknown'}</Link>
          ) : (
            <>{use?.card?.name ?? 'Unknown'}</>
          )}{' '}
          {(use?.zoneLocations ?? [])
            .map((z) => zoneLocations[z])
            .filter(Boolean)
            .join(', ')}
          .
        </Text>
        {use?.mustBeCommander && <Text className="ml-4">+ Must be a commander</Text>}
        {use?.exileCardState && <Text className="ml-4">+ Exile State: {use.exileCardState}</Text>}
        {use?.libraryCardState && <Text className="ml-4">+ Library State: {use.libraryCardState}</Text>}
        {use?.graveyardCardState && <Text className="ml-4">+ Graveyard State: {use.graveyardCardState}</Text>}
        {use?.battlefieldCardState && <Text className="ml-4">+ Battlefield State: {use.battlefieldCardState}</Text>}
      </Flexbox>
    ))}

    {(combo?.requires ?? []).map((req, i) => {
      const name = req?.template?.name ?? 'Unknown requirement';
      const query = req?.template?.scryfallQuery ?? '';
      const zones = (req?.zoneLocations ?? [])
        .map((z) => zoneLocations[z])
        .filter(Boolean)
        .join(', ');
      return (
        <Flexbox key={i} direction="col">
          <Text>
            <strong>{req?.quantity && req.quantity > 1 ? `${req.quantity}x ` : ''}</strong>
            {query ? (
              <Link href={`https://scryfall.com/search?q=${encodeURIComponent(query)}`}>{name}</Link>
            ) : (
              <>{name}</>
            )}{' '}
            {zones}.
          </Text>
          {req?.mustBeCommander && <Text className="ml-4">+ Must be a commander</Text>}
          {req?.exileCardState && <Text className="ml-4">+ Exile State: {req.exileCardState}</Text>}
          {req?.libraryCardState && <Text className="ml-4">+ Library State: {req.libraryCardState}</Text>}
          {req?.graveyardCardState && <Text className="ml-4">+ Graveyard State: {req.graveyardCardState}</Text>}
          {req?.battlefieldCardState && <Text className="ml-4">+ Battlefield State: {req.battlefieldCardState}</Text>}
        </Flexbox>
      );
    })}

    {combo?.notablePrerequisites && combo.notablePrerequisites.length > 0 && (
      <>
        <Text className="mt-2" semibold>
          Notable Prerequisites
        </Text>
        <Markdown markdown={combo.notablePrerequisites} />
      </>
    )}

    <Text className="mt-2" semibold>
      Steps
    </Text>
    <Markdown markdown={combo?.description ?? ''} />

    <Text className="mt-2" semibold>
      Results
    </Text>
    {(combo?.produces ?? []).map((p, i) =>
      p?.feature?.uncountable ? (
        <Text key={p?.feature?.id ?? i}>{p?.feature?.name ?? 'Unknown result'}</Text>
      ) : (
        <Text key={p?.feature?.id ?? i}>
          {p?.quantity ?? ''} {p?.feature?.name ?? 'Unknown result'}
        </Text>
      ),
    )}

    {combo?.notes && combo.notes.length > 0 && (
      <>
        <Text className="mt-2" semibold>
          Notes
        </Text>
        <Markdown markdown={combo.notes} />
      </>
    )}
  </>
);

export default ComboCard;
