import PropTypes from 'prop-types';
import DraftSeatPropType from 'proptypes/DraftSeatPropType';

const DeckPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  cube: PropTypes.string.isRequired,
  seats: PropTypes.arrayOf(DraftSeatPropType).isRequired,
  date: PropTypes.instanceOf(Date).isRequired,
  comments: PropTypes.arrayOf(PropTypes.object).isRequired,
});

export default DeckPropType;
