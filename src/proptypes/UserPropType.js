import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  about: PropTypes.string.isRequired,
  notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  image_name: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
  artist: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  users_following: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
});

export default UserPropType;
