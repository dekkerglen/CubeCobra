import React, { useContext } from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from 'reactstrap';

import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';

import DeckPreview from 'components/DeckPreview';
import CubeContext from 'contexts/CubeContext';

const PlaytestDecksCard = ({ decks, ...props }) => {
  const { cube } = useContext(CubeContext);
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle tag="h5" className="mb-0">
          Recent Decks
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {decks.map((deck) => (
          <DeckPreview key={deck.id} deck={deck} />
        ))}
      </CardBody>
      <CardFooter>
        <a href={`/cube/deck/decks/${cube.id}`}>View all</a>
      </CardFooter>
    </Card>
  );
};

PlaytestDecksCard.propTypes = {
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
};

export default PlaytestDecksCard;
