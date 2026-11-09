import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppsIcon, CheckIcon, CopyIcon, ListUnorderedIcon } from '@primer/octicons-react';
import { cardCmc, cardType, detailsToCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import AddToCubeModal from 'components/modals/AddToCubeModal';
import withAutocard from 'components/WithAutocard';
import { useCardDetails } from 'hooks/useCardDetails';

import { ResultItem } from './types';

export type ResultsViewMode = 'grid' | 'table';

export const ResultsViewContext = createContext<{
  view: ResultsViewMode;
  setView: (view: ResultsViewMode) => void;
}>({ view: 'grid', setView: () => {} });

const AutocardA = withAutocard('a');

export const formatScore = (rating: number): string => `${(rating * 100).toFixed(1)}%`;

interface ScoreBarProps {
  rating: number | null | undefined;
  format?: (rating: number) => string;
  className?: string;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({ rating, format = formatScore, className }) => {
  if (rating === null || rating === undefined) {
    return <span className={classNames('text-sm text-text-secondary', className)}>—</span>;
  }
  const width = Math.max(0, Math.min(100, rating * 100));
  return (
    <span className={classNames('flex items-center gap-2 min-w-[9rem]', className)}>
      <span className="h-2 flex-grow rounded-full bg-bg-active overflow-hidden">
        <span className="block h-full rounded-full bg-button-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="text-sm tabular-nums w-14 text-right">{format(rating)}</span>
    </span>
  );
};

const CopyButton: React.FC<{ text: () => string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <Button color="secondary" outline onClick={copy} aria-label="Copy list" title="Copy list">
      <span className="flex items-center gap-1">
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      </span>
    </Button>
  );
};

const ViewToggle: React.FC = () => {
  const { view, setView } = useContext(ResultsViewContext);
  return (
    <Flexbox direction="row" gap="1">
      <Button
        color={view === 'grid' ? 'primary' : 'secondary'}
        outline={view !== 'grid'}
        onClick={() => setView('grid')}
        aria-label="Grid"
        title="Grid"
      >
        <AppsIcon size={16} />
      </Button>
      <Button
        color={view === 'table' ? 'primary' : 'secondary'}
        outline={view !== 'table'}
        onClick={() => setView('table')}
        aria-label="Table"
        title="Table"
      >
        <ListUnorderedIcon size={16} />
      </Button>
    </Flexbox>
  );
};

interface ResultsHeaderProps {
  title: React.ReactNode;
  // The list as text for the copy button: one "count name" line per card.
  copyText?: () => string;
  children?: React.ReactNode;
}

export const ResultsHeader: React.FC<ResultsHeaderProps> = ({ title, copyText, children }) => (
  <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
    <Text lg semibold>
      {title}
    </Text>
    <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
      {children}
      {copyText && <CopyButton text={copyText} />}
      <ViewToggle />
    </Flexbox>
  </Flexbox>
);

export const listText = (items: { name: string; count?: number }[]): string =>
  items.map((item) => `${item.count ?? 1} ${item.name}`).join('\n');

interface RankedCardsProps {
  items: ResultItem[];
  // Rank of the first item, for the table's # column. Leave out to hide the column.
  startRank?: number;
  // Ring the best-rated card in the grid, as a draft does for the bot's pick.
  highlightTop?: boolean;
  // Lay the cards out like a deck: spells by mana value, then lands.
  sortAsDeck?: boolean;
  // Replaces opening the add-to-cube modal on click.
  onCardClick?: (item: ResultItem) => void;
}

const RankedCards: React.FC<RankedCardsProps> = ({
  items,
  startRank,
  highlightTop = false,
  sortAsDeck = false,
  onCardClick,
}) => {
  const { view } = useContext(ResultsViewContext);
  const ids = useMemo(() => items.map((item) => item.cardID), [items]);
  const { details, loading } = useCardDetails(ids);
  const [modalCard, setModalCard] = useState<Card | null>(null);

  const entries = useMemo(() => {
    const resolved = items.flatMap((item, index) => {
      const found = details[item.cardID];
      return found ? [{ item, index, card: detailsToCard(found) }] : [];
    });
    if (sortAsDeck) {
      const isLand = (card: Card) => cardType(card).includes('Land');
      resolved.sort(
        (a, b) =>
          Number(isLand(a.card)) - Number(isLand(b.card)) ||
          cardCmc(a.card) - cardCmc(b.card) ||
          a.item.name.localeCompare(b.item.name),
      );
    }
    return resolved;
  }, [details, items, sortAsDeck]);

  if (items.length === 0) {
    return null;
  }
  if (loading && entries.length === 0) {
    return (
      <div className="centered m-4">
        <Spinner lg />
      </div>
    );
  }

  const showScores = items.some((item) => item.rating !== undefined);
  const showCounts = items.some((item) => (item.count ?? 1) > 1);
  const handleClick = (entry: (typeof entries)[number]) => {
    if (onCardClick) onCardClick(entry.item);
    else setModalCard(entry.card);
  };

  let body: React.ReactNode;
  if (view === 'grid') {
    body = (
      <CardGrid
        cards={entries.map((entry) => entry.card)}
        ratings={showScores ? entries.map((entry) => entry.item.rating ?? undefined) : undefined}
        highlightTop={highlightTop}
        quantities={showCounts ? entries.map((entry) => entry.item.count ?? 1) : undefined}
        xs={2}
        sm={3}
        md={4}
        lg={5}
        xl={6}
        xxl={8}
        cardProps={{ autocard: true, className: 'clickable' }}
        onClick={(_card, index) => handleClick(entries[index]!)}
        cubeTrayDraggable
      />
    );
  } else {
    const headers = [
      ...(startRank !== undefined ? ['#'] : []),
      ...(showCounts ? ['Qty'] : []),
      'Card',
      'Type',
      ...(showScores ? ['Score'] : []),
    ];
    body = (
      <Table
        headers={headers}
        hideOnMobile={['Type']}
        rows={entries.map((entry) => ({
          ...(startRank !== undefined ? { '#': <span className="tabular-nums">{startRank + entry.index}</span> } : {}),
          ...(showCounts ? { Qty: <span className="tabular-nums">{entry.item.count ?? 1}</span> } : {}),
          Card: (
            <AutocardA
              card={entry.card}
              href={`/tool/card/${entry.item.cardID}`}
              className="font-semibold text-link hover:text-link-active"
              onClick={(event: React.MouseEvent) => {
                if (onCardClick) {
                  event.preventDefault();
                  onCardClick(entry.item);
                }
              }}
            >
              {entry.item.name}
            </AutocardA>
          ),
          Type: <span className="text-sm text-text-secondary">{cardType(entry.card)}</span>,
          ...(showScores ? { Score: <ScoreBar rating={entry.item.rating} /> } : {}),
        }))}
      />
    );
  }

  return (
    <>
      {body}
      {modalCard && (
        <AddToCubeModal
          card={modalCard}
          isOpen={modalCard !== null}
          setOpen={(open) => {
            if (!open) setModalCard(null);
          }}
        />
      )}
    </>
  );
};

export default RankedCards;
