import React, { useCallback, useMemo, useState } from 'react';

import { cdnUrl } from '@utils/cdnUrl';

import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import { Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import useLocalStorage from 'hooks/useLocalStorage';

import { ACTION_BUTTON_CLASS, CardListInput, PlaygroundForm } from './ListInputs';
import ListReport, { ErrorNotice } from './ListReport';
import RankedCards, { listText, ResultsHeader } from './ResultsView';
import { DeckbuildResponse, DeckCard, ResultItem } from './types';
import usePlaygroundRequest from './usePlaygroundRequest';

const groupCards = (cards: DeckCard[]): ResultItem[] => {
  const grouped = new Map<string, ResultItem>();
  for (const card of cards) {
    const existing = grouped.get(card.cardID);
    if (existing) existing.count = (existing.count ?? 1) + 1;
    else grouped.set(card.cardID, { cardID: card.cardID, name: card.name, count: 1 });
  }
  return [...grouped.values()];
};

export const ColorSymbols: React.FC<{ colors: string[] }> = ({ colors }) => (
  <span className="inline-flex items-center gap-0.5">
    {colors.map((color) => (
      <img
        key={color}
        src={cdnUrl(`/content/symbols/${color.toLowerCase()}.png`)}
        alt={color}
        title={color}
        className="w-5 h-5"
      />
    ))}
  </span>
);

/**
 * The bot deckbuilder on a pasted pool: the deck a bot would build from it after a draft, the
 * deck_build_decoder's rating for every pool card, and the name a draft would give the seat.
 */
const DeckbuildTab: React.FC = () => {
  const [pool, setPool] = useLocalStorage('mlPlayground.deckbuild.pool', '');
  const [spells, setSpells] = useLocalStorage('mlPlayground.deckbuild.spells', '23');
  const [lands, setLands] = useLocalStorage('mlPlayground.deckbuild.lands', '17');
  const [substitute, setSubstitute] = useLocalStorage('mlPlayground.deckbuild.substitute', true);
  const { data, error, loading, run } = usePlaygroundRequest<DeckbuildResponse>('deckbuild');
  const [view, setView] = useState<'deck' | 'sideboard' | 'ratings'>('deck');

  const build = useCallback(
    () =>
      run({
        pool,
        spells: parseInt(spells, 10) || 23,
        lands: parseInt(lands, 10) || 0,
        substitute,
      }),
    [lands, pool, run, spells, substitute],
  );

  const mainboard = useMemo(() => groupCards(data?.mainboard ?? []), [data]);
  const sideboard = useMemo(() => groupCards(data?.sideboard ?? []), [data]);
  const buildRatings = data?.buildRatings ?? [];

  return (
    <Flexbox direction="col" gap="3">
      <PlaygroundForm
        options={<Checkbox label="Substitute unknown cards" checked={substitute} setChecked={setSubstitute} />}
        actions={
          <LoadingButton
            color="primary"
            className={ACTION_BUTTON_CLASS}
            loading={loading}
            onClick={build}
            disabled={pool.trim().length === 0}
          >
            Build Deck
          </LoadingButton>
        }
      >
        <CardListInput id="mlPlaygroundDeckbuildPool" label="Pool" value={pool} setValue={setPool} />
        <Row xs={2} md={6}>
          <Col xs={1}>
            <Input
              id="mlPlaygroundDeckbuildSpells"
              label="Spells"
              type="number"
              value={spells}
              onChange={(event) => setSpells(event.target.value)}
              otherInputProps={{ min: 1, max: 100 }}
            />
          </Col>
          <Col xs={1}>
            <Input
              id="mlPlaygroundDeckbuildLands"
              label="Lands"
              type="number"
              value={lands}
              onChange={(event) => setLands(event.target.value)}
              otherInputProps={{ min: 0, max: 60 }}
            />
          </Col>
        </Row>
      </PlaygroundForm>

      {error && <ErrorNotice error={error} />}

      {loading && !data && (
        <div className="centered m-4">
          <Spinner xl />
        </div>
      )}

      {data && (
        <Flexbox direction="col" gap="2">
          <ListReport label="Pool" summary={data.pool} />
          <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
            <ColorSymbols colors={data.colors} />
            <Text xl semibold>
              {data.archetype ?? 'Unclassified'}
            </Text>
          </Flexbox>
          <Tabs
            className="border-b border-border"
            activeTab={['deck', 'sideboard', 'ratings'].indexOf(view)}
            tabs={[
              { label: `Deck · ${data.mainboard.length}`, onClick: () => setView('deck') },
              { label: `Sideboard · ${data.sideboard.length}`, onClick: () => setView('sideboard') },
              { label: 'Build Ratings', onClick: () => setView('ratings') },
            ]}
          />
          {view === 'deck' && (
            <>
              <ResultsHeader title="Mainboard" copyText={() => listText(mainboard)} />
              <RankedCards items={mainboard} sortAsDeck />
            </>
          )}
          {view === 'sideboard' && (
            <>
              <ResultsHeader title="Sideboard" copyText={() => listText(sideboard)} />
              <RankedCards items={sideboard} sortAsDeck />
            </>
          )}
          {view === 'ratings' && (
            <>
              <ResultsHeader title="Pool" copyText={() => listText(buildRatings)} />
              <RankedCards items={buildRatings} startRank={1} />
            </>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default DeckbuildTab;
