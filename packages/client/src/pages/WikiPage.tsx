import React from 'react';

import { ChevronRightIcon, PencilIcon } from '@primer/octicons-react';
import type { WikiBreadcrumb, WikiCategory, WikiNode, WikiPageProps, WikiSearch } from '@utils/datatypes/Wiki';
import classNames from 'classnames';
import { slug } from 'github-slugger';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SafeMarkdown } from 'components/Markdown';
import RenderToRoot from 'components/RenderToRoot';
import WikiLayout from 'layouts/WikiLayout';

interface TocEntry {
  level: number;
  text: string;
  id: string;
}

// Build a table of contents from the markdown's h2/h3 headings. Heading IDs are derived with the
// same github-slugger `slug()` the Markdown component uses, so the anchors line up. Fenced code
// blocks are skipped so `#`-prefixed lines inside examples don't become false entries.
const buildToc = (markdown: string): TocEntry[] => {
  const entries: TocEntry[] = [];
  let inFence = false;
  let fenceMarker = '';
  for (const line of markdown.split('\n')) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const heading = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      entries.push({ level: heading[1].length, text, id: slug(text) });
    }
  }
  return entries;
};

const TableOfContents: React.FC<{ entries: TocEntry[] }> = ({ entries }) => (
  <nav aria-label="On this page">
    <Text sm semibold className="uppercase tracking-wide text-text-secondary">
      On this page
    </Text>
    <Flexbox direction="col" gap="1" className="mt-2">
      {entries.map((entry) => (
        <a
          key={`${entry.level}-${entry.id}`}
          href={`#${entry.id}`}
          className={classNames('block text-sm text-text-secondary hover:text-text transition-colors', {
            'ps-3': entry.level === 3,
          })}
        >
          {entry.text}
        </a>
      ))}
    </Flexbox>
  </nav>
);

const Breadcrumbs: React.FC<{ crumbs: WikiBreadcrumb[] }> = ({ crumbs }) => (
  <Flexbox direction="row" gap="1" alignItems="center" className="flex-wrap mb-3 text-sm text-text-secondary">
    {crumbs.map((crumb, i) => {
      const isLast = i === crumbs.length - 1;
      return (
        <React.Fragment key={`${crumb.href}-${crumb.title}`}>
          {i > 0 && <ChevronRightIcon size={12} className="text-text-secondary" />}
          {isLast || !crumb.href ? (
            <span className={isLast ? 'text-text' : undefined}>{crumb.title}</span>
          ) : (
            <Link href={crumb.href}>{crumb.title}</Link>
          )}
        </React.Fragment>
      );
    })}
  </Flexbox>
);

// A card listing the pages within one category, used on the landing overview.
const CategoryCard: React.FC<{ category: WikiCategory }> = ({ category }) => {
  // Flatten one level of nested categories into the list so the overview stays scannable.
  const links: { title: string; href: string; description?: string }[] = [];
  const collect = (nodes: WikiNode[]) => {
    for (const node of nodes) {
      if (node.type === 'page') {
        links.push({ title: node.title, href: node.href, description: node.description });
      } else if (node.href) {
        links.push({ title: node.title, href: node.href, description: node.description });
      } else {
        collect(node.children);
      }
    }
  };
  collect(category.children);

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="col" gap="1">
          <Text semibold lg>
            {category.href ? <Link href={category.href}>{category.title}</Link> : category.title}
          </Text>
          {category.description && (
            <Text sm className="text-text-secondary">
              {category.description}
            </Text>
          )}
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="3">
          {links.map((link) => (
            <Flexbox key={link.href} direction="col" gap="1">
              <Link href={link.href}>{link.title}</Link>
              {link.description && (
                <Text sm className="text-text-secondary">
                  {link.description}
                </Text>
              )}
            </Flexbox>
          ))}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const WikiLanding: React.FC<{ tree: WikiNode[] }> = ({ tree }) => {
  const categories = tree.filter((n): n is WikiCategory => n.type === 'category');
  const loosePages = tree.filter((n) => n.type === 'page');

  return (
    <Flexbox direction="col" gap="4">
      <Flexbox direction="col" gap="1">
        <Text xxxl bold>
          Wiki
        </Text>
        <Text className="text-text-secondary">
          Guides and reference for using Cube Cobra's features. Pick a topic from the sidebar, or browse below.
        </Text>
      </Flexbox>

      {loosePages.length > 0 && (
        <Card>
          <CardBody>
            <Flexbox direction="col" gap="3">
              {loosePages.map(
                (page) =>
                  page.type === 'page' && (
                    <Flexbox key={page.href} direction="col" gap="1">
                      <Link href={page.href}>{page.title}</Link>
                      {page.description && (
                        <Text sm className="text-text-secondary">
                          {page.description}
                        </Text>
                      )}
                    </Flexbox>
                  ),
              )}
            </Flexbox>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((category) => (
          <CategoryCard key={category.slug} category={category} />
        ))}
      </div>
    </Flexbox>
  );
};

const WikiArticle: React.FC<{ page: NonNullable<WikiPageProps['page']> }> = ({ page }) => {
  const toc = buildToc(page.markdown);
  const showToc = toc.length >= 2;

  return (
    <>
      <Breadcrumbs crumbs={page.breadcrumbs} />
      <div className="flex flex-col xl:flex-row xl:gap-6">
        <div className="min-w-0 flex-grow">
          {showToc && (
            <Card className="mb-3 xl:hidden">
              <CardBody>
                <TableOfContents entries={toc} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardBody>
              <Flexbox direction="col" gap="1" className="mb-3">
                <Text xxxl bold>
                  {page.title}
                </Text>
                {page.description && <Text className="text-text-secondary">{page.description}</Text>}
              </Flexbox>
              <SafeMarkdown markdown={page.markdown} />
            </CardBody>
          </Card>
          {page.editUrl && (
            <Flexbox direction="row" gap="1" alignItems="center" className="mt-3 text-sm">
              <PencilIcon size={14} />
              <Link href={page.editUrl} target="_blank" rel="noopener noreferrer">
                Edit this page on GitHub
              </Link>
            </Flexbox>
          )}
        </div>
        {showToc && (
          <aside className="hidden xl:block xl:w-56 xl:flex-shrink-0">
            <div className="xl:sticky xl:top-4">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        )}
      </div>
    </>
  );
};

const WikiSearchResults: React.FC<{ search: WikiSearch }> = ({ search }) => (
  <Flexbox direction="col" gap="4">
    <Flexbox direction="col" gap="1">
      <Text xxxl bold>
        Search
      </Text>
      <Text className="text-text-secondary">
        {search.results.length} {search.results.length === 1 ? 'result' : 'results'} for "{search.query}"
      </Text>
    </Flexbox>
    {search.results.length === 0 ? (
      <Card>
        <CardBody>
          <Text className="text-text-secondary">No pages matched your search.</Text>
        </CardBody>
      </Card>
    ) : (
      <Flexbox direction="col" gap="3">
        {search.results.map((result) => (
          <Card key={result.slug}>
            <CardBody>
              <Flexbox direction="col" gap="1">
                <Link href={result.href}>
                  <Text lg semibold>
                    {result.title}
                  </Text>
                </Link>
                <Text sm className="text-text-secondary">
                  {result.snippet}
                </Text>
              </Flexbox>
            </CardBody>
          </Card>
        ))}
      </Flexbox>
    )}
  </Flexbox>
);

const WikiPage: React.FC<WikiPageProps> = ({ tree, page, activeSlug, search }) => (
  <WikiLayout tree={tree} activeSlug={activeSlug} searchQuery={search?.query ?? ''}>
    {search ? <WikiSearchResults search={search} /> : page ? <WikiArticle page={page} /> : <WikiLanding tree={tree} />}
  </WikiLayout>
);

export default RenderToRoot(WikiPage);
