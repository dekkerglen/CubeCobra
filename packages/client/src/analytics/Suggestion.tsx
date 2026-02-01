import React from 'react';

import { cardName, encodeName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Text from '../components/base/Text';
import AddToCubeModal from '../components/modals/AddToCubeModal';
import withAutocard from '../components/WithAutocard';
import withModal from '../components/WithModal';

interface SuggestionProps {
  card: Card;
  index: number;
  cube: Cube;
}

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

const Suggestion: React.FC<SuggestionProps> = ({ card, index, cube }) => {
  return (
    <Text md semibold className="px-2 text-link hover:text-link-active">
      {index + 1}
      {'. '}
      <AddModal
        card={card}
        href={`/tool/card/${encodeName(card.cardID)}`}
        modalprops={{ card, hideAnalytics: false, cubeContext: cube.id }}
      >
        {cardName(card)}
      </AddModal>
    </Text>
  );
};

export default Suggestion;
