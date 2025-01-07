import PropTypes from 'prop-types';
import CardDataPointPropType from 'src/client/proptypes/CardDataPointPropType';

export const HistoryPropType = PropTypes.arrayOf(
  PropTypes.shape({
    date: PropTypes.string.isRequired,
    data: CardDataPointPropType.isRequired,
  }),
);

const CardHistoryPropType = PropTypes.shape({
  cardName: PropTypes.string.isRequired,
  oracleId: PropTypes.string.isRequired,
  versions: PropTypes.arrayOf(PropTypes.string).isRequired,
  current: CardDataPointPropType,
  cubedWith: PropTypes.shape({
    synergistic: PropTypes.arrayOf(PropTypes.string).isRequired,
    top: PropTypes.arrayOf(PropTypes.string).isRequired,
    creatures: PropTypes.arrayOf(PropTypes.string).isRequired,
    spells: PropTypes.arrayOf(PropTypes.string).isRequired,
    other: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  history: HistoryPropType.isRequired,
});

export default CardHistoryPropType;
