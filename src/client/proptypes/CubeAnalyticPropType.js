import PropTypes from 'prop-types';

const CubeAnalyticPropType = PropTypes.shape({
  cube: PropTypes.string.isRequired,
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      cardName: PropTypes.string,
      picks: PropTypes.number,
      passes: PropTypes.number,
      elo: PropTypes.number,
      mainboards: PropTypes.number,
      sideboards: PropTypes.number,
    }),
  ).isRequired,
  useCubeElo: PropTypes.bool,
});

export default CubeAnalyticPropType;
