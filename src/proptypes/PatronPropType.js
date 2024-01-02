import PropTypes from 'prop-types';

const PatronPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  user: PropTypes.string.isRequired,
  level: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
});

export default PatronPropType;
