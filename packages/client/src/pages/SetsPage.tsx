import React, { useMemo, useState } from 'react';

import { cdnUrl } from '@utils/cdnUrl';
import { SetInfo } from '@utils/datatypes/SetInfo';

import Banner from 'components/Banner';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import SideBanner from 'components/SideBanner';
import MainLayout from 'layouts/MainLayout';

// Root-level sets per page; a root always renders with its full subtree, so the
// on-screen row count is a bit higher than this.
const PAGE_SIZE = 40;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'release', label: 'Sorted by Release Date' },
  { value: 'alpha', label: 'Sorted Alphabetically' },
  { value: 'cards', label: 'Sorted by Card Count' },
];

// "Paper/real sets" are the only ones allowed at the top level. Child sets of
// any type still nest underneath their paper parent.
const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'minigame']);
const isPaperSet = (set: SetInfo): boolean => !set.digital && !EXCLUDED_SET_TYPES.has(set.setType);

// White outline so the solid-black Scryfall symbols stay visible on any theme.
const SYMBOL_OUTLINE =
  'drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff)';

interface SetsPageProps {
  sets: SetInfo[];
}

interface TreeRow {
  set: SetInfo;
  depth: number;
}

// Link each set to the card search, showing every printing sorted by collector number.
const searchHref = (code: string): string => {
  const params = new URLSearchParams({
    f: `set:${code}`,
    s: 'Collector number',
    d: 'ascending',
    di: 'printing',
  });
  return `/tool/searchcards?${params.toString()}`;
};

// Turn "draft_innovation" into "Draft Innovation" for display.
const prettyType = (setType: string): string =>
  setType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const SetSymbol: React.FC<{ set: SetInfo }> = ({ set }) => (
  <img
    src={set.icon}
    alt={`${set.name} symbol`}
    className="w-7 h-7 shrink-0"
    style={{ filter: SYMBOL_OUTLINE }}
    loading="lazy"
    draggable={false}
  />
);

const compareSets = (a: SetInfo, b: SetInfo, sort: string): number => {
  if (sort === 'alpha') return a.name.localeCompare(b.name);
  if (sort === 'cards') return a.cardCount - b.cardCount;
  // release: chronological; undated sets sort last
  if (a.releasedAt === b.releasedAt) return a.name.localeCompare(b.name);
  if (!a.releasedAt) return 1;
  if (!b.releasedAt) return -1;
  return a.releasedAt < b.releasedAt ? -1 : 1;
};

const SetsPage: React.FC<SetsPageProps> = ({ sets }) => {
  const [queryText, setQueryText] = useState('');
  const [sort, setSort] = useState('release');
  const [ascending, setAscending] = useState('false');
  const [page, setPage] = useState(0);

  // Sets whose release date is still in the future get flagged.
  const today = new Date().toISOString().slice(0, 10);
  const isUpcoming = (set: SetInfo): boolean => !!set.releasedAt && set.releasedAt > today;

  const byCode = useMemo(() => {
    const map: Record<string, SetInfo> = {};
    sets.forEach((set) => {
      map[set.code] = set;
    });
    return map;
  }, [sets]);

  const childrenByParent = useMemo(() => {
    const map: Record<string, SetInfo[]> = {};
    sets.forEach((set) => {
      if (set.parentSetCode && byCode[set.parentSetCode]) {
        (map[set.parentSetCode] ||= []).push(set);
      }
    });
    return map;
  }, [sets, byCode]);

  const sortSiblings = useMemo(() => {
    return (arr: SetInfo[]): SetInfo[] => {
      const sorted = [...arr].sort((a, b) => compareSets(a, b, sort));
      if (ascending === 'false') sorted.reverse();
      return sorted;
    };
  }, [sort, ascending]);

  // Top-level nodes: paper sets that aren't nested under another included set.
  const roots = useMemo(
    () => sortSiblings(sets.filter((set) => isPaperSet(set) && (!set.parentSetCode || !byCode[set.parentSetCode]))),
    [sets, byCode, sortSiblings],
  );

  // Depth-first flatten of a set of roots into ordered rows carrying their depth.
  const flatten = useMemo(() => {
    return (rootsToWalk: SetInfo[]): TreeRow[] => {
      const out: TreeRow[] = [];
      const walk = (set: SetInfo, depth: number) => {
        out.push({ set, depth });
        const kids = childrenByParent[set.code];
        if (kids) sortSiblings(kids).forEach((kid) => walk(kid, depth + 1));
      };
      rootsToWalk.forEach((root) => walk(root, 0));
      return out;
    };
  }, [childrenByParent, sortSiblings]);

  // Every visible set (roots + descendants), used for counts and the backdrop.
  const universe = useMemo(() => flatten(roots), [flatten, roots]);

  const query = queryText.trim().toLowerCase();
  const isSearching = query.length > 0;
  const matchesQuery = (set: SetInfo): boolean =>
    !isSearching || set.name.toLowerCase().includes(query) || set.code.toLowerCase().includes(query);

  // One entry per root, holding that root's pruned subtree rows. A node survives
  // the filter if it matches or has a descendant that matches, so matched
  // children keep their (indented) ancestors for context.
  const rootGroups = useMemo(() => {
    // Depth counts only matching ancestors, so a matched set whose parent is
    // filtered out is promoted to a root (depth 0) instead of nesting under a
    // non-matching parent.
    const collect = (set: SetInfo, depth: number): TreeRow[] => {
      const selfMatch = matchesQuery(set);
      const childDepth = selfMatch ? depth + 1 : depth;
      const kids = childrenByParent[set.code] ? sortSiblings(childrenByParent[set.code]) : [];
      const childRows = kids.flatMap((kid) => collect(kid, childDepth));
      return selfMatch ? [{ set, depth }, ...childRows] : childRows;
    };
    return roots.map((root) => collect(root, 0)).filter((rows) => rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, childrenByParent, sortSiblings, isSearching, query]);

  const shownCount = isSearching ? universe.filter(({ set }) => matchesQuery(set)).length : universe.length;

  // Page whole trees by their root so a parent never gets split from its children.
  const pageCount = Math.max(1, Math.ceil(rootGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const displayRows: TreeRow[] = rootGroups.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE).flat();

  const headers = ['Set', 'Code', 'Cards', 'Type', 'Released'];
  const rows = displayRows.map(({ set, depth }) => {
    const upcoming = isUpcoming(set);
    return {
      Set: (
        <span
          className="inline-flex items-center gap-2"
          style={depth ? { paddingLeft: `${depth * 1.25}rem` } : undefined}
        >
          {depth > 0 && (
            <span className="text-text-secondary select-none" aria-hidden>
              ↳
            </span>
          )}
          <SetSymbol set={set} />
          <a href={searchHref(set.code)} className="text-link hover:text-link-active font-semibold">
            {set.name}
          </a>
        </span>
      ),
      Code: set.code.toUpperCase(),
      Cards: set.cardCount.toLocaleString(),
      Type: prettyType(set.setType),
      Released: <span className={upcoming ? 'text-amber-500 font-semibold' : ''}>{set.releasedAt ?? '—'}</span>,
    };
  });

  // Give upcoming sets an amber left border as an at-a-glance flag.
  const getRowProps = (rowIndex: number) =>
    isUpcoming(displayRows[rowIndex].set) ? { className: 'border-l-4 border-l-amber-500' } : {};

  const renderPager = (inverted: boolean) => (
    <Pagination count={pageCount} active={safePage} onClick={(newPage) => setPage(newPage)} inverted={inverted} />
  );

  return (
    <MainLayout useContainer={false} transparentNav>
      <div className="relative min-h-screen">
        {/* Image backdrop matching Cube Search / Packages browse pages. */}
        <div className="absolute inset-x-0 top-0 h-screen overflow-hidden bg-bg-secondary pointer-events-none z-0">
          <img
            src={cdnUrl('/content/retrocobra.webp')}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-top select-none"
          />
          <div className="absolute inset-0 bg-bg-secondary/80" />
          {universe.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-[25vh] bg-gradient-to-b from-transparent to-bg pointer-events-none" />
          )}
        </div>

        <a
          href="https://bsky.app/profile/firosart.bsky.social"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-20 right-3 text-xs text-button-text/70 hover:text-button-text underline-offset-2 hover:underline z-[15]"
        >
          Art by Santiago Rosas
        </a>

        <div className="relative z-10">
          {/* Hero: title + filter + sort controls */}
          <div className="px-4 pt-28 pb-10 md:pt-36 md:pb-12">
            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-5">
              <div>
                <Text xxxxl bold className="!text-button-text block">
                  Sets
                </Text>
                <p className="mt-1 text-sm text-button-text/80">
                  Browse every Magic set. Select a set to see its cards.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2">
                <Input
                  placeholder="Filter sets by name or code..."
                  value={queryText}
                  onChange={(event) => {
                    setQueryText(event.target.value);
                    setPage(0);
                  }}
                  className="!bg-white !text-gray-800 !placeholder-gray-500 !border-gray-300"
                  otherInputProps={{ enterKeyHint: 'search', name: 'q' }}
                />

                <Flexbox direction="row" alignItems="center" justify="center" gap="2" wrap="wrap">
                  <div className="w-52">
                    <Select
                      dense
                      options={SORT_OPTIONS}
                      value={sort}
                      setValue={(value) => {
                        setSort(value);
                        setPage(0);
                      }}
                    />
                  </div>
                  <div className="w-36">
                    <Select
                      dense
                      options={[
                        { value: 'true', label: 'Ascending' },
                        { value: 'false', label: 'Descending' },
                      ]}
                      value={ascending}
                      setValue={(value) => {
                        setAscending(value);
                        setPage(0);
                      }}
                    />
                  </div>
                </Flexbox>
              </div>
            </div>
          </div>

          {/* Set list — narrower content column, centered between the ad rails */}
          <Container xxxl className="pb-6">
            <Flexbox direction="row" gap="4">
              <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
                <SideBanner placementId="left-rail" />
              </ResponsiveDiv>
              <div className="flex-grow px-2 w-full max-w-5xl mx-auto min-w-0">
                <Flexbox direction="col" gap="3" className="pt-3 md:pt-4 pb-3">
                  <Flexbox direction="row" alignItems="center" justify="between" gap="3" wrap="wrap" className="w-full">
                    <Text lg semibold className="!text-button-text">
                      {`${shownCount.toLocaleString()} sets`}
                    </Text>
                    {universe.length > 0 && renderPager(true)}
                  </Flexbox>
                </Flexbox>
                <DynamicFlash />
                <Banner />
                <Flexbox direction="col" gap="3" className="mt-3">
                  {displayRows.length > 0 ? (
                    <Flexbox direction="col" gap="2">
                      <Table
                        headers={headers}
                        rows={rows}
                        getRowProps={getRowProps}
                        hideOnMobile={['Code', 'Type']}
                        wrapCells
                      />
                      <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2">
                        {renderPager(false)}
                      </Flexbox>
                    </Flexbox>
                  ) : (
                    <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2 py-12">
                      <Text semibold lg className="!text-button-text">
                        No Results
                      </Text>
                    </Flexbox>
                  )}
                </Flexbox>
              </div>
              <ResponsiveDiv lg className="pr-2 py-2 min-w-fit">
                <SideBanner placementId="right-rail" />
              </ResponsiveDiv>
            </Flexbox>
          </Container>
        </div>
      </div>
    </MainLayout>
  );
};

export default RenderToRoot(SetsPage);
