import React from 'react';

import { encodeName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import AddToCubeModal from '../components/modals/AddToCubeModal';
import withAutocard from '../components/WithAutocard';
import withModal from '../components/WithModal';

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
      <img className="card-border pr-1 w-full" src={details.image_normal} />
    </AddModal>
  );
};

export default ImageSuggestion;
