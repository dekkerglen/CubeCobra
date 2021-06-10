import PropTypes from 'prop-types';

const CardDetailsPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  image_normal: PropTypes.string.isRequired,
});

export default CardDetailsPropType;
