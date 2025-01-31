import React, { useContext } from 'react';

import DisplayContext from 'contexts/DisplayContext';

import Link from './base/Link';

const DeckBuilderStatsToggler: React.FC = () => {
  const { showDeckBuilderStatsPanel, toggleShowDeckBuilderStatsPanel } = useContext(DisplayContext);

  return (
    <Link onClick={toggleShowDeckBuilderStatsPanel}>{showDeckBuilderStatsPanel ? 'Hide' : 'Show'} Deck Stats</Link>
  );
};

export default DeckBuilderStatsToggler;
