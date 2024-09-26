import React, { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Card, CardBody, Col, Row } from 'reactstrap';

import { LinkIcon } from '@primer/octicons-react';
import Latex from 'react-latex';
// @ts-expect-error This library has no types.
import ReactMarkdown, { MarkdownProps } from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

import FoilCardImage from 'components/FoilCardImage';
import LinkModal, { LinkModalProps } from 'components/LinkModal';
import withAutocard, { WithAutocardProps } from 'components/WithAutocard';
import withModal, { WithModalProps } from 'components/WithModal';
import CardDetails from 'datatypes/CardDetails';
import { ALL_PLUGINS, ALL_REHYPE_PLUGINS, LIMITED_REHYPE_PLUGINS } from 'markdown/parser';
import { isInternalURL, isSamePageURL } from 'utils/Util';

type AutocardLinkProps = WithAutocardProps & ComponentPropsWithoutRef<'a'>;
const AutocardLink: React.FC<AutocardLinkProps> = withAutocard('a');

const Link: React.FC<WithModalProps<LinkModalProps> & ComponentPropsWithoutRef<'a'>> = withModal<'a', LinkModalProps>(
  'a',
  LinkModal,
);

interface RenderBlockQuoteProps {
  children: ReactNode;
}
const renderBlockQuote: React.FC<RenderBlockQuoteProps> = (node) => (
  <Card className="quote">
    <CardBody>{node.children}</CardBody>
  </Card>
);

interface RenderImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}
const renderImage: React.FC<RenderImageProps> = (node) => (
  <img className="markdown-image" src={node.src} alt={node.alt} title={node.title} />
);

interface RenderLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}
const renderLink: React.FC<RenderLinkProps> = (node) => {
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

const renderCode: React.FC = (node: any) => {
  const mode = getComputedStyle(document.body).getPropertyValue('--mode').trim();
  const style = mode === 'dark' ? a11yDark : a11yLight;

  return (
    <SyntaxHighlighter language={node.children[0]?.props?.className?.replace('language-', '') || 'text'} style={style}>
      {node.node?.children[0]?.children[0]?.value?.trimEnd() || ''}
    </SyntaxHighlighter>
  );
};

interface RenderTableProps {
  children: ReactNode;
}
const renderTable: React.FC<RenderTableProps> = (node) => (
  <div className="table-responsive">
    <table className="table table-bordered">{node.children}</table>
  </div>
);

interface RenderMathProps {
  value: string;
}
const renderMath: React.FC<RenderMathProps> = (node) => (
  <Latex trust={false} displayMode>{`$$ ${node.value} $$`}</Latex>
);

interface RenderInlineMathProps {
  value: string;
}
const renderInlineMath: React.FC<RenderInlineMathProps> = (node) => <Latex trust={false}>{`$ ${node.value} $`}</Latex>;

interface RenderUserlinkProps {
  name: string;
}
const renderUserlink: React.FC<RenderUserlinkProps> = ({ name }) => {
  return (
    <a href={`/user/view/${name}`} target="_blank" rel="noopener noreferrer">
      @{name}
    </a>
  );
};

interface RenderSymbolProps {
  value: string;
}
const renderSymbol: React.FC<RenderSymbolProps> = ({ value }) => {
  if (!value) return null;
  const symbol = value.replace('/', '-').toLowerCase();
  return <img src={`/content/symbols/${symbol}.png`} alt={symbol} className="mana-symbol-sm" />;
};

interface RenderCardlinkProps {
  name: string;
  id: string;
  dfc?: boolean;
}
const renderCardlink: React.FC<RenderCardlinkProps> = ({ name, id, dfc }) => {
  const idURL = encodeURIComponent(id);
  const details: Partial<CardDetails> = { image_normal: `/tool/cardimage/${idURL}` };
  if (dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;

  return (
    <AutocardLink href={`/tool/card/${idURL}`} card={{ details } as any} target="_blank" rel="noopener noreferrer">
      {name}
    </AutocardLink>
  );
};

interface RenderCardImageProps {
  id: string;
  dfc?: boolean;
  inParagraph?: boolean;
}
const renderCardImage: React.FC<RenderCardImageProps> = (node) => {
  const idURL = encodeURIComponent(node.id);
  const details: Partial<CardDetails> = { image_normal: `/tool/cardimage/${idURL}` };
  if (node.dfc) details.image_flip = `/tool/cardimageflip/${idURL}`;
  const tag = node.inParagraph ? 'span' : 'div';
  return (
    <Col className="card-image d-block" xs="6" md="4" lg="3" tag={tag}>
      <a href={`/tool/card/${idURL}`} target="_blank" rel="noopener noreferrer">
        <FoilCardImage autocard card={{ details } as any} className="clickable" wrapperTag={tag} />
      </a>
    </Col>
  );
};

interface RenderCenteringProps {
  children: ReactNode;
}
const renderCentering: React.FC<RenderCenteringProps> = (node) => (
  <div className="centered-markdown">{node.children}</div>
);

interface RenderCardrowProps {
  inParagraph?: boolean;
  children: ReactNode;
}
const renderCardrow: React.FC<RenderCardrowProps> = (node) => (
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

export interface MarkdownProps {
  markdown: string;
  limited?: boolean;
}

const Markdown: React.FC<MarkdownProps> = ({ markdown, limited = false }) => {
  const markdownStr = markdown?.toString() ?? '';
  return (
    <ReactMarkdown
      className="markdown"
      remarkPlugins={ALL_PLUGINS as any}
      rehypePlugins={limited ? LIMITED_REHYPE_PLUGINS : ALL_REHYPE_PLUGINS}
      components={RENDERERS as any}
    >
      {markdownStr}
    </ReactMarkdown>
  );
};

export default Markdown;
