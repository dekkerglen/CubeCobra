import PropTypes from 'prop-types';
import CardPricePropType from 'proptypes/CardPricePropType';

const CardDataPointPropType = PropTypes.shape({
  prices: PropTypes.arrayOf(CardPricePropType).isRequired,
  vintage: PropTypes.arrayOf(PropTypes.number).isRequired,
  legacy: PropTypes.arrayOf(PropTypes.number).isRequired,
  modern: PropTypes.arrayOf(PropTypes.number).isRequired,
  standard: PropTypes.arrayOf(PropTypes.number).isRequired,
  pauper: PropTypes.arrayOf(PropTypes.number).isRequired,
  peasant: PropTypes.arrayOf(PropTypes.number).isRequired,
  size180: PropTypes.arrayOf(PropTypes.number).isRequired,
  size360: PropTypes.arrayOf(PropTypes.number).isRequired,
  size450: PropTypes.arrayOf(PropTypes.number).isRequired,
  size540: PropTypes.arrayOf(PropTypes.number).isRequired,
  size720: PropTypes.arrayOf(PropTypes.number).isRequired,
  total: PropTypes.arrayOf(PropTypes.number).isRequired,
});

export default CardDataPointPropType;
