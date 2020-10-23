import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
});

export default UserPropType;
