import PropTypes from 'prop-types';

const DraftSeatPropType = PropTypes.shape({
  description: PropTypes.string.isRequired,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number).isRequired).isRequired).isRequired,
  sideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number).isRequired).isRequired).isRequired,
  username: PropTypes.string.isRequired,
  userid: PropTypes.string,
  bot: PropTypes.array,
  name: PropTypes.string.isRequired,
});

export default DraftSeatPropType;
