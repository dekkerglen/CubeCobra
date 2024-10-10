import React from 'react';

import AddToCubeModal from 'components/AddToCubeModal';
import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import Card from 'datatypes/Card';
import CardDetails from 'datatypes/CardDetails';
import Cube from 'datatypes/Cube';
import { encodeName } from 'utils/Card';

interface ImageSuggestionProps {
  card: Card;
  cube: Cube;
  index: number;
}

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

const ImageSuggestion: React.FC<ImageSuggestionProps> = ({ card, cube }) => {
  const details =
    card.details ||
    ({
      name: card.cardID,
    } as CardDetails);

  return (
    <AddModal
      card={card}
      href={`/tool/card/${encodeName(card.cardID)}`}
      modalprops={{ card: details, hideAnalytics: false, cubeContext: cube.id }}
    >
      <img className="card-border pr-1 w-100" src={details.image_normal} />
    </AddModal>
  );
};

export default ImageSuggestion;
