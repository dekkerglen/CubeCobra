import PropTypes from 'prop-types';

const CardPropType = PropTypes.shape({
  _id: PropTypes.string,
  index: PropTypes.number,
  imgUrl: PropTypes.string,
  imgBackUrl: PropTypes.string,
  cardID: PropTypes.string.isRequired,
  colors: PropTypes.arrayOf(PropTypes.oneOf([...'WUBRG'])),
  tags: PropTypes.arrayOf(PropTypes.string),
  details: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image_normal: PropTypes.string.isRequired,
  }),
});

export default CardPropType;
