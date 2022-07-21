import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { ListGroup, ListGroupItem } from 'reactstrap';

import { sortDeep } from 'utils/Sort';

import AutocardListItem from 'components/AutocardListItem';
import CubeContext from 'contexts/CubeContext';
import GroupModalContext from 'contexts/GroupModalContext';
import withModal from 'components/WithModal';

import GroupModal from 'components/GroupModal';
import withCardModal from 'components/WithCardModal';

const CardGroupModalLink = withModal(ListGroupItem, GroupModal);
const CardModalLink = withCardModal(AutocardListItem);

const AutocardListGroup = ({ cards, heading, sort, orderedSort, showOther, noGroupModal }) => {
  const sorted = sortDeep(cards, showOther, orderedSort, sort);
  const { canEdit } = useContext(CubeContext);
  const { openGroupModal, setGroupModalCards } = useContext(GroupModalContext);
  const canGroupModal = !noGroupModal && canEdit;
  const handleClick = useCallback(
    (event) => {
      event.preventDefault();
      setGroupModalCards(cards);
      openGroupModal();
    },
    [cards, openGroupModal, setGroupModalCards],
  );
  return (
    <ListGroup className="list-outline">
      <CardGroupModalLink
        tag="div"
        className={`list-group-heading${canGroupModal ? ' clickable' : ''}`}
        onClick={canGroupModal ? handleClick : undefined}
      >
        {heading}
      </CardGroupModalLink>
      {sorted.map(([, group]) =>
        group.map((card, index) => (
          <CardModalLink
            key={card.index}
            card={card}
            altClick={() => {
              window.open(`/tool/card/${card.cardID}`);
            }}
            className={index === 0 ? 'cmc-group' : undefined}
            modalProps={{
              card,
            }}
          />
        )),
      )}
    </ListGroup>
  );
};

AutocardListGroup.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  noGroupModal: PropTypes.bool,
  heading: PropTypes.node.isRequired,
  sort: PropTypes.string,
  orderedSort: PropTypes.string,
  showOther: PropTypes.bool,
};

AutocardListGroup.defaultProps = {
  noGroupModal: false,
  sort: 'Mana Value Full',
  orderedSort: 'Alphabetical',
  showOther: false,
};

export default AutocardListGroup;
