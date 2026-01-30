import React from 'react';

import Draft from '@utils/datatypes/Draft';

import { Flexbox } from 'components/base/Layout';
import PlaytestDecksCard from 'components/PlaytestDecksCard';

interface DecksViewProps {
  decks: Draft[];
  decksLastKey: any;
  cubeId: string;
}

const DecksView: React.FC<DecksViewProps> = ({ decks, decksLastKey, cubeId }) => {
  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <PlaytestDecksCard decks={decks} decksLastKey={decksLastKey} cubeId={cubeId} />
    </Flexbox>
  );
};

export default DecksView;
