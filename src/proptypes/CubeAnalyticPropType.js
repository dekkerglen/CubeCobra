import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

const CubePropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  shortId: PropTypes.string,
  urlAlias: PropTypes.string,
  name: PropTypes.string,
  card_count: PropTypes.number,
  cards: PropTypes.arrayOf(CardPropType),
  type: PropTypes.string,
  overrideCategory: PropTypes.bool,
  categoryOverride: PropTypes.string,
  categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
  image_name: PropTypes.string,
  image_artist: PropTypes.string,
  image_uri: PropTypes.string,
  owner: PropTypes.string,
  owner_name: PropTypes.string,
  disableNotifications: PropTypes.bool,
});

export default CubePropType;
