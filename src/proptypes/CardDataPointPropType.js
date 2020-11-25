import PropTypes from 'prop-types';
import CardPricePropType from 'proptypes/CardPricePropType';

const CardDataPointPropType = PropTypes.shape({
  prices: PropTypes.arrayOf(CardPricePropType).isRequired,
  vintage: PropTypes.bool.isRequired,
  legacy: PropTypes.bool.isRequired,
  modern: PropTypes.bool.isRequired,
  standard: PropTypes.bool.isRequired,
  pauper: PropTypes.bool.isRequired,
  peasant: PropTypes.bool.isRequired,
  size180: PropTypes.number.isRequired,
  size360: PropTypes.number.isRequired,
  size450: PropTypes.number.isRequired,
  size540: PropTypes.number.isRequired,
  size720: PropTypes.number.isRequired,
  total: PropTypes.arrayOf(PropTypes.number).isRequired,
});

export default CardDataPointPropType;
