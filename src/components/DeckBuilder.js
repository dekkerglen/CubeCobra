import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

const DeckBuilder = ({ cube, cubeID, initialDeck, basics, children }) => {
  const [hover, setHover] = useState(null);

  const onMouseDown = (event) => {
    console.log('Down');
  };
  const onMouseUp = (event) => {
    console.log('Up');
  };

  return (
    <div onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      {React.cloneElement(children, { onHover: setHover })}
    </div>
  );
};

DeckBuilder.propTypes = {
  basics: PropTypes.objectOf(PropTypes.object).isRequired,
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDeck: PropTypes.shape({
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  children: PropTypes.element.isRequired,
};

export default DeckBuilder;
