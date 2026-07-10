import type {
  WikiBreadcrumb,
  WikiCategory,
  WikiNode,
  WikiPageData,
  WikiPageLink,
  WikiSearchResult,
} from '@utils/datatypes/Wiki';
import fs from 'fs';
import path from 'path';

// The wiki content lives beside the compiled source: packages/server/content/wiki in dev (tsx runs
// from src/), dist/server/content/wiki in prod (the build copies content/** into dist/server). Both
// resolve to ../../content/wiki relative to this file (src/serverutils or dist/server/src/serverutils).
const WIKI_DIR = path.join(__dirname, '..', '..', 'content', 'wiki');

// Where "Edit this page" links point. Editors get GitHub's edit-in-place flow, which forks + opens a
// PR without any local setup — the whole reason the wiki is plain markdown in the repo.
const GITHUB_EDIT_BASE = 'https://github.com/dekkerglen/CubeCobra/edit/master/packages/server/content/wiki/';

// Files that are not themselves articles: index.md defines its folder's landing page/metadata, and
// README.md is contributor instructions that shouldn't appear in the nav.
const NON_ARTICLE_FILES = new Set(['index.md', 'readme.md']);

interface PageRecord {
  slug: string;
  title: string;
  description?: string;
  order: number;
  absPath: string;
  // Path relative to WIKI_DIR (with the real filename), used to build the GitHub edit URL.
  relPath: string;
}

interface WikiIndex {
  tree: WikiNode[];
  pages: Map<string, PageRecord>;
  // slug -> nav label + href for every node (pages and categories), for breadcrumb resolution.
  // A bare category with no index.md has an empty href.
  nodeInfo: Map<string, { title: string; href: string }>;
}

interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

// Minimal YAML-frontmatter parser: a leading `---` fenced block of `key: value` lines. We keep it
// dependency-free and deliberately simple — wiki frontmatter only ever holds title/order/description.
const parseFrontmatter = (raw: string): Frontmatter => {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) {
    return { data: {}, body: raw };
  }
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Strip matching surrounding quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
};

// "01-creating-a-cube" -> { order: 1, slugPart: "creating-a-cube" }. A leading `NN-`/`NN_` numeric
// prefix orders files in the folder listing without leaking into the URL. No prefix -> order NaN.
const splitOrderPrefix = (name: string): { order: number; slugPart: string } => {
  const m = /^(\d+)[-_.](.*)$/.exec(name);
  if (m) {
    return { order: parseInt(m[1]!, 10), slugPart: m[2]! };
  }
  return { order: NaN, slugPart: name };
};

const toSlugPart = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Fallback title when frontmatter omits one: "creating-a-cube" -> "Creating A Cube".
const titleFromName = (raw: string): string =>
  raw
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const resolveOrder = (frontmatterOrder: string | undefined, prefixOrder: number): number => {
  if (frontmatterOrder !== undefined && frontmatterOrder.trim() !== '') {
    const n = Number(frontmatterOrder);
    if (!Number.isNaN(n)) return n;
  }
  if (!Number.isNaN(prefixOrder)) return prefixOrder;
  // Unordered items sort after ordered ones, then alphabetically by title.
  return Number.MAX_SAFE_INTEGER;
};

const sortNodes = (nodes: { order: number; title: string }[]): void => {
  nodes.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title)));
};

// Recursively turn a content directory into nav nodes, registering every article in `pages` and
// every node's label/href in `nodeInfo`. `parentSlug` is the URL slug prefix for this directory.
const buildNodes = (
  dir: string,
  parentSlug: string,
  pages: Map<string, PageRecord>,
  nodeInfo: Map<string, { title: string; href: string }>,
): WikiNode[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const nodes: (WikiNode & { order: number })[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const { order: prefixOrder, slugPart } = splitOrderPrefix(entry.name);
      const slug = parentSlug ? `${parentSlug}/${toSlugPart(slugPart)}` : toSlugPart(slugPart);
      const absDir = path.join(dir, entry.name);

      // A folder's index.md (if any) supplies its title/order/description and doubles as its landing page.
      let title = titleFromName(slugPart);
      let description: string | undefined;
      let order = resolveOrder(undefined, prefixOrder);
      let href: string | undefined;

      const indexPath = path.join(absDir, 'index.md');
      if (fs.existsSync(indexPath)) {
        const { data } = parseFrontmatter(fs.readFileSync(indexPath, 'utf8'));
        title = data.title || title;
        description = data.description || undefined;
        order = resolveOrder(data.order, prefixOrder);
        href = `/wiki/${slug}`;
        pages.set(slug, {
          slug,
          title,
          description,
          order,
          absPath: indexPath,
          relPath: path.relative(WIKI_DIR, indexPath),
        });
      }

      const children = buildNodes(absDir, slug, pages, nodeInfo);
      nodeInfo.set(slug, { title, href: href ?? '' });
      const category: WikiCategory & { order: number } = {
        type: 'category',
        title,
        slug,
        href,
        description,
        children,
        order,
      };
      nodes.push(category);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      if (NON_ARTICLE_FILES.has(entry.name.toLowerCase())) continue;
      const base = entry.name.slice(0, -3);
      const { order: prefixOrder, slugPart } = splitOrderPrefix(base);
      const slug = parentSlug ? `${parentSlug}/${toSlugPart(slugPart)}` : toSlugPart(slugPart);
      const absPath = path.join(dir, entry.name);
      const { data } = parseFrontmatter(fs.readFileSync(absPath, 'utf8'));
      const title = data.title || titleFromName(slugPart);
      const description = data.description || undefined;
      const order = resolveOrder(data.order, prefixOrder);
      const href = `/wiki/${slug}`;

      pages.set(slug, { slug, title, description, order, absPath, relPath: path.relative(WIKI_DIR, absPath) });
      nodeInfo.set(slug, { title, href });
      const page: WikiPageLink & { order: number } = {
        type: 'page',
        title,
        slug,
        href,
        description,
        order,
      };
      nodes.push(page);
    }
  }

  sortNodes(nodes);
  // Strip the internal `order` field from the returned tree.
  return nodes.map(({ order: _order, ...node }) => node as WikiNode);
};

let cached: WikiIndex | null = null;

const buildIndex = (): WikiIndex => {
  const pages = new Map<string, PageRecord>();
  const nodeInfo = new Map<string, { title: string; href: string }>();
  let tree: WikiNode[] = [];
  if (fs.existsSync(WIKI_DIR)) {
    tree = buildNodes(WIKI_DIR, '', pages, nodeInfo);
  }
  return { tree, pages, nodeInfo };
};

// Cache in production (content is baked into the build); rebuild every call in dev so edits to
// markdown files show up on refresh without restarting the server.
const getIndex = (): WikiIndex => {
  if (process.env.NODE_ENV !== 'production') {
    return buildIndex();
  }
  if (!cached) {
    cached = buildIndex();
  }
  return cached;
};

// The nav tree for the sidebar / landing page.
export const getWikiTree = (): WikiNode[] => getIndex().tree;

const buildBreadcrumbs = (slug: string, nodeInfo: Map<string, { title: string; href: string }>): WikiBreadcrumb[] => {
  const crumbs: WikiBreadcrumb[] = [{ title: 'Wiki', href: '/wiki' }];
  const segments = slug.split('/');
  for (let i = 0; i < segments.length; i += 1) {
    const partial = segments.slice(0, i + 1).join('/');
    const info = nodeInfo.get(partial);
    if (info) {
      crumbs.push({ title: info.title, href: info.href });
    }
  }
  return crumbs;
};

// Reduce markdown to readable plain text for searching and snippets: drop fenced code blocks, turn
// inline code / card links / links into their visible text, strip the remaining markdown punctuation,
// and collapse whitespace.
const plaintextify = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code -> its contents
    .replace(/!?\[\[!?\/*([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1') // [[!/Card|id]] -> Card
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) / ![alt](url) -> label
    .replace(/^\s{0,3}[-*+]\s+\[[ xX]\]\s*/gm, '') // task-list checkboxes
    .replace(/[#>*_~|]/g, ' ') // heading/quote/emphasis/strike/table punctuation
    .replace(/\s+/g, ' ')
    .trim();

const SNIPPET_RADIUS = 90;

const buildSnippet = (text: string, matchIndex: number, matchLength: number): string => {
  if (matchIndex === -1) {
    const head = text.slice(0, SNIPPET_RADIUS * 2).trim();
    return text.length > SNIPPET_RADIUS * 2 ? `${head}…` : head;
  }
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIndex + matchLength + SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

// Case-insensitive plaintext (substring) search over every wiki page's title and body.
export const searchWiki = (query: string): WikiSearchResult[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const index = getIndex();
  const results: (WikiSearchResult & { titleMatch: boolean })[] = [];

  for (const record of index.pages.values()) {
    const { body } = parseFrontmatter(fs.readFileSync(record.absPath, 'utf8'));
    const text = plaintextify(body);
    const titleMatch = record.title.toLowerCase().includes(q);
    const bodyIndex = text.toLowerCase().indexOf(q);
    if (!titleMatch && bodyIndex === -1) continue;

    results.push({
      title: record.title,
      slug: record.slug,
      href: `/wiki/${record.slug}`,
      snippet: buildSnippet(text, bodyIndex, q.length),
      titleMatch,
    });
  }

  // Title matches first, then alphabetically by title.
  results.sort((a, b) =>
    a.titleMatch !== b.titleMatch ? Number(b.titleMatch) - Number(a.titleMatch) : a.title.localeCompare(b.title),
  );

  return results.map(({ titleMatch: _titleMatch, ...result }) => result);
};

// Resolve a slug (e.g. "getting-started/creating-a-cube") to its rendered page, or null if unknown.
export const getWikiPage = (slug: string): WikiPageData | null => {
  const index = getIndex();
  const record = index.pages.get(slug);
  if (!record) {
    return null;
  }
  const raw = fs.readFileSync(record.absPath, 'utf8');
  const { body } = parseFrontmatter(raw);
  return {
    title: record.title,
    description: record.description,
    markdown: body,
    breadcrumbs: buildBreadcrumbs(slug, index.nodeInfo),
    editUrl: `${GITHUB_EDIT_BASE}${record.relPath.split(path.sep).join('/')}`,
  };
};
