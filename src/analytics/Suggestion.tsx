import React from 'react';

import AddToCubeModal from 'components/AddToCubeModal';
import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import { encodeName } from 'utils/Card';
import Card from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import CardDetails from 'datatypes/CardDetails';
import Text from 'components/base/Text';

interface SuggestionProps {
  card: Card;
  index: number;
  cube: Cube;
}

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

const Suggestion: React.FC<SuggestionProps> = ({ card, index, cube }) => {
  const details =
    card.details ||
    ({
      name: card.cardID,
    } as CardDetails);

  return (
    <Text md semibold className="px-2 text-link hover:text-link-active">
      {index + 1}
      {'. '}
      <AddModal
        card={card}
        href={`/tool/card/${encodeName(card.cardID)}`}
        modalprops={{ card: details, hideAnalytics: false, cubeContext: cube.id }}
      >
        {details.name}
      </AddModal>
    </Text>
  );
};

export default Suggestion;
