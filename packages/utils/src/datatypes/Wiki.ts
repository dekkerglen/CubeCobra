// Shared types for the on-site wiki. The wiki is a tree of markdown files living in
// packages/server/content/wiki: folders become categories, `.md` files become pages. The
// server reads that tree from disk (see serverutils/wiki.ts) and passes the nav tree plus the
// requested page to the WikiPage React component. Both sides import these types via @utils.

// A single wiki article, derived from a `.md` file.
export interface WikiPageLink {
  type: 'page';
  // Human-readable title (frontmatter `title`, else derived from the filename).
  title: string;
  // Path relative to the wiki root without numeric prefixes or `.md`, e.g.
  // "getting-started/creating-a-cube". Uniquely identifies the page.
  slug: string;
  // Full site path, e.g. "/wiki/getting-started/creating-a-cube".
  href: string;
  description?: string;
}

// A folder of wiki pages (and possibly sub-categories).
export interface WikiCategory {
  type: 'category';
  title: string;
  slug: string;
  // Set only when the folder has an index.md, which doubles as the category landing page.
  href?: string;
  description?: string;
  children: WikiNode[];
}

export type WikiNode = WikiCategory | WikiPageLink;

export interface WikiBreadcrumb {
  title: string;
  // Empty string when the crumb is not itself a linkable page (a bare category with no index).
  href: string;
}

// The fully-resolved data for a single rendered wiki page.
export interface WikiPageData {
  title: string;
  description?: string;
  // Raw markdown body (frontmatter stripped), rendered client-side with the Markdown component.
  markdown: string;
  breadcrumbs: WikiBreadcrumb[];
  // GitHub "edit this file" link so readers can propose changes via a PR.
  editUrl?: string;
}

// A single hit from a wiki search.
export interface WikiSearchResult {
  title: string;
  slug: string;
  href: string;
  // A short plaintext excerpt around the match (or the page's opening text for a title-only match).
  snippet: string;
}

export interface WikiSearch {
  query: string;
  results: WikiSearchResult[];
}

// Props for the WikiPage component. `page` is null on the /wiki landing view. `search` is set only
// when rendering search results (/wiki?q=...).
export interface WikiPageProps {
  tree: WikiNode[];
  page: WikiPageData | null;
  activeSlug: string | null;
  search?: WikiSearch | null;
}
