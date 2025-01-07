import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  usernameLower: PropTypes.string.isRequired,
  about: PropTypes.string,
  hideTagColors: PropTypes.bool,
  followedCubes: PropTypes.arrayOf(PropTypes.string),
  followedUsers: PropTypes.arrayOf(PropTypes.string),
  following: PropTypes.arrayOf(PropTypes.string),
  imageName: PropTypes.string,
  roles: PropTypes.arrayOf(PropTypes.string),
  theme: PropTypes.string,
  hideFeatured: PropTypes.bool,
  patron: PropTypes.string,
});

export default UserPropType;
