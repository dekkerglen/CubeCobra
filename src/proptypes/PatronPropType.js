import PropTypes from 'prop-types';

const PatronPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  user: PropTypes.string.isRequired,
  level: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
});

export default PatronPropType;
