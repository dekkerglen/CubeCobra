import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex';

import math from 'remark-math';
import breaks from 'remark-breaks';
import userlink from 'markdown/userlink';
import strikethrough from 'markdown/strikethrough';
import symbols from 'markdown/symbols';
import cardlink from 'markdown/cardlink';
import centering from 'markdown/centering';

import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import LinkModal from 'components/LinkModal';
import FoilCardImage from 'components/FoilCardImage';

import { Col, Row, Card, CardBody } from 'reactstrap';

const AutocardLink = withAutocard('a');
const Link = withModal('a', LinkModal);

function renderBlockQuote(node) {
  return (
    <Card className="bg-light">
      <CardBody>{node.children}</CardBody>
    </Card>
  );
}

function renderLink(node) {
  const ref = encodeURI(node.node?.url ?? '');

  const isInternalURL = (to) => {
    try {
      const url = new URL(to, window.location.origin);
      return url.hostname === window.location.hostname;
    } catch {
      return false;
    }
  };

  if (isInternalURL(ref)) {
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
}

function renderMath(node) {
  return <Latex trusted={false} displayMode>{`$$ ${node.value} $$`}</Latex>;
}

function renderInlineMath(node) {
  return <Latex trusted={false}>{`$ ${node.value} $`}</Latex>;
}

function renderUserlink(node) {
  const name = node.value;
  return (
    <a href={`/user/view/${name}`} target="_blank" rel="noopener noreferrer">
      @{name}
    </a>
  );
}

function renderSymbol(node) {
  const symbol = node.value.replace('/', '-').toLowerCase();
  return <img src={`/content/symbols/${symbol}.png`} alt={symbol} className="mana-symbol-sm" />;
}

function renderCardlink({ name, id, dfc }) {
  const idURL = encodeURIComponent(id ?? name);
  const details = { image_normal: `/tool/cardimage/${idURL}` };
  if (dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;

  return (
    <AutocardLink href={`/tool/card/${idURL}`} card={{ details }} target="_blank" rel="noopener noreferrer">
      {name}
    </AutocardLink>
  );
}

function renderCardImage(node) {
  const name = node.value;
  const nameURL = encodeURIComponent(name);
  const details = { image_normal: `/tool/cardimage/${nameURL}` };
  if (node.dfc) details.image_flip = `/tool/cardimageflip/${nameURL}`;

  return (
    <Col xs="6" md="4" lg="3">
      <a href={`/tool/card/${nameURL}`} target="_blank" rel="noopener noreferrer">
        <FoilCardImage autocard card={{ details }} className="clickable" />
      </a>
    </Col>
  );
}

function renderCentering(node) {
  return <div className="centered-markdown">{node.children}</div>;
}

const Markdown = ({ markdown, limited }) => {
  const renderers = {
    link: renderLink,
    blockquote: renderBlockQuote,
    math: renderMath,
    inlineMath: renderInlineMath,
    userlink: renderUserlink,
    symbol: renderSymbol,
    cardlink: renderCardlink,
    cardimage: renderCardImage,
    centering: renderCentering,
  };

  const validSymbols = 'wubrgcmtsqepxyz/-0123456789';
  const markdownStr = markdown?.toString() ?? '';
  return (
    <ReactMarkdown
      plugins={[centering, breaks, math, userlink, cardlink, strikethrough, [symbols, { allowed: validSymbols }]]}
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
