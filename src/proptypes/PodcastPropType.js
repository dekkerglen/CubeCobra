import PropTypes from 'prop-types';

// An episode of a podcast, not the entire podcast
const PodcastPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
  podcastname: PropTypes.string.isRequired,
});

export default PodcastPropType;
