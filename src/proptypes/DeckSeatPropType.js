import PropTypes from 'prop-types';

const DeckSeatPropType = PropTypes.shape({
  description: PropTypes.string,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number).isRequired).isRequired),
  sideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number).isRequired).isRequired).isRequired,
  username: PropTypes.string,
  userid: PropTypes.string,
  bot: PropTypes.array,
  name: PropTypes.string,
});

export default DeckSeatPropType;
