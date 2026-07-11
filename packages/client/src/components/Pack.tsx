import React, { useEffect, useState } from 'react';

import CardType from '@utils/datatypes/Card';

import DraftLocation from '../drafting/DraftLocation';
import useLocalStorage from '../hooks/useLocalStorage';
import { getPackMinHeight } from '../utils/packViewConstants';
import Button from './base/Button';
import { Card, CardBody, CardHeader } from './base/Card';
import { Col, NumCols, Row } from './base/Layout';
import Select from './base/Select';
import Text from './base/Text';
import DraggableCard from './DraggableCard';
import FoilCardImage from './FoilCardImage';

interface PackProps {
  pack: CardType[];
  loading?: boolean;
  loadingPredictions?: boolean;
  title?: string;
  disabled?: boolean;
  ratings?: number[];
  error?: boolean;
  onRetry?: () => void;
  onPickMade?: () => void;
  retryInProgress?: boolean;
  onEndDraft?: () => void;
  packSize: number;
  // Extra controls rendered in the pack header toolbar (e.g. the "Share as P1P1"
  // button shown at pack 1 pick 1). Kept generic so Pack has no draft-specific deps.
  headerActions?: React.ReactNode;
}

// 'auto' keeps the responsive breakpoint behavior below; a number forces that
// many cards per row at every breakpoint (lets players make cards larger, e.g.
// 2-3 per row on mobile — see issue #2931).
type CardsPerRowSetting = 'auto' | NumCols;

// Single source of truth for the 'auto' responsive column counts. Both the grid
// layout (the Row props below) and the minHeight estimate (getPackColumns) derive
// from this so the reserved height can never disagree with the rendered grid.
const AUTO_PACK_GRID_COLUMNS = {
  base: 4,
  md: 4,
  lg: 5,
  xl: 6,
  xxl: 8,
} as const;

// The Row responsive props for 'auto' mode (base maps to Row's default, so it is omitted).
const AUTO_ROW_COLUMN_PROPS = {
  md: AUTO_PACK_GRID_COLUMNS.md,
  lg: AUTO_PACK_GRID_COLUMNS.lg,
  xl: AUTO_PACK_GRID_COLUMNS.xl,
  xxl: AUTO_PACK_GRID_COLUMNS.xxl,
} as const;

const CARDS_PER_ROW_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto Cards Per Row' },
  ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => ({
    value: `${n}`,
    label: `${n} Card${n === 1 ? '' : 's'} Per Row`,
  })),
];

// Column count actually rendered at a given viewport width, honoring the setting.
const getPackColumns = (setting: CardsPerRowSetting, width: number): number => {
  if (setting !== 'auto') {
    return setting;
  }
  return width >= 1536
    ? AUTO_PACK_GRID_COLUMNS.xxl
    : width >= 1280
      ? AUTO_PACK_GRID_COLUMNS.xl
      : width >= 1024
        ? AUTO_PACK_GRID_COLUMNS.lg
        : width >= 768
          ? AUTO_PACK_GRID_COLUMNS.md
          : AUTO_PACK_GRID_COLUMNS.base;
};

const Pack: React.FC<PackProps> = ({
  pack = [],
  loading = false,
  title = 'Pack',
  disabled = false,
  ratings,
  error = false,
  onRetry,
  retryInProgress = false,
  packSize,
  headerActions,
}) => {
  const [showRatings, setShowRatings] = useState(false);
  const [cardsPerRow, setCardsPerRow] = useLocalStorage<CardsPerRowSetting>('draftPackCardsPerRow', 'auto');
  const [minHeight, setMinHeight] = useState(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 768;
    return getPackMinHeight(Math.max(pack.length, packSize ?? pack.length), getPackColumns(cardsPerRow, width), width);
  });
  const maxRating = ratings ? Math.max(...ratings) : 0;

  useEffect(() => {
    setShowRatings(false);
  }, [pack]);

  useEffect(() => {
    // The placeholder needs to follow the same breakpoint behavior as the grid itself,
    // but once cards are actually rendered we switch to the real card count so small packs
    // do not leave unnecessary blank space below the last row.
    const updateMinHeight = () => {
      const width = window.innerWidth;
      const columns = getPackColumns(cardsPerRow, width);

      const targetCardCount = loading ? Math.max(pack.length, packSize ?? pack.length) : pack.length;
      setMinHeight(getPackMinHeight(targetCardCount, columns, width));
    };

    updateMinHeight();
    window.addEventListener('resize', updateMinHeight);

    return () => window.removeEventListener('resize', updateMinHeight);
  }, [loading, pack.length, packSize, cardsPerRow]);

  return (
    <Card className="mt-3">
      <CardHeader className="flex flex-wrap justify-between items-center gap-2">
        <Text semibold lg className="whitespace-nowrap">
          {title}
        </Text>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-40 shrink-0">
            <Select
              dense
              value={`${cardsPerRow}`}
              setValue={(value) => setCardsPerRow(value === 'auto' ? 'auto' : (parseInt(value, 10) as NumCols))}
              className="bg-bg-active"
              options={CARDS_PER_ROW_OPTIONS}
            />
          </div>
          {headerActions}
          {error ? (
            <Button onClick={onRetry} color="danger" disabled={retryInProgress}>
              {retryInProgress ? 'Retrying...' : 'Bot picks failed. Try again?'}
            </Button>
          ) : (
            <Button
              className={ratings && ratings.length > 0 && !showRatings ? '' : 'invisible'}
              onClick={() => setShowRatings(true)}
              color="primary"
            >
              Show CubeCobra Bot Ratings
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex">
          <div className="flex-grow" style={{ minHeight: `${minHeight}px` }}>
            {loading ? (
              <div className="centered py-3">
                <div className="spinner" />
              </div>
            ) : (
              <Row className="g-0" {...(cardsPerRow === 'auto' ? AUTO_ROW_COLUMN_PROPS : { xs: cardsPerRow })}>
                {pack.map((card, index) => {
                  const isHighestRated = ratings && ratings[index] === maxRating;
                  return (
                    <Col key={`pack-${card.details?.scryfall_id}-${index}`} xs={1} className="aspect-[61/85]">
                      <div
                        className={`relative ${isHighestRated && showRatings ? 'ring-[5px] ring-offset-0 ring-[#007BFF] rounded-lg' : ''}`}
                      >
                        {disabled || error ? (
                          <FoilCardImage card={card} autocard />
                        ) : (
                          <DraggableCard location={DraftLocation.pack(index)} data-index={index} card={card} />
                        )}
                        {ratings && ratings[index] !== undefined && showRatings && (
                          <div
                            className={`absolute bottom-[5%] left-1/2 -translate-x-1/2 ${
                              isHighestRated ? 'bg-[#007BFF]/95' : 'bg-gray-700/80'
                            } text-white px-3 rounded-md text-xxs font-semibold tracking-tight`}
                            title={`Bot rates this card ${Math.round(ratings[index] * 100)}% for this pick`}
                          >
                            {Math.round(ratings[index] * 100)}%
                          </div>
                        )}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default Pack;
