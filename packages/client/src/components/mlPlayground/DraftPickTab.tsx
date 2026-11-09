import React, { useCallback } from 'react';

import Checkbox from 'components/base/Checkbox';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import LoadingButton from 'components/LoadingButton';
import useLocalStorage from 'hooks/useLocalStorage';

import { ACTION_BUTTON_CLASS, CardListInput, PlaygroundForm } from './ListInputs';
import ListReport, { ErrorNotice } from './ListReport';
import RankedCards, { listText, ResultsHeader } from './ResultsView';
import { DraftResponse, ListSummary, ResultItem } from './types';
import usePlaygroundRequest from './usePlaygroundRequest';

const summaryText = (summary: ListSummary, skipCardID?: string): string =>
  summary.cards
    .flatMap((card) => {
      const count = card.cardID === skipCardID ? card.count - 1 : card.count;
      return count > 0 ? [`${count} ${card.name}`] : [];
    })
    .join('\n');

/**
 * A draft bot's view of a pack: the draft_decoder's pick probabilities for each card in the pack,
 * given the cards already drafted. Drafting a card moves it into the pool and asks again.
 */
const DraftPickTab: React.FC = () => {
  const [pack, setPack] = useLocalStorage('mlPlayground.draft.pack', '');
  const [pool, setPool] = useLocalStorage('mlPlayground.draft.pool', '');
  const [substitute, setSubstitute] = useLocalStorage('mlPlayground.draft.substitute', true);
  const { data, error, loading, run } = usePlaygroundRequest<DraftResponse>('draft');

  const evaluate = useCallback(
    (packText: string, poolText: string) => run({ pack: packText, pool: poolText, substitute }),
    [run, substitute],
  );

  const draftCard = useCallback(
    async (item: ResultItem) => {
      if (!data || loading) return;
      const nextPack = summaryText(data.pack, item.cardID);
      const nextPool = [summaryText(data.pool), `1 ${item.name}`].filter(Boolean).join('\n');
      setPack(nextPack);
      setPool(nextPool);
      if (nextPack.length > 0) {
        await evaluate(nextPack, nextPool);
      }
    },
    [data, evaluate, loading, setPack, setPool],
  );

  const picks = data?.picks ?? [];
  const topPick = picks[0];
  const poolCount = data ? data.pool.cards.reduce((sum, card) => sum + card.count, 0) : 0;
  // A pack drafted down to nothing leaves the last answer on screen; hide it.
  const packEmpty = pack.trim().length === 0;

  return (
    <Flexbox direction="col" gap="3">
      <PlaygroundForm
        options={<Checkbox label="Substitute unknown cards" checked={substitute} setChecked={setSubstitute} />}
        actions={
          <LoadingButton
            color="primary"
            className={ACTION_BUTTON_CLASS}
            loading={loading}
            onClick={() => evaluate(pack, pool)}
            disabled={pack.trim().length === 0}
          >
            Rate Pack
          </LoadingButton>
        }
      >
        <Row>
          <Col xs={12} md={6}>
            <CardListInput id="mlPlaygroundDraftPack" label="Pack" value={pack} setValue={setPack} />
          </Col>
          <Col xs={12} md={6}>
            <CardListInput id="mlPlaygroundDraftPool" label="Pool" value={pool} setValue={setPool} />
          </Col>
        </Row>
      </PlaygroundForm>

      {error && <ErrorNotice error={error} />}

      {loading && !data && (
        <div className="centered m-4">
          <Spinner xl />
        </div>
      )}

      {data && !packEmpty && (
        <>
          <Flexbox direction="col" gap="1">
            <ListReport label="Pack" summary={data.pack} />
            {data.pool.cards.length + data.pool.missing.length > 0 && <ListReport label="Pool" summary={data.pool} />}
          </Flexbox>
          <Flexbox direction="col" gap="2">
            <ResultsHeader title={`Pick ${poolCount + 1}`} copyText={() => listText(picks)}>
              <LoadingButton
                color="primary"
                outline
                loading={loading}
                disabled={!topPick}
                onClick={() => (topPick ? draftCard(topPick) : undefined)}
              >
                Take Top Pick
              </LoadingButton>
            </ResultsHeader>
            <RankedCards items={picks} startRank={1} highlightTop onCardClick={draftCard} />
          </Flexbox>
          {data.pool.cards.length > 0 && (
            <Flexbox direction="col" gap="2">
              <ResultsHeader title={`Pool · ${poolCount}`} copyText={() => listText(data.pool.cards)} />
              <RankedCards items={data.pool.cards} />
            </Flexbox>
          )}
        </>
      )}
    </Flexbox>
  );
};

export default DraftPickTab;
