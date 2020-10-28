import React from 'react';
import PropTypes from 'prop-types';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';
import LinkModal from 'components/LinkModal';
import withModal from 'components/WithModal';
import Latex from 'react-latex';

import { Col, Row, Card, CardBody } from 'reactstrap';

const AutocardLink = withAutocard('a');
const Link = withModal('a', LinkModal);

const InnerMarkdown = ({ markdown }) => {
  const markdownStr = markdown.toString();
  const split = markdownStr.split(
    /(\[.+?\]\(.+?\)|@[a-zA-Z0-9_]+|\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|_[^_]+?_|__[^_]+?__|___[^_]+?___|~~[^~]+?~~|{[wubrgcmtsqepxyzWUBRGCMTSQEPXYZ\d/-]+?}|\[\[!?[/]?[a-zA-Z ',-|]+?\]\]|%%\d+%%|\$\$[^$]+?\$\$|\$\$\$[^$]+?\$\$\$|\n)/gm,
  );
  return (
    <>
      {split.map((section, position) => {
        try {
          if (section.startsWith('$$$')) {
            const sub = section.substring(1, section.length - 1);
            return (
              <Latex
                displayMode
                trust={false}
                key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
              >
                {sub}
              </Latex>
            );
          }
          if (section.startsWith('$$')) {
            const sub = section.substring(1, section.length - 1);
            return (
              <Latex trust={false} key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {sub}
              </Latex>
            );
          }
          if (section.startsWith('@')) {
            const sub = section.substring(1);
            return (
              <a
                href={`/user/view/${sub}`}
                target="_blank"
                rel="noopener noreferrer"
                key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
              >
                @{sub}
              </a>
            );
          }
          if (section.startsWith('~~')) {
            return (
              <s key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {section.substring(2, section.length - 2)}
              </s>
            );
          }
          if (section.startsWith('___')) {
            return (
              <em key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <u>{section.substring(3, section.length - 3)}</u>
              </em>
            );
          }
          if (section.startsWith('__')) {
            return (
              <u key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {section.substring(2, section.length - 2)}
              </u>
            );
          }
          if (section.startsWith('_')) {
            return (
              <em key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {section.substring(1, section.length - 1)}
              </em>
            );
          }
          if (section.startsWith('***')) {
            return (
              <em key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <strong>{section.substring(3, section.length - 3)}</strong>
              </em>
            );
          }
          if (section.startsWith('**')) {
            return (
              <strong key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {section.substring(2, section.length - 2)}
              </strong>
            );
          }
          if (section.startsWith('*')) {
            return (
              <em key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {section.substring(1, section.length - 1)}
              </em>
            );
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
            const card = section.substring(4, section.length - 2);
            const id = card.includes('|') ? card.split('|')[1] : card;
            const idURL = encodeURIComponent(id);

            return (
              <Col xs="6" md="4" lg="3" key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${idURL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{
                      details: { image_normal: `/tool/cardimage/${idURL}`, image_flip: `/tool/cardimageflip/${idURL}` },
                    }}
                    className="clickable"
                  />
                </a>
              </Col>
            );
          }
          if (section.startsWith('[[!')) {
            const card = section.substring(3, section.length - 2);
            const id = card.includes('|') ? card.split('|')[1] : card;
            const idURL = encodeURIComponent(id);

            return (
              <Col xs="6" md="4" lg="3" key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${idURL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{ details: { image_normal: `/tool/cardimage/${idURL}` } }}
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
            const idURL = encodeURIComponent(id);

            return (
              <AutocardLink
                key={/* eslint-disable-line react/no-array-index-key */ `${position}-card.cardID`}
                href={`/tool/card/${idURL}`}
                card={{
                  details: { image_normal: `/tool/cardimage/${idURL}`, image_flip: `/tool/cardimageflip/${idURL}` },
                }}
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
            const idURL = encodeURIComponent(id);

            return (
              <AutocardLink
                key={/* eslint-disable-line react/no-array-index-key */ `${position}-card.cardID`}
                href={`/tool/card/${idURL}`}
                card={{ details: { image_normal: `/tool/cardimage/${idURL}` } }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {name}
              </AutocardLink>
            );
          }
          if (section.startsWith('[')) {
            const parts = section.split('](');
            const link = parts[1].substring(0, parts[1].length - 1);
            const text = parts[0].substring(1);

            const isInternalURL = (to) => {
              try {
                const url = new URL(to, window.location.origin);
                return url.hostname === window.location.hostname;
              } catch {
                return false;
              }
            };
            if (isInternalURL(link)) {
              return (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={link}
                  key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
                >
                  {text}
                </a>
              );
            }
            return (
              /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
              <Link
                href="#"
                modalProps={{ link: parts[1].substring(0, parts[1].length - 1) }}
                key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
              >
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
InnerMarkdown.propTypes = {
  markdown: PropTypes.string.isRequired,
};

const Markdown = ({ markdown }) => {
  const markdownStr = markdown.toString();
  const split = markdownStr.split(/(#{1,6} .+\r?\n|(?:^1\. .+(?:\r?\n|$))+|(?:^- .+(?:\r?\n|$))+)/gm);
  return (
    <>
      {split.map((section, position) => {
        try {
          if (section.startsWith('1. ')) {
            const lines = section.split(/(1\. .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ol key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {lines.map((line, linePosition) => (
                  <li key={/* eslint-disable-line react/no-array-index-key */ `section-${position}-${linePosition}`}>
                    <InnerMarkdown markdown={line.substring(3)} />
                  </li>
                ))}
              </ol>
            );
          }
          if (section.startsWith('- ')) {
            const lines = section.split(/(- .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ul key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                {lines.map((line, linePosition) => (
                  <li key={/* eslint-disable-line react/no-array-index-key */ `section-${position}-${linePosition}`}>
                    <InnerMarkdown markdown={line.substring(2)} />
                  </li>
                ))}
              </ul>
            );
          }
          if (section.startsWith('# ')) {
            return (
              <h1 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(2)} />
              </h1>
            );
          }
          if (section.startsWith('## ')) {
            return (
              <h2 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(3)} />
              </h2>
            );
          }
          if (section.startsWith('### ')) {
            return (
              <h3 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(4)} />
              </h3>
            );
          }
          if (section.startsWith('#### ')) {
            return (
              <h4 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(5)} />
              </h4>
            );
          }
          if (section.startsWith('##### ')) {
            return (
              <h5 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(6)} />
              </h5>
            );
          }
          if (section.startsWith('###### ')) {
            return (
              <h6 key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
                <InnerMarkdown markdown={section.substring(7)} />
              </h6>
            );
          }
        } catch (err) {
          console.error(err);
        }
        return (
          <InnerMarkdown
            markdown={section}
            key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
          />
        );
      })}
    </>
  );
};

Markdown.propTypes = {
  markdown: PropTypes.string.isRequired,
};

const OuterMarkdown = ({ markdown, limited }) => {
  if (limited) {
    return <Markdown markdown={markdown} />;
  }

  const markdownStr = markdown?.toString() ?? '';
  const split = markdownStr.split(/(<<.+>>|(?:^>(?: .*)?\r?\n)+|^>>>[^<>]+<<<)/gm);
  return (
    <>
      {split.map((section, position) => {
        if (section.startsWith('<<')) {
          const sub = section.substring(2, section.length - 2);
          return (
            <Row key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
              <Markdown markdown={sub} />
            </Row>
          );
        }
        if (section.startsWith('> ')) {
          const lines = section.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
          return (
            <Card className="bg-light" key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}>
              <CardBody>
                {lines.map((line, linePosition) => (
                  <Markdown
                    markdown={line.substring(2)}
                    key={/* eslint-disable-line react/no-array-index-key */ `section-${position}-${linePosition}`}
                  />
                ))}
              </CardBody>
            </Card>
          );
        }
        if (section.startsWith('>>>')) {
          section = section.replace(/>>>\r?\n?|<<</gm, '');
          return (
            <div
              className="centered-markdown"
              key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`}
            >
              <Markdown markdown={section} />
            </div>
          );
        }
        return (
          <Markdown markdown={section} key={/* eslint-disable-line react/no-array-index-key */ `section-${position}`} />
        );
      })}
    </>
  );
};

OuterMarkdown.propTypes = {
  markdown: PropTypes.string.isRequired,
  limited: PropTypes.bool,
};

OuterMarkdown.defaultProps = {
  limited: false,
};

export default OuterMarkdown;
