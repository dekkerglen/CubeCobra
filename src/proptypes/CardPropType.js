import PropTypes from 'prop-types';

const CardPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  imgUrl: PropTypes.string,
  imgBackUrl: PropTypes.string,
  cardID: PropTypes.string.isRequired,
  colors: PropTypes.arrayOf(PropTypes.oneOf([...'WUBRG'])).isRequired,
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
  details: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    image_normal: PropTypes.string,
  }),
});

export default CardPropType;
