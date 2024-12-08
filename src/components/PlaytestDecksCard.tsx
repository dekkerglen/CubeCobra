import React, { useContext } from 'react';
import { Card, CardFooter, CardHeader } from 'components/base/Card';
import DeckPreview from 'components/DeckPreview';
import CubeContext from 'contexts/CubeContext';
import Draft from 'datatypes/Draft';
import Text from 'components/base/Text';
import Link from 'components/base/Link';

interface PlaytestDecksCardProps {
  decks: Draft[];
}

const PlaytestDecksCard: React.FC<PlaytestDecksCardProps> = ({ decks }) => {
  const { cube } = useContext(CubeContext);
  return (
    <Card>
      <CardHeader>
        <Text lg semibold>
          Recent Decks
        </Text>
      </CardHeader>
      {decks.map((deck) => (
        <DeckPreview key={deck.id} deck={deck} />
      ))}
      <CardFooter>
        <Link href={`/cube/deck/decks/${cube.id}`}>
          <Text>View all</Text>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default PlaytestDecksCard;
