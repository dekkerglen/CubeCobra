import React, { useCallback, useState } from 'react';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import useLatestRequest from 'hooks/useLatestRequest';
import useLocalStorage from 'hooks/useLocalStorage';

import { ACTION_BUTTON_CLASS, CardListInput, FilterField, isFilterUsable, PlaygroundForm } from './ListInputs';
import ListReport, { ErrorNotice } from './ListReport';
import RankedCards, { listText, ResultsHeader } from './ResultsView';
import { ListSummary, PlaygroundError, RatedCard, RecommendResponse } from './types';
import { usePlaygroundFetch } from './usePlaygroundRequest';

const MAX_TARGET = 1000;
const MAX_STEP = 100;
const PAGE_SIZE = 96;

const clamp = (value: string, fallback: number, min: number, max: number): number => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

/**
 * Seed Crystal on a pasted list: repeatedly asks the cube_decoder for the cards that best fit
 * the list so far (within the filter) and adds the top few, until the list reaches the target
 * size. Each step's picks join the context of the next.
 */
const GrowTab: React.FC = () => {
  const [cards, setCards] = useLocalStorage('mlPlayground.grow.cards', '');
  const [filter, setFilter] = useLocalStorage('mlPlayground.grow.filter', '');
  const [target, setTarget] = useLocalStorage('mlPlayground.grow.target', '360');
  const [step, setStep] = useLocalStorage('mlPlayground.grow.step', '10');
  const [substitute, setSubstitute] = useLocalStorage('mlPlayground.grow.substitute', false);

  const post = usePlaygroundFetch();
  const { begin, invalidate } = useLatestRequest();
  const [seed, setSeed] = useState<ListSummary | null>(null);
  const [added, setAdded] = useState<RatedCard[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<PlaygroundError | null>(null);
  const [page, setPage] = useState(0);
  // The inputs the cards shown were grown from. Growing again with the same inputs continues.
  const [grownFrom, setGrownFrom] = useState<string | null>(null);

  const targetSize = clamp(target, 360, 1, MAX_TARGET);
  const stepSize = clamp(step, 10, 1, MAX_STEP);
  const canGrow = isFilterUsable(filter);

  const grow = useCallback(async () => {
    if (!canGrow) return;
    const inputs = JSON.stringify([cards, filter, substitute]);
    const resume = grownFrom === inputs && (seed?.cards.length ?? 0) + added.length < targetSize;
    setGrownFrom(inputs);

    let seedSummary = resume ? seed : null;
    let current = resume ? added : [];
    if (!resume) {
      setSeed(null);
      setAdded([]);
      setPage(0);
    }
    setError(null);
    setRunning(true);
    const request = begin();

    try {
      for (;;) {
        if (seedSummary && seedSummary.cards.length + current.length >= targetSize) break;
        const result = await post<RecommendResponse>(
          'recommend',
          {
            cards,
            filterText: filter,
            substitute,
            skip: 0,
            limit: stepSize,
            extra: current.map((card) => card.oracle),
            brief: seedSummary !== null,
          },
          request.signal,
        );
        if (!request.isCurrent()) return;
        const { data, error: requestError } = result;
        if (!data) {
          setError(requestError);
          break;
        }
        if (data.list) {
          seedSummary = data.list;
          setSeed(seedSummary);
        }
        const room = targetSize - (seedSummary?.cards.length ?? 0) - current.length;
        // Cards the model can't score rank last; once they're all that's left, stop.
        const next = data.adds.filter((card) => card.rating !== null).slice(0, Math.max(0, room));
        if (next.length === 0) break;
        current = [...current, ...next];
        setAdded(current);
      }
    } catch {
      // Aborted by Stop, Reset or a newer run.
    } finally {
      if (request.isCurrent()) setRunning(false);
    }
  }, [added, begin, canGrow, cards, filter, grownFrom, post, seed, stepSize, substitute, targetSize]);

  const stop = useCallback(() => {
    invalidate();
    setRunning(false);
  }, [invalidate]);

  const reset = useCallback(() => {
    invalidate();
    setGrownFrom(null);
    setRunning(false);
    setSeed(null);
    setAdded([]);
    setPage(0);
    setError(null);
  }, [invalidate]);

  const seedCount = seed?.cards.length ?? 0;
  const total = seedCount + added.length;
  const resumable = added.length > 0 && total < targetSize && grownFrom === JSON.stringify([cards, filter, substitute]);
  const progress = Math.min(100, (total / targetSize) * 100);
  const allCards = () => listText([...(seed?.cards ?? []), ...added]);
  const pageCount = Math.ceil(added.length / PAGE_SIZE);

  return (
    <Flexbox direction="col" gap="3">
      <PlaygroundForm
        options={<Checkbox label="Substitute unknown cards" checked={substitute} setChecked={setSubstitute} />}
        actions={
          <>
            <Button color="secondary" onClick={reset} disabled={running || (added.length === 0 && !seed)}>
              Reset
            </Button>
            {running ? (
              <Button color="danger" onClick={stop} className={ACTION_BUTTON_CLASS}>
                Stop
              </Button>
            ) : (
              <Button color="primary" onClick={grow} disabled={!canGrow} className={ACTION_BUTTON_CLASS}>
                {resumable ? 'Continue' : 'Grow'}
              </Button>
            )}
          </>
        }
      >
        <CardListInput id="mlPlaygroundGrowCards" label="Seed" value={cards} setValue={setCards} />
        <Row>
          <Col xs={12} md={8}>
            <FilterField id="mlPlaygroundGrowFilter" value={filter} setValue={setFilter} />
          </Col>
          <Col xs={6} md={2}>
            <Input
              id="mlPlaygroundGrowTarget"
              label="Target size"
              type="number"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              otherInputProps={{ min: 1, max: MAX_TARGET }}
            />
          </Col>
          <Col xs={6} md={2}>
            <Input
              id="mlPlaygroundGrowStep"
              label="Cards per step"
              type="number"
              value={step}
              onChange={(event) => setStep(event.target.value)}
              otherInputProps={{ min: 1, max: MAX_STEP }}
            />
          </Col>
        </Row>
      </PlaygroundForm>

      {(running || seed) && (
        <Flexbox direction="col" gap="1">
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text sm semibold>
              {running ? 'Growing' : 'Grown'}
            </Text>
            <Text sm className="tabular-nums text-text-secondary">
              {total.toLocaleString()} / {targetSize.toLocaleString()}
            </Text>
          </Flexbox>
          <div className="h-2 w-full rounded-full bg-bg-active overflow-hidden">
            <div
              className="h-full rounded-full bg-button-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Flexbox>
      )}

      {seed && seed.cards.length + seed.missing.length > 0 && <ListReport label="Seed" summary={seed} />}

      {error && <ErrorNotice error={error} />}

      {added.length > 0 && (
        <Flexbox direction="col" gap="2">
          <ResultsHeader title={`Added · ${added.length.toLocaleString()}`} copyText={allCards}>
            {pageCount > 1 && <Pagination count={pageCount} active={page} onClick={setPage} />}
          </ResultsHeader>
          <RankedCards items={added.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} startRank={page * PAGE_SIZE + 1} />
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default GrowTab;
