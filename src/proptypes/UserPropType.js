import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  image: PropTypes.string.isRequired,
  artist: PropTypes.string.isRequired,
  users_following: PropTypes.arrayOf(PropTypes.string.isRequired),
});

export default UserPropType;
