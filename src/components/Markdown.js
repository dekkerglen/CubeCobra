import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yLight, a11yDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { LinkIcon } from '@primer/octicons-react';

import { ALL_PLUGINS, LIMITED_REHYPE_PLUGINS, ALL_REHYPE_PLUGINS } from 'markdown/parser';

import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import LinkModal from 'components/LinkModal';
import FoilCardImage from 'components/FoilCardImage';
import { isInternalURL, isSamePageURL } from 'utils/Util';

import { Col, Row, Card, CardBody } from 'reactstrap';

const AutocardLink = withAutocard('a');
const Link = withModal('a', LinkModal);

const renderBlockQuote = (node) => (
  <Card className="quote">
    <CardBody>{node.children}</CardBody>
  </Card>
);

const renderImage = (node) => <img className="markdown-image" src={node.src} alt={node.alt} title={node.title} />;

const renderLink = (node) => {
  const ref = node.href ?? '';

  if (isInternalURL(ref)) {
    // heading autolink
    if (Array.isArray(node.children) && node.children[0]?.props?.className?.includes('icon')) {
      return (
        <a href={ref} className="heading-link">
          <LinkIcon size={16} className="link-icon" />
        </a>
      );
    }

    const props = isSamePageURL(ref) ? {} : { target: '_blank', rel: 'noopener noreferrer' };
    return (
      <a href={ref} {...props}>
        {node.children}
      </a>
    );
  }

  return (
    <Link href={`/leave?url=${encodeURIComponent(ref)}`} modalProps={{ link: ref }}>
      {node.children}
    </Link>
  );
};

const renderCode = (node) => {
  const mode = getComputedStyle(document.body).getPropertyValue('--mode').trim();
  const style = mode === 'dark' ? a11yDark : a11yLight;

  return (
    <SyntaxHighlighter language={node.children[0]?.props?.className?.replace('language-', '') || 'text'} style={style}>
      {node.node?.children[0]?.children[0]?.value?.trimEnd() || ''}
    </SyntaxHighlighter>
  );
};

const renderTable = (node) => (
  <div className="table-responsive">
    <table className="table table-bordered">{node.children}</table>
  </div>
);

const renderMath = (node) => <Latex trusted={false} displayMode>{`$$ ${node.value} $$`}</Latex>;

const renderInlineMath = (node) => <Latex trusted={false}>{`$ ${node.value} $`}</Latex>;

const renderUserlink = ({ name }) => {
  return (
    <a href={`/user/view/${name}`} target="_blank" rel="noopener noreferrer">
      @{name}
    </a>
  );
};

const renderSymbol = ({ value }) => {
  const symbol = value.replace('/', '-').toLowerCase();
  return <img src={`/content/symbols/${symbol}.png`} alt={symbol} className="mana-symbol-sm" />;
};

const renderCardlink = ({ name, id, dfc }) => {
  const idURL = encodeURIComponent(id);
  const details = { image_normal: `/tool/cardimage/${idURL}` };
  if (dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;

  return (
    <AutocardLink href={`/tool/card/${idURL}`} card={{ details }} target="_blank" rel="noopener noreferrer">
      {name}
    </AutocardLink>
  );
};

const renderCardImage = (node) => {
  const idURL = encodeURIComponent(node.id);
  const details = { image_normal: `/tool/cardimage/${idURL}` };
  if (node.dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;
  const tag = node.inParagraph ? 'span' : 'div';
  return (
    <Col className="card-image d-block" xs="6" md="4" lg="3" tag={tag}>
      <a href={`/tool/card/${idURL}`} target="_blank" rel="noopener noreferrer">
        <FoilCardImage autocard card={{ details }} className="clickable" wrapperTag={tag} />
      </a>
    </Col>
  );
};

const renderCentering = (node) => <div className="centered-markdown">{node.children}</div>;

const renderCardrow = (node) => (
  <Row className="cardRow" tag={node.inParagraph ? 'span' : 'div'}>
    {node.children}
  </Row>
);

const RENDERERS = {
  // overridden defaults
  a: renderLink,
  img: renderImage,
  blockquote: renderBlockQuote,
  pre: renderCode,
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

const Markdown = ({ markdown, limited }) => {
  const markdownStr = markdown?.toString() ?? '';
  return (
    <ReactMarkdown
      className="markdown"
      remarkPlugins={ALL_PLUGINS}
      rehypePlugins={limited ? LIMITED_REHYPE_PLUGINS : ALL_REHYPE_PLUGINS}
      components={RENDERERS}
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
