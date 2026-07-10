import React, { useEffect, useState } from 'react';

import CardType from '@utils/datatypes/Card';

import DraftLocation from '../drafting/DraftLocation';
import { getPackMinHeight } from '../utils/packViewConstants';
import Button from './base/Button';
import { Card, CardBody, CardHeader } from './base/Card';
import { Col, Row } from './base/Layout';
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

const PACK_GRID_COLUMNS = {
  base: 4,
  md: 4,
  lg: 5,
  xl: 6,
  xxl: 8,
} as const;

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
  const [minHeight, setMinHeight] = useState(() =>
    getPackMinHeight(
      Math.max(pack.length, packSize ?? pack.length),
      PACK_GRID_COLUMNS.base,
      typeof window !== 'undefined' ? window.innerWidth : 768,
    ),
  );
  const maxRating = ratings ? Math.max(...ratings) : 0;

  useEffect(() => {
    setShowRatings(false);
  }, [pack]);

  useEffect(() => {
    // The placeholder needs to follow the same breakpoint behaviour as the grid itself,
    // but once cards are actually rendered we switch to the real card count so small packs
    // do not leave unnecessary blank space below the last row.
    const updateMinHeight = () => {
      const width = window.innerWidth;
      const columns =
        width >= 1536
          ? PACK_GRID_COLUMNS.xxl
          : width >= 1280
            ? PACK_GRID_COLUMNS.xl
            : width >= 1024
              ? PACK_GRID_COLUMNS.lg
              : width >= 768
                ? PACK_GRID_COLUMNS.md
                : PACK_GRID_COLUMNS.base;

      const targetCardCount = loading ? Math.max(pack.length, packSize ?? pack.length) : pack.length;
      setMinHeight(getPackMinHeight(targetCardCount, columns, width));
    };

    updateMinHeight();
    window.addEventListener('resize', updateMinHeight);

    return () => window.removeEventListener('resize', updateMinHeight);
  }, [loading, pack.length, packSize]);

  return (
    <Card className="mt-3">
      <CardHeader className="flex justify-between items-center">
        <Text semibold lg>
          {title}
        </Text>
        <div className="flex gap-2 items-center">
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
              <Row className="g-0" md={4} lg={5} xl={6} xxl={8}>
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
