import React, { ComponentPropsWithoutRef, ReactNode } from 'react';

import { LinkIcon } from '@primer/octicons-react';
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
import Text from 'components/base/Text';
import Link, { LinkProps } from 'components/base/Link';
import { Flexbox } from './base/Layout';

type AutocardLinkProps = WithAutocardProps & LinkProps;
const AutocardLink: React.FC<AutocardLinkProps> = withAutocard(Link);

const ExternalLink: React.FC<WithModalProps<LinkModalProps> & ComponentPropsWithoutRef<'a'>> = withModal<
  'a',
  LinkModalProps
>('a', LinkModal);

interface RenderBlockQuoteProps {
  children: ReactNode;
}
const renderBlockQuote: React.FC<RenderBlockQuoteProps> = (node) => (
  <div className="border border-border background-background-secondary mb-4 p-4">{node.children}</div>
);

interface RenderImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}
const renderImage: React.FC<RenderImageProps> = (node) => (
  <img className="max-w-full" src={node.src} alt={node.alt} title={node.title} />
);

interface RenderLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}
const renderLink: React.FC<RenderLinkProps> = (node) => {
  const ref = node.href ?? '';

  if (isInternalURL(ref)) {
    // heading autolink
    if (Array.isArray(node.children) && node.children[0]?.props?.className?.includes('icon')) {
      return (
        <a href={ref} className="float-left -ml-6 pr-2 align-middle">
          <LinkIcon size={16} className="align-middle invisible group-hover:visible" />
        </a>
      );
    }

    const props = isSamePageURL(ref) ? {} : { target: '_blank', rel: 'noopener noreferrer' };
    return (
      <Link href={ref} {...props}>
        {node.children}
      </Link>
    );
  }

  return (
    <ExternalLink
      className="font-medium text-link hover:text-link-active"
      href={`/leave?url=${encodeURIComponent(ref)}`}
      modalprops={{ link: ref }}
    >
      {node.children}
    </ExternalLink>
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
  <div className="overflow-x-auto">
    <table className="table-auto border-collapse border border-gray-300">{node.children}</table>
  </div>
);
interface RenderUserlinkProps {
  name: string;
}
const renderUserlink: React.FC<RenderUserlinkProps> = ({ name }) => {
  return (
    <Link href={`/user/view/${name}`} target="_blank" rel="noopener noreferrer">
      @{name}
    </Link>
  );
};

interface RenderSymbolProps {
  value: string;
}
const renderSymbol: React.FC<RenderSymbolProps> = ({ value }) => {
  if (!value) return null;
  const symbol = value.replace('/', '-').toLowerCase();
  return <img src={`/content/symbols/${symbol}.png`} alt={symbol} className="w-6 h-6 inline" />;
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
    <div className="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/6">
      <Link href={`/tool/card/${idURL}`} target="_blank" rel="noopener noreferrer">
        <FoilCardImage autocard card={{ details } as any} className="clickable" wrapperTag={tag} />
      </Link>
    </div>
  );
};
interface RenderCenteringProps {
  children: ReactNode;
}
const renderCentering: React.FC<RenderCenteringProps> = (node) => (
  <div className="w-full text-center">{node.children}</div>
);

interface RenderCardrowProps {
  inParagraph?: boolean;
  children: ReactNode;
}
const renderCardrow: React.FC<RenderCardrowProps> = (node) => (
  <Flexbox direction="row" justify="center">
    <Flexbox direction="row" wrap="wrap" gap="2">
      {node.children}
    </Flexbox>
  </Flexbox>
);

interface RenderH1Props {
  children: ReactNode;
}
const renderH1: React.FC<RenderH1Props> = (node) => (
  <Text xxxxl semibold className="mb-4">
    {node.children}
  </Text>
);

interface RenderH2Props {
  children: ReactNode;
}

const renderH2: React.FC<RenderH2Props> = (node) => (
  <Text xxxl semibold className="mb-2">
    {node.children}
  </Text>
);

interface RenderH3Props {
  children: ReactNode;
}

const renderH3: React.FC<RenderH3Props> = (node) => (
  <Text xxl semibold className="mb-2">
    {node.children}
  </Text>
);

interface RenderH4Props {
  children: ReactNode;
}

const renderH4: React.FC<RenderH4Props> = (node) => (
  <Text xl semibold className="mb-2">
    {node.children}
  </Text>
);

interface RenderH5Props {
  children: ReactNode;
}

const renderH5: React.FC<RenderH5Props> = (node) => (
  <Text lg semibold className="mb-2">
    {node.children}
  </Text>
);

interface RenderH6Props {
  children: ReactNode;
}

const renderH6: React.FC<RenderH6Props> = (node) => (
  <Text md semibold className="mb-2">
    {node.children}
  </Text>
);

interface renderUlProps {
  children: ReactNode;
}

const renderUl: React.FC<renderUlProps> = (node) => <ul className="list-disc list-inside">{node.children}</ul>;

interface renderOlProps {
  children: ReactNode;
}

const renderOl: React.FC<renderOlProps> = (node) => <ol className="list-decimal list-inside">{node.children}</ol>;

const RENDERERS = {
  // overridden defaults
  a: renderLink,
  img: renderImage,
  blockquote: renderBlockQuote,
  pre: renderCode,
  table: renderTable,
  h1: renderH1,
  h2: renderH2,
  h3: renderH3,
  h4: renderH4,
  h5: renderH5,
  h6: renderH6,
  ul: renderUl,
  ol: renderOl,
  // plugins
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
      className="flex flex-col gap-2"
      remarkPlugins={ALL_PLUGINS as any}
      rehypePlugins={limited ? LIMITED_REHYPE_PLUGINS : ALL_REHYPE_PLUGINS}
      components={RENDERERS as any}
    >
      {markdownStr}
    </ReactMarkdown>
  );
};

export default Markdown;
