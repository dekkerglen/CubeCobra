import PropTypes from 'prop-types';

const CardPropType = PropTypes.shape({
  date: PropTypes.number,
  cubes: PropTypes.number,
  elo: PropTypes.number,
  legacy: PropTypes.arrayOf(PropTypes.number),
  modern: PropTypes.arrayOf(PropTypes.number),
  pauper: PropTypes.arrayOf(PropTypes.number),
  size180: PropTypes.arrayOf(PropTypes.number),
  size360: PropTypes.arrayOf(PropTypes.number),
  size540: PropTypes.arrayOf(PropTypes.number),
  size720: PropTypes.arrayOf(PropTypes.number),
  total: PropTypes.arrayOf(PropTypes.number),
  oracle: PropTypes.string,
  picks: PropTypes.number,
  OTComp: PropTypes.string,
});

export default CardPropType;
