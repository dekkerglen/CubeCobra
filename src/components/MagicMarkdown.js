import React from 'react';

import Affiliate from '../util/Affiliate';

import MassBuyButton from './MassBuyButton';
import withAutocard from './WithAutocard';

const AutocardLink = withAutocard('a');

const MagicMarkdown = ({ markdown, cube }) => {
  if (markdown === undefined) {
    return '';
  }
  const markdownStr = markdown.toString();
  const split = markdownStr.split(/({[wubrgcmWUBRGCM\d\-]+}|\[\[!?\d+\]\]|%%(?:[^%]|%[^%]|[^%]%)+%%|\n\n)/gm);
  return split.map((section, position) => {
    if (section.startsWith('{')) {
      const symbol = section.substring(1, section.length - 1);
      return <img key={symbol} src={`/content/symbols/${symbol}.png`} alt={symbol} className="mana-symbol" />;
    } else if (section.startsWith('[[!')) {
      const cardIndex = parseInt(section.substring(3, section.length - 2), 10);
      const card = cube.cards[cardIndex];
      return (
        <a key={card.cardID} href={Affiliate.getTCGLink(card)}>
          <img src={card.details.image_normal} className="card-img-top" />
        </a>
      );
      return cardName;
    } else if (section.startsWith('[[')) {
      const cardIndex = parseInt(section.substring(2, section.length - 2), 10);
      const card = cube.cards[cardIndex];
      return (
        <AutocardLink key={card.cardID} href={'/tool/card/' + card.cardID} card={card}>
          {card.details.name}
        </AutocardLink>
      );
      return cardName;
    } else if (section.startsWith('%%')) {
      const percentage = section.substring(2, section.length - 2);
      return (
        <span key={'section-' + position} className="percent">
          {percentage}
        </span>
      );
    } else if (section.startsWith('\n')) {
      return <br key={'section-' + position} />;
    } else {
      return section;
    }
  });
};

export default MagicMarkdown;
