import PropTypes from 'prop-types';
import DraftSeatPropType from 'proptypes/DraftSeatPropType';

const DraftPropType = PropTypes.shape({
  seats: PropTypes.arrayOf(DraftSeatPropType).isRequired,
});

export default DraftPropType;
