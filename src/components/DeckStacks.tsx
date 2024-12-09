import React from 'react';
import { CardBody, CardHeader } from 'components/base/Card';
import { Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardStack from 'components/card/CardStack';
import DraggableCard from 'components/DraggableCard';
import Location, { location } from 'drafting/DraftLocation';
import Card from 'datatypes/Card';

interface DeckStacksProps {
  cards: Card[][][];
  title: string;
  subtitle?: React.ReactNode;
  locationType: location;
  onClickCard?: (card: Card) => void;
}

const DeckStacks: React.FC<DeckStacksProps> = ({ cards, title, subtitle, locationType }) => (
  <>
    <CardHeader>
      <Flexbox direction="row" alignItems="end" justify="between">
        <Text semibold lg>
          {title}
        </Text>
        <Text semibold md>
          {subtitle}
        </Text>
      </Flexbox>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) => (
        <Row key={`row-${index}`} xs={4} md={8}>
          {row.map((column, index2) => (
            <CardStack
              key={`row-${index}-col-${index2}`}
              location={new Location(locationType, index, index2, column.length)}
            >
              {column.map((card, index3) => (
                <div className="stacked" key={`row-${index}-col-${index2}-card-${index3}`}>
                  <DraggableCard location={new Location(locationType, index, index2, index3)} card={card} />
                </div>
              ))}
            </CardStack>
          ))}
        </Row>
      ))}
    </CardBody>
  </>
);

export default DeckStacks;
