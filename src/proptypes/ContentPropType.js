import PropTypes from 'prop-types';

const ContentPropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Date: PropTypes.number.isRequired,
  Status: PropTypes.string.isRequired,
  Owner: PropTypes.string.isRequired,
  Type: PropTypes.string.isRequired,
  TypeStatusComp: PropTypes.string.isRequired,
  TypeOwnerComp: PropTypes.string.isRequired,
  // optional FIELDS
  Title: PropTypes.string,
  Body: PropTypes.string,
  Short: PropTypes.string,
  Url: PropTypes.string,
  Image: PropTypes.string,
  ImageName: PropTypes.string,
  Username: PropTypes.string,
  PodcastName: PropTypes.string,
  PodcastId: PropTypes.string,
  PodcastGuid: PropTypes.string,
  PodcastLink: PropTypes.string,
});

export default ContentPropType;
