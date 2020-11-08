import PropTypes from 'prop-types';

const CardPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  imgUrl: PropTypes.string,
  cardID: PropTypes.string.isRequired,
  colors: PropTypes.arrayOf(PropTypes.oneOf([...'WUBRG'])).isRequired,
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
  details: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image_normal: PropTypes.string.isRequired,
  }).isRequired,
});

export default CardPropType;
