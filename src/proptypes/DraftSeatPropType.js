import PropTypes from 'prop-types';

const DraftSeatPropType = PropTypes.shape({
  description: PropTypes.string.isRequired,
  deck: PropTypes.array.isRequired,
  sideboard: PropTypes.array.isRequired,
  username: PropTypes.string.isRequired,
  userid: PropTypes.string,
  bot: PropTypes.array,
  name: PropTypes.string.isRequired,
});

export default DraftSeatPropType;
