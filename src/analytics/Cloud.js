import React, { useContext, useMemo, useRef } from 'react';
import { TagCloud } from 'react-tagcloud';
import { Input, InputGroup, InputGroupAddon, InputGroupText, UncontrolledTooltip } from 'reactstrap';
import PropTypes from 'prop-types';

import AsfanDropdown from 'components/AsfanDropdown';
import ThemeContext from 'contexts/ThemeContext';
import { isTouchDevice } from 'utils/Util';
import useQueryParam from 'hooks/useQueryParam';

const trigger = isTouchDevice() ? 'click' : 'hover';

const TagCloudTag = ({ tag, size, color }) => {
  const spanRef = useRef();
  return (
    <div className="tag-cloud-tag mr-2" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <span style={{ color, fontSize: `${size}px` }} className="tag-cloud-tag" ref={spanRef}>
        {tag.value}
      </span>
      <UncontrolledTooltip trigger={trigger} placement="auto" target={spanRef}>
        {Number.isInteger(tag.count) ? tag.count : tag.count.toFixed(2)}
      </UncontrolledTooltip>
    </div>
  );
};

TagCloudTag.propTypes = {
  tag: PropTypes.shape({
    value: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired,
  }).isRequired,
  size: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
};

const COLOR_OPTIONS = {
  dark: 'light',
  default: 'dark',
  light: 'dark',
};

const Cloud = ({ cards, cube, setAsfans, defaultFormatId }) => {
  const theme = useContext(ThemeContext);

  const [exclude, setExclude] = useQueryParam('exclude', '');
  const excludeList = useMemo(() => (exclude ?? '').split(',').map((ex) => ex.trim()), [exclude]);

  const tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (card.asfan) {
        tag = tag.trim();
        if (tags[tag]) {
          tags[tag] += card.asfan;
        } else {
          tags[tag] = card.asfan;
        }
      }
    }),
  );
  const words = Object.entries(tags)
    .filter(([tag]) => !excludeList.includes(tag))
    .map(([value, count]) => ({ value, count }));

  const tagRenderer = (tag, size, color) => (
    <TagCloudTag tag={tag} size={size} color={color} key={tag.key || tag.value} />
  );

  return (
    <>
      <h4>Tag Cloud</h4>
      <p>
        Tags in your cube with random colors weighted by the expected number of cards with that tag a player will open
        on average.
      </p>
      <InputGroup>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>Comma separated Tags to exclude</InputGroupText>
        </InputGroupAddon>
        <Input placeholder="Excluded Tags" onChange={(e) => setExclude(e.target.value)} value={exclude} />
      </InputGroup>
      <AsfanDropdown cube={cube} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
      <TagCloud minSize={10} maxSize={80} colorOptions={COLOR_OPTIONS[theme]} tags={words} renderer={tagRenderer} />
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
