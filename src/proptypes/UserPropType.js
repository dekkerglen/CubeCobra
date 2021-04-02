import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  email: PropTypes.string,
  username: PropTypes.string,
  about: PropTypes.string,
  notifications: PropTypes.arrayOf(PropTypes.shape({})),
  image_name: PropTypes.string,
  image: PropTypes.string,
  artist: PropTypes.string,
  theme: PropTypes.string,
  users_following: PropTypes.arrayOf(PropTypes.string.isRequired),
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
  hide_featured: PropTypes.bool,
});

export default UserPropType;
