import React, { useCallback, useState } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import useLocalStorage from 'hooks/useLocalStorage';

import { ColorSymbols } from './DeckbuildTab';
import { ACTION_BUTTON_CLASS, CardListInput, PlaygroundForm } from './ListInputs';
import ListReport, { ErrorNotice } from './ListReport';
import { ScoreBar } from './ResultsView';
import { ArchetypeResponse, ArchetypeResult } from './types';
import usePlaygroundRequest from './usePlaygroundRequest';

const TOP_ARCHETYPES = 8;

const formatSimilarity = (value: number): string => value.toFixed(3);

/** The 128 embedding dimensions as a strip of cells, shaded by sign and size. */
const EmbeddingStrip: React.FC<{ embedding: number[] }> = ({ embedding }) => {
  const scale = Math.max(...embedding.map((value) => Math.abs(value)), 1e-9);
  return (
    <div className="grid grid-cols-[repeat(32,minmax(0,1fr))] gap-px rounded overflow-hidden border border-border">
      {embedding.map((value, index) => {
        const alpha = Math.min(1, Math.abs(value) / scale);
        const color = value >= 0 ? '--button-primary' : '--button-danger';
        return (
          <div
            key={index}
            className="aspect-square"
            style={{ backgroundColor: `rgb(var(${color}) / ${alpha.toFixed(3)})` }}
            title={`${index}: ${value.toFixed(4)}`}
          />
        );
      })}
    </div>
  );
};

const CopyEmbedding: React.FC<{ embedding: number[] }> = ({ embedding }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(embedding));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="text-sm text-link hover:text-link-active" onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const ResultCard: React.FC<{ title: string; result: ArchetypeResult }> = ({ title, result }) => {
  const [showAll, setShowAll] = useState(false);
  const top = result.archetypes[0];
  const shown = showAll ? result.archetypes : result.archetypes.slice(0, TOP_ARCHETYPES);

  return (
    <Card className="h-full">
      <CardHeader>
        <Flexbox direction="row" alignItems="center" justify="between" gap="2" wrap="wrap">
          <Text sm semibold className="text-text-secondary">
            {title}
          </Text>
          <Flexbox direction="row" alignItems="center" gap="2">
            <ColorSymbols colors={result.colors} />
            <Text xl semibold>
              {top?.label ?? 'Unclassified'}
            </Text>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="4">
          <ListReport summary={result.list} />
          <Flexbox direction="col" gap="1">
            {shown.map((match) => (
              <Flexbox key={match.label} direction="row" alignItems="center" gap="3">
                <Text sm semibold={match === top} className="w-36 shrink-0 truncate">
                  {match.label}
                </Text>
                <ScoreBar rating={match.similarity} format={formatSimilarity} className="flex-grow" />
              </Flexbox>
            ))}
            {result.archetypes.length > TOP_ARCHETYPES && (
              <button
                type="button"
                className="self-start text-sm text-link hover:text-link-active"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show fewer' : `Show all · ${result.archetypes.length}`}
              </button>
            )}
          </Flexbox>
          {result.embedding.length > 0 && (
            <Flexbox direction="col" gap="1">
              <Flexbox direction="row" justify="between" alignItems="center">
                <Text sm semibold>
                  Embedding
                </Text>
                <CopyEmbedding embedding={result.embedding} />
              </Flexbox>
              <EmbeddingStrip embedding={result.embedding} />
            </Flexbox>
          )}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

/**
 * The encoder's view of a list: its embedding, the archetypes whose cluster centers it sits
 * closest to (how drafts name decks), and how alike two lists' embeddings are.
 */
const ArchetypeTab: React.FC = () => {
  const [cards, setCards] = useLocalStorage('mlPlayground.archetype.cards', '');
  const [compare, setCompare] = useLocalStorage('mlPlayground.archetype.compare', '');
  const [substitute, setSubstitute] = useLocalStorage('mlPlayground.archetype.substitute', false);
  const [ignoreBasics, setIgnoreBasics] = useLocalStorage('mlPlayground.archetype.ignoreBasics', true);
  const { data, error, loading, run } = usePlaygroundRequest<ArchetypeResponse>('archetype');

  const classify = useCallback(
    () => run({ cards, compare, substitute, ignoreBasics }),
    [cards, compare, ignoreBasics, run, substitute],
  );

  const results = data?.results ?? [];
  const similarity = data?.similarity ?? null;

  return (
    <Flexbox direction="col" gap="3">
      <PlaygroundForm
        options={
          <>
            <Checkbox label="Substitute unknown cards" checked={substitute} setChecked={setSubstitute} />
            <Checkbox label="Ignore basic lands" checked={ignoreBasics} setChecked={setIgnoreBasics} />
          </>
        }
        actions={
          <LoadingButton
            color="primary"
            className={ACTION_BUTTON_CLASS}
            loading={loading}
            onClick={classify}
            disabled={cards.trim().length === 0}
          >
            Classify
          </LoadingButton>
        }
      >
        <Row>
          <Col xs={12} md={6}>
            <CardListInput id="mlPlaygroundArchetypeCards" label="Deck" value={cards} setValue={setCards} />
          </Col>
          <Col xs={12} md={6}>
            <CardListInput id="mlPlaygroundArchetypeCompare" label="Compare" value={compare} setValue={setCompare} />
          </Col>
        </Row>
      </PlaygroundForm>

      {error && <ErrorNotice error={error} />}

      {loading && !data && (
        <div className="centered m-4">
          <Spinner xl />
        </div>
      )}

      {results.length > 0 && (
        <Flexbox direction="col" gap="2">
          {similarity !== null && (
            <Card>
              <CardBody>
                <Flexbox direction="row" alignItems="center" gap="3">
                  <Text sm semibold className="w-36 shrink-0">
                    Similarity
                  </Text>
                  <ScoreBar rating={similarity} format={formatSimilarity} className="flex-grow" />
                </Flexbox>
              </CardBody>
            </Card>
          )}
          <Row>
            {results.map((result, index) => (
              <Col key={index} xs={12} lg={results.length > 1 ? 6 : 12}>
                <ResultCard title={index === 0 ? 'Deck' : 'Compare'} result={result} />
              </Col>
            ))}
          </Row>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default ArchetypeTab;
