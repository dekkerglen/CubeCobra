import PropTypes from 'prop-types';

const DraftSeatPropType = PropTypes.shape({
  description: PropTypes.string,
  deck: PropTypes.array,
  sideboard: PropTypes.array,
  username: PropTypes.string,
  userid: PropTypes.string,
  bot: PropTypes.array,
  name: PropTypes.string,
});

export default DraftSeatPropType;
