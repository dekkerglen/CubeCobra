import PropTypes from 'prop-types';

const ContentPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  date: PropTypes.number.isRequired,
  status: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  typeStatusComp: PropTypes.string.isRequired,
  typeOwnerComp: PropTypes.string.isRequired,
  // optional FIELDS
  title: PropTypes.string,
  body: PropTypes.string,
  short: PropTypes.string,
  url: PropTypes.string,
  image: PropTypes.string,
  imageName: PropTypes.string,
  username: PropTypes.string,
  podcastName: PropTypes.string,
  podcast: PropTypes.string,
  podcastGuid: PropTypes.string,
  podcastLink: PropTypes.string,
});

export default ContentPropType;
