import React from 'react';
import { TagCloud } from 'react-tagcloud';
import PropTypes from 'prop-types';

import AsfanDropdown from 'components/AsfanDropdown';

const Cloud = ({ cards, cube, setAsfans, defaultFormatId }) => {
  const tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (tags[tag]) {
        tags[tag] += card.asfan;
      } else {
        tags[tag] = card.asfan;
      }
    }),
  );
  const words = Object.keys(tags).map((key) => ({ value: key, count: tags[key] }));

  const colorOptions = { luminosity: 'dark' };
  return (
    <>
      <h4>Tag Cloud</h4>
      <p>
        Tags in your cube with random colors weighted by the expected number of cards with that tag a player will open
        on average.
      </p>
      <AsfanDropdown cube={cube} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
      <TagCloud minSize={10} maxSize={80} colorOptions={colorOptions} tags={words} />
    </>
  );
};
Cloud.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
    draft_formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        _id: PropTypes.string.isRequired,
      }),
    ).isRequired,
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  defaultFormatId: PropTypes.number,
  setAsfans: PropTypes.func.isRequired,
};
Cloud.defaultProps = {
  defaultFormatId: null,
};

export default Cloud;
