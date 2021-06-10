import PropTypes from 'prop-types';
import CardDetailsPropType from 'proptypes/CardDetailsPropType';

const CardPropType = PropTypes.shape({
  _id: PropTypes.string,
  index: PropTypes.number,
  imgUrl: PropTypes.string,
  imgBackUrl: PropTypes.string,
  cardID: PropTypes.string.isRequired,
  colors: PropTypes.arrayOf(PropTypes.oneOf([...'WUBRG'])),
  tags: PropTypes.arrayOf(PropTypes.string),
  details: CardDetailsPropType,
});

export default CardPropType;
