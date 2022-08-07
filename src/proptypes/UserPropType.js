import PropTypes from 'prop-types';

const UserPropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Username: PropTypes.string.isRequired,
  UsernameLower: PropTypes.string.isRequired,
  About: PropTypes.string,
  HideTagColors: PropTypes.bool,
  FollowedCubes: PropTypes.arrayOf(PropTypes.string),
  FollowedUsers: PropTypes.arrayOf(PropTypes.string),
  UsersFollowing: PropTypes.arrayOf(PropTypes.string),
  ImageName: PropTypes.string,
  Roles: PropTypes.arrayOf(PropTypes.string),
  Theme: PropTypes.string,
  HideFeatured: PropTypes.bool,
  PatronId: PropTypes.string,
});

export default UserPropType;
