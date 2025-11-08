import React from 'react';

import CardType from '@utils/datatypes/Card';
import { Card, CardBody } from '../base/Card';
import { Col, Flexbox, Row } from '../base/Layout';
import Text from '../base/Text';
import CardGrid from '../card/CardGrid';
import CardListGroup from '../card/CardListGroup';

interface CardWithIndex {
  cardIndex: number;
}

interface DraftBreakdownDisplayProps {
  showRatings: boolean;
  setShowRatings: (show: boolean) => void;
  packNumber: number;
  pickNumber: number;
  cardsInPack: CardWithIndex[];
  picksList: CardWithIndex[][];
  ratings?: number[];
  actualPickIndex?: number;
  cards: CardType[];
  onPickClick: (packIndex: number, pickIndex: number) => void;
  cardUrlPrefix?: string;
  predictedWeight?: number;
  userSelection?: string;
}

const DraftBreakdownDisplay: React.FC<DraftBreakdownDisplayProps> = ({
  showRatings,
  setShowRatings,
  packNumber,
  pickNumber,
  cardsInPack,
  picksList,
  ratings,
  actualPickIndex,
  cards,
  onPickClick,
  cardUrlPrefix = '/tool/card',
}) => {
  return (
    <div className="draft-breakdown-display" role="region" aria-label="Draft picks and recommendations">
      <div className="text-xs text-gray-600 text-center mb-2">
        (Use arrow keys ← → to navigate picks)
      </div>
      {showRatings && (
        <div className="recommendation-description" style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>
            These values are generated using the CubeCobra machine learning engine; the highest value indicates what a bot's pick would have been in that position in the draft.
          </p>
        </div>
      )}
      <div>
        <Card className="mb-3">
          <CardBody className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showRatings"
              checked={showRatings}
              onChange={(e) => setShowRatings(e.target.checked)}
            />
            <label htmlFor="showRatings">
              <Text>Show CubeCobra Pick Recommendation</Text>
            </label>
          </CardBody>
        </Card>
        <Row>
          <Col xs={6} sm={4} lg={3} xl={2}>
            <Text semibold lg>Pick Order</Text>
            <Flexbox direction="col" gap="2">
              {picksList.filter(list => list.length > 0).map((list, listindex) => ( // Only show packs that have cards
                <CardListGroup
                  key={listindex}
                  cards={list.map(({ cardIndex }) => cards[cardIndex])}
                  heading={`Pack ${listindex + 1}`} // Add 1 for display
                  selectedIndex={listindex === packNumber ? pickNumber - 1 : undefined}
                  onClick={(index) => onPickClick(listindex, index)}
                />
              ))}
            </Flexbox>
          </Col>
          <Col xs={6} sm={8} lg={9} xl={10}>
            <Text semibold lg>{`Pack ${packNumber + 1}: Pick ${pickNumber}`}</Text> {/* Add 1 for display */}
            <CardGrid
              xs={2}
              sm={3}
              md={4}
              lg={5}
              xl={6}
              cards={cardsInPack.map(({ cardIndex }) => cards[cardIndex])}
              hrefFn={(card) => `${cardUrlPrefix}/${card?.details?.scryfall_id}`}
              ratings={ratings}
              selectedIndex={actualPickIndex}
            />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default DraftBreakdownDisplay;
