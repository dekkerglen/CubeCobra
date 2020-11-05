import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

const CubePropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  shortId: PropTypes.string,
  urlAlias: PropTypes.string,
  name: PropTypes.string.isRequired,
  card_count: PropTypes.number.isRequired,
  cards: PropTypes.arrayOf(CardPropType),
  type: PropTypes.string.isRequired,
  overrideCategory: PropTypes.bool,
  categoryOverride: PropTypes.string,
  categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
  image_name: PropTypes.string.isRequired,
  image_artist: PropTypes.string.isRequired,
  image_uri: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  owner_name: PropTypes.string.isRequired,
});

export default CubePropType;
