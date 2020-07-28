import React from 'react';
import PropTypes from 'prop-types';

import { getTCGLink } from 'utils/Affiliate';
import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';

const AutocardLink = withAutocard('a');

const MagicMarkdown = ({ markdown, cube }) => {
  if (markdown === undefined) {
    return '';
  }
  const markdownStr = markdown.toString();
  const split = markdownStr.split(/({[wubrgcmtqeWUBRGCMTQE\d/-]+}|\[\[!?\d+\]\]|%%\d+%%|\n\n)/gm);
  return (
    <>
      {split.map((section, position) => {
        if (section.startsWith('{')) {
          const symbol = section.substring(1, section.length - 1);
          return (
            <img
              key={/* eslint-disable-line react/no-array-index-key */ `symbol-${position}`}
              src={`/content/symbols/${symbol.replace('/', '-')}.png`}
              alt={symbol}
              className="mana-symbol-sm"
            />
          );
        }
        if (section.startsWith('[[!')) {
          const cardIndex = parseInt(section.substring(3, section.length - 2), 10);
          const card = cube.cards[cardIndex];
          return (
            <a
              key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
              href={getTCGLink(card)}
            >
              <FoilCardImage autocard card={card} className="clickable" />
            </a>
          );
        }
        if (section.startsWith('[[')) {
          const cardIndex = parseInt(section.substring(2, section.length - 2), 10);
          const card = cube.cards[cardIndex];
          return (
            <AutocardLink
              key={/* eslint-disable-line react/no-array-index-key */ `${position}-card.cardID`}
              href={`/tool/card/${card.cardID}`}
              card={card}
            >
              {card.details.name}
            </AutocardLink>
          );
        }
        if (section.startsWith('%%')) {
          const percentage = section.substring(2, section.length - 2);
          return (
            <span key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`} className="percent">
              {percentage}%
            </span>
          );
        }
        if (section.startsWith('\n')) {
          return <br key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`} />;
        }
        return section;
      })}
    </>
  );
};

MagicMarkdown.propTypes = {
  markdown: PropTypes.string,
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(
      PropTypes.shape({
        cardID: PropTypes.string.isRequired,
        details: PropTypes.shape({
          image_normal: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired,
        }).isRequired,
      }),
    ).isRequired,
  }),
};

MagicMarkdown.defaultProps = {
  markdown: '',
  cube: null,
};

export default MagicMarkdown;
