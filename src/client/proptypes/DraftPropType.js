import PropTypes from 'prop-types';
import CardPropType from 'src/client/proptypes/CardPropType';
import DraftSeatPropType from 'src/client/proptypes/DraftSeatPropType';

const DraftPropType = PropTypes.shape({
  seats: PropTypes.arrayOf(DraftSeatPropType).isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  cube: PropTypes.string.isRequired,
  InitialState: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({}))).isRequired,
  basics: PropTypes.arrayOf(PropTypes.number).isRequired,
  id: PropTypes.string.isRequired,
});

export default DraftPropType;
