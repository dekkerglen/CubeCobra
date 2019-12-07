import React from 'react';

const MagicMarkdown = ({ markdown }) => {
  const markdownStr = unescape(markdown.toString());
  const split = markdownStr.split(/({[wubrgcWUBRGC\d\-]+}|\[\[.+\]\])/g);
  return split.map(section => {
    if (section.startsWith('{')) {
      const symbol = section.substring(1, section.length - 1);
      return ( <img key={symbol} src={`/content/symbols/${symbol}.png`} alt={symbol} /> );
    } else if (section.startsWith('[[!')) {
      const cardName = section.substring(3, section.length - 2);
      // TODO: Render the card image.
      return cardName;
    } else if (section.startsWith('[[')) {
      const cardName = section.substring(2, section.length - 2);
      // TODO: Highlight text and mouseover to show card.
      return cardName;
    } else {
      return section;
    }
  });
};

export default MagicMarkdown;
