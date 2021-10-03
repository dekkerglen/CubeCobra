import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import DraftSeatPropType from 'proptypes/DraftSeatPropType';

const DraftPropType = PropTypes.shape({
  seats: PropTypes.arrayOf(DraftSeatPropType).isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  cube: PropTypes.string.isRequired,
  initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({}))).isRequired,
  basics: PropTypes.arrayOf(PropTypes.number).isRequired,
  _id: PropTypes.string.isRequired,
});

export default DraftPropType;
