import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yLight, a11yDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { LinkIcon } from '@primer/octicons-react';

import math from 'remark-math';
import breaks from 'remark-breaks';
import gfm from 'remark-gfm';
import slug from 'remark-slug';
import headings from 'remark-autolink-headings';
import userlink from 'markdown/userlink';
import symbols from 'markdown/symbols';
import cardlink from 'markdown/cardlink';
import centering from 'markdown/centering';
import cardrow from 'markdown/cardrow';

import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import LinkModal from 'components/LinkModal';
import FoilCardImage from 'components/FoilCardImage';
import { isInternalURL } from 'utils/Util';

import { Col, Row, Card, CardBody } from 'reactstrap';

const AutocardLink = withAutocard('a');
const Link = withModal('a', LinkModal);

const renderBlockQuote = (node) => {
  return (
    <Card className="bg-light block-quote">
      <CardBody>{node.children}</CardBody>
    </Card>
  );
};

const renderImage = (node) => {
  return <img className="markdown-image" src={node.src} alt={node.alt} title={node.title} />;
};

const renderLink = (node) => {
  const ref = encodeURI(node.href ?? '');
  console.log(node);

  if (isInternalURL(ref)) {
    // heading autolink
    if (node.node.data?.hChildren) {
      return (
        <a href={ref} className="heading-link">
          <LinkIcon size={16} className="link-icon" />
        </a>
      );
    }
    return (
      <a target="_blank" rel="noopener noreferrer" href={ref}>
        {node.children}
      </a>
    );
  }
  return (
    /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
    <Link href="#" modalProps={{ link: ref }}>
      {node.children}
    </Link>
  );
};

const renderHeading = (node) => {
  return React.createElement(`h${node.level}`, node.node?.data?.hProperties ?? {}, node.children);
};

const renderCode = ({ language, value }) => {
  const mode = getComputedStyle(document.body).getPropertyValue('--mode').trim();
  const style = mode === 'dark' ? a11yDark : a11yLight;

  return (
    <SyntaxHighlighter language={language || 'text'} style={style}>
      {value}
    </SyntaxHighlighter>
  );
};

const renderTable = (node) => {
  return (
    <div className="table-responsive">
      <table className="table table-bordered">{node.children}</table>
    </div>
  );
};

const renderMath = (node) => {
  return <Latex trusted={false} displayMode>{`$$ ${node.value} $$`}</Latex>;
};

const renderInlineMath = (node) => {
  return <Latex trusted={false}>{`$ ${node.value} $`}</Latex>;
};

const renderUserlink = (node) => {
  const name = node.value;
  return (
    <a href={`/user/view/${name}`} target="_blank" rel="noopener noreferrer">
      @{name}
    </a>
  );
};

const renderSymbol = (node) => {
  const symbol = node.value.replace('/', '-').toLowerCase();
  return <img src={`/content/symbols/${symbol}.png`} alt={symbol} className="mana-symbol-sm" />;
};

const renderCardlink = ({ name, id, dfc }) => {
  const idURL = encodeURIComponent(id ?? name);
  const details = { image_normal: `/tool/cardimage/${idURL}` };
  if (dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;

  return (
    <AutocardLink href={`/tool/card/${idURL}`} card={{ details }} target="_blank" rel="noopener noreferrer">
      {name}
    </AutocardLink>
  );
};

const renderCardImage = (node) => {
  const name = node.value;
  const nameURL = encodeURIComponent(name);
  const details = { image_normal: `/tool/cardimage/${nameURL}` };
  if (node.dfc) details.image_flip = `/tool/cardimageflip/${nameURL}`;

  return (
    <Col className="card-image" xs="6" md="4" lg="3">
      <a href={`/tool/card/${nameURL}`} target="_blank" rel="noopener noreferrer">
        <FoilCardImage autocard card={{ details }} className="clickable" />
      </a>
    </Col>
  );
};

const renderCentering = (node) => {
  return <div className="centered-markdown">{node.children}</div>;
};

const renderCardrow = (node) => {
  return <Row className="cardRow">{node.children}</Row>;
};

const Markdown = ({ markdown, limited }) => {
  const renderers = {
    // overridden defaults
    link: renderLink,
    linkReference: renderLink,
    image: renderImage,
    imageReference: renderImage,
    blockquote: renderBlockQuote,
    heading: renderHeading,
    code: renderCode,
    table: renderTable,
    // plugins
    math: renderMath,
    inlineMath: renderInlineMath,
    userlink: renderUserlink,
    symbol: renderSymbol,
    cardlink: renderCardlink,
    cardimage: renderCardImage,
    centering: renderCentering,
    cardrow: renderCardrow,
  };

  const validSymbols = 'wubrgcmtsqepxyz/-0123456789';
  const markdownStr = markdown?.toString() ?? '';
  return (
    <ReactMarkdown
      className="markdown"
      plugins={[
        cardrow,
        centering,
        breaks,
        math,
        userlink,
        cardlink,
        slug,
        headings,
        [gfm, { singleTilde: false }],
        [symbols, { allowed: validSymbols }],
      ]}
      renderers={renderers}
    >
      {markdownStr}
    </ReactMarkdown>
  );
};

renderCardlink.propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  dfc: PropTypes.bool,
};

renderCardlink.defaultProps = {
  dfc: false,
};

Markdown.propTypes = {
  markdown: PropTypes.string.isRequired,
  limited: PropTypes.bool,
};

Markdown.defaultProps = {
  limited: false,
};

export default Markdown;
