import PropTypes from 'prop-types';

const CardPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  userid: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  approved: PropTypes.string.isRequired,
  cards: PropTypes.arrayOf(PropTypes.string).isRequired,
  votes: PropTypes.number.isRequired,
  voters: PropTypes.arrayOf(PropTypes.string).isRequired,
});

export default CardPropType;
