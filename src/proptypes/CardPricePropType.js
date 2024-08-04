import PropTypes from 'prop-types';

const CardPricePropType = PropTypes.shape({
  usd: PropTypes.number,
  usd_foil: PropTypes.number,
  eur: PropTypes.number,
  tix: PropTypes.number,
});

export default CardPricePropType;
