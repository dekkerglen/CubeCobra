import React, { useEffect, useState } from 'react';

import CardType from '../../datatypes/Card';
import DraftLocation from '../drafting/DraftLocation';
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
}

const Pack: React.FC<PackProps> = ({
  pack = [],
  loading = false,
  loadingPredictions = false,
  title = 'Pack',
  disabled = false,
  ratings,
  error = false,
  onRetry,
  retryInProgress = false,
}) => {
  const [showRatings, setShowRatings] = useState(false);
  const maxRating = ratings ? Math.max(...ratings) : 0;

  useEffect(() => {
    setShowRatings(false);
  }, [pack]);

  return (
    <Card className="mt-3">
      <CardHeader className="flex justify-between items-center">
        <Text semibold lg>
          {title}
        </Text>
        {error ? (
          <Button onClick={onRetry} color="danger" disabled={retryInProgress}>
            {retryInProgress ? 'Retrying...' : 'Bot picks failed. Try again?'}
          </Button>
        ) : loadingPredictions ? (
          <Button color="secondary" disabled>
            Making Bot Picks...
          </Button>
        ) : (
          ratings &&
          ratings.length > 0 &&
          !showRatings && (
            <Button onClick={() => setShowRatings(true)} color="primary">
              Show CubeCobra Bot Ratings
            </Button>
          )
        )}
      </CardHeader>
      <CardBody>
        <div className="flex">
          <div className="flex-grow">
            {loading ? (
              <div className="centered py-3">
                <div className="spinner" />
              </div>
            ) : (
              <Row className="g-0" sm={4} lg={8}>
                {pack.map((card, index) => {
                  const isHighestRated = ratings && ratings[index] === maxRating;
                  return (
                    <Col key={`pack-${card.details?.scryfall_id}-${index}`} xs={1}>
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
