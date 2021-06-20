import PropTypes from 'prop-types';
import DraftSeatPropType from 'proptypes/DraftSeatPropType';

const DeckPropType = PropTypes.shape({
  _id: PropTypes.string,
  cube: PropTypes.string,
  owner: PropTypes.string,
  cubeOwner: PropTypes.string,
  seats: PropTypes.arrayOf(DraftSeatPropType),
  date: PropTypes.instanceOf(Date),
  comments: PropTypes.arrayOf(PropTypes.object),
  basics: PropTypes.arrayOf(PropTypes.number.isRequired).isRequired,
});

export default DeckPropType;
