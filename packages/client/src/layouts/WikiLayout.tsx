import React from 'react';

import { BookIcon, SearchIcon } from '@primer/octicons-react';
import type { WikiNode } from '@utils/datatypes/Wiki';
import classNames from 'classnames';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';

interface WikiNavTreeProps {
  nodes: WikiNode[];
  activeSlug: string | null;
  depth?: number;
}

// Recursive sidebar: categories render as a heading (linked when they have an index page) with their
// children indented beneath; pages render as links, highlighted when they are the active article.
const WikiNavTree: React.FC<WikiNavTreeProps> = ({ nodes, activeSlug, depth = 0 }) => (
  <Flexbox direction="col" gap="1">
    {nodes.map((node) => {
      if (node.type === 'category') {
        return (
          <div key={node.slug} className={classNames({ 'mt-2': depth === 0 })}>
            {node.href ? (
              <a
                href={node.href}
                className={classNames(
                  'block px-2 py-1 rounded text-sm font-semibold transition-colors',
                  activeSlug === node.slug
                    ? 'bg-button-primary text-white'
                    : 'text-text hover:bg-bg-active',
                )}
              >
                {node.title}
              </a>
            ) : (
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {node.title}
              </div>
            )}
            <div className="ml-2 border-l border-border ps-2 mt-1">
              <WikiNavTree nodes={node.children} activeSlug={activeSlug} depth={depth + 1} />
            </div>
          </div>
        );
      }
      return (
        <a
          key={node.slug}
          href={node.href}
          aria-current={activeSlug === node.slug ? 'page' : undefined}
          className={classNames(
            'block px-2 py-1 rounded text-sm transition-colors',
            activeSlug === node.slug
              ? 'bg-button-primary text-white font-medium'
              : 'text-text-secondary hover:bg-bg-active hover:text-text',
          )}
        >
          {node.title}
        </a>
      );
    })}
  </Flexbox>
);

interface WikiLayoutProps {
  tree: WikiNode[];
  activeSlug: string | null;
  /** Prefills the search box, e.g. on the search results page. */
  searchQuery?: string;
  children: React.ReactNode;
}

const WikiLayout: React.FC<WikiLayoutProps> = ({ tree, activeSlug, searchQuery = '', children }) => (
  <MainLayout useContainer={false}>
    <div className="w-full px-4 py-4">
      <Flexbox direction="row" gap="4" className="md:flex-row flex-col">
        <div className="md:w-64 md:flex-shrink-0 min-w-0">
          <div className="md:sticky md:top-4">
            <a href="/wiki" className="flex items-center gap-2 px-2 py-2 text-text">
              <BookIcon size={20} />
              <Text lg semibold>
                Wiki
              </Text>
            </a>
            <form action="/wiki" method="get" role="search" className="mt-1 mb-2 px-1">
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Search the wiki"
                  aria-label="Search the wiki"
                  className="w-full rounded-md border border-border bg-bg pl-3 pr-9 py-1.5 text-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-focus-ring"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                >
                  <SearchIcon size={16} />
                </button>
              </div>
            </form>
            <div className="mt-1 max-h-[75vh] overflow-y-auto pr-1">
              <WikiNavTree nodes={tree} activeSlug={activeSlug} />
            </div>
          </div>
        </div>

        <div className="flex-grow min-w-0">
          <DynamicFlash />
          {children}
        </div>
      </Flexbox>
    </div>
  </MainLayout>
);

export default WikiLayout;
