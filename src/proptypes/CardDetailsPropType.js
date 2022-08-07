import PropTypes from 'prop-types';

const CardDetailsPropType = PropTypes.shape({
  _id: PropTypes.string,
  name: PropTypes.string,
  image_normal: PropTypes.string,
});

export default CardDetailsPropType;
