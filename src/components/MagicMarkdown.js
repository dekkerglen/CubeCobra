import React from 'react';
import PropTypes from 'prop-types';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';
import LinkModal from 'components/LinkModal';
import withModal from 'components/WithModal';

import { Col } from 'reactstrap';

const AutocardLink = withAutocard('a');
const Link = withModal('a', LinkModal);

const MagicMarkdown = ({ markdown }) => {
  if (markdown === undefined) {
    return '';
  }
  const markdownStr = markdown.toString();
  const split = markdownStr.split(
    /(\[.+\]\(.+\)|@[a-zA-Z0-9_]+|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|{[wubrgcmtqepxyzWUBRGCMTQEPXYZ\d/-]+}|\[\[!?[/]?[a-zA-Z ]+\]\]|%%\d+%%|\n)/gm,
  );
  return (
    <>
      {split.map((section, position) => {
        try {
          if (section.startsWith('@')) {
            const sub = section.substring(1);
            return (
              <a href={`/user/view/${sub}`} target="_blank" rel="noopener noreferrer">
                @{sub}
              </a>
            );
          }
          if (section.startsWith('***')) {
            return (
              <em>
                <strong>{section.substring(3, section.length - 3)}</strong>
              </em>
            );
          }
          if (section.startsWith('**')) {
            return <strong>{section.substring(2, section.length - 2)}</strong>;
          }
          if (section.startsWith('*')) {
            return <em>{section.substring(1, section.length - 1)}</em>;
          }
          if (section.startsWith('{')) {
            const symbol = section.substring(1, section.length - 1);
            return (
              <img
                key={/* eslint-disable-line react/no-array-index-key */ `symbol-${position}`}
                src={`/content/symbols/${symbol.replace('/', '-').toLowerCase()}.png`}
                alt={symbol}
                className="mana-symbol-sm"
              />
            );
          }
          if (section.startsWith('[[!/')) {
            console.log(section);
            const card = section.substring(4, section.length - 2);
            return (
              <Col xs="6" md="4" lg="3">
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${card}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{
                      details: { image_normal: `/tool/cardimage/${card}`, image_flip: `/tool/cardimageflip/${card}` },
                    }}
                    className="clickable"
                  />
                </a>
              </Col>
            );
          }
          if (section.startsWith('[[!')) {
            const card = section.substring(3, section.length - 2);
            return (
              <Col xs="6" md="4" lg="3">
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${card}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{ details: { image_normal: `/tool/cardimage/${card}` } }}
                    className="clickable"
                  />
                </a>
              </Col>
            );
          }
          if (section.startsWith('[[/')) {
            const card = section.substring(3, section.length - 2);
            const name = card.includes('|') ? card.split('|')[0] : card;
            const id = card.includes('|') ? card.split('|')[1] : card;

            return (
              <AutocardLink
                key={/* eslint-disable-line react/no-array-index-key */ `${position}-card.cardID`}
                href={`/tool/card/${id}`}
                card={{ details: { image_normal: `/tool/cardimage/${id}`, image_flip: `/tool/cardimageflip/${id}` } }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {name}
              </AutocardLink>
            );
          }
          if (section.startsWith('[[')) {
            const card = section.substring(2, section.length - 2);
            const name = card.includes('|') ? card.split('|')[0] : card;
            const id = card.includes('|') ? card.split('|')[1] : card;

            return (
              <AutocardLink
                key={/* eslint-disable-line react/no-array-index-key */ `${position}-card.cardID`}
                href={`/tool/card/${id}`}
                card={{ details: { image_normal: `/tool/cardimage/${id}` } }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {name}
              </AutocardLink>
            );
          }
          if (section.startsWith('[')) {
            const parts = section.split('](');

            return (
              /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
              <Link href="#" modalProps={{ link: parts[1].substring(0, parts[1].length - 1) }}>
                {parts[0].substring(1)}
              </Link>
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
        } catch (err) {
          console.error(err);
        }
        return section;
      })}
    </>
  );
};

MagicMarkdown.propTypes = {
  markdown: PropTypes.string.isRequired,
};

export default MagicMarkdown;
