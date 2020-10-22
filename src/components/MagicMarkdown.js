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
              <Latex displayMode trust={false}>
                {sub}
              </Latex>
            );
          }
          if (section.startsWith('$$')) {
            const sub = section.substring(1, section.length - 1);
            return <Latex trust={false}>{sub}</Latex>;
          }
          if (section.startsWith('@')) {
            const sub = section.substring(1);
            return (
              <a href={`/user/view/${sub}`} target="_blank" rel="noopener noreferrer">
                @{sub}
              </a>
            );
          }
          if (section.startsWith('~~')) {
            return <s>{section.substring(2, section.length - 2)}</s>;
          }
          if (section.startsWith('___')) {
            return (
              <em>
                <u>{section.substring(3, section.length - 3)}</u>
              </em>
            );
          }
          if (section.startsWith('__')) {
            return <u>{section.substring(2, section.length - 2)}</u>;
          }
          if (section.startsWith('_')) {
            return <em>{section.substring(1, section.length - 1)}</em>;
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
            const card = section.substring(4, section.length - 2);
            const id = card.includes('|') ? card.split('|')[1] : card;

            return (
              <Col xs="6" md="4" lg="3">
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{
                      details: { image_normal: `/tool/cardimage/${id}`, image_flip: `/tool/cardimageflip/${id}` },
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
            return (
              <Col xs="6" md="4" lg="3">
                <a
                  key={/* eslint-disable-line react/no-array-index-key */ `card.cardID-${position}`}
                  href={`/tool/card/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FoilCardImage
                    autocard
                    card={{ details: { image_normal: `/tool/cardimage/${id}` } }}
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
                <a target="_blank" rel="noopener noreferrer" href={link}>
                  {text}
                </a>
              );
            }
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
InnerMarkdown.propTypes = {
  markdown: PropTypes.string.isRequired,
};

const Markdown = ({ markdown }) => {
  const markdownStr = markdown.toString();
  const split = markdownStr.split(/(#{1,6} .+\r?\n|(?:^1\. .+(?:\r?\n|$))+|(?:^- .+(?:\r?\n|$))+)/gm);
  return (
    <>
      {split.map((section) => {
        try {
          if (section.startsWith('1. ')) {
            const lines = section.split(/(1\. .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ol>
                {lines.map((line) => (
                  <li>
                    <InnerMarkdown markdown={line.substring(3)} />
                  </li>
                ))}
              </ol>
            );
          }
          if (section.startsWith('- ')) {
            const lines = section.split(/(- .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ul>
                {lines.map((line) => (
                  <li>
                    <InnerMarkdown markdown={line.substring(2)} />
                  </li>
                ))}
              </ul>
            );
          }
          if (section.startsWith('# ')) {
            return (
              <h1>
                <InnerMarkdown markdown={section.substring(2)} />
              </h1>
            );
          }
          if (section.startsWith('## ')) {
            return (
              <h2>
                <InnerMarkdown markdown={section.substring(3)} />
              </h2>
            );
          }
          if (section.startsWith('### ')) {
            return (
              <h3>
                <InnerMarkdown markdown={section.substring(4)} />
              </h3>
            );
          }
          if (section.startsWith('#### ')) {
            return (
              <h4>
                <InnerMarkdown markdown={section.substring(5)} />
              </h4>
            );
          }
          if (section.startsWith('##### ')) {
            return (
              <h5>
                <InnerMarkdown markdown={section.substring(6)} />
              </h5>
            );
          }
          if (section.startsWith('###### ')) {
            return (
              <h6>
                <InnerMarkdown markdown={section.substring(7)} />
              </h6>
            );
          }
        } catch (err) {
          console.error(err);
        }
        return <InnerMarkdown markdown={section} />;
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
      {split.map((section) => {
        if (section.startsWith('<<')) {
          const sub = section.substring(2, section.length - 2);
          return (
            <Row>
              <Markdown markdown={sub} />
            </Row>
          );
        }
        if (section.startsWith('> ')) {
          const lines = section.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
          return (
            <Card className="bg-light">
              <CardBody>
                {lines.map((line) => (
                  <Markdown markdown={line.substring(2)} />
                ))}
              </CardBody>
            </Card>
          );
        }
        if (section.startsWith('>>>')) {
          section = section.replace(/>>>\r?\n?|<<</gm, '');
          return (
            <div className="centered">
              <Markdown markdown={section} />
            </div>
          );
        }
        return <Markdown markdown={section} />;
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
