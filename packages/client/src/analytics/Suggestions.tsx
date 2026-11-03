import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import CardType, { CardDetails } from '@utils/datatypes/Card';

import { Card, CardBody } from '../components/base/Card';
import { Flexbox } from '../components/base/Layout';
import Pagination from '../components/base/Pagination';
import ResponsiveDiv from '../components/base/ResponsiveDiv';
import Spinner from '../components/base/Spinner';
import Text from '../components/base/Text';
import CardGrid from '../components/card/CardGrid';
import AnalysisBoardPicker from '../components/cube/AnalysisBoardPicker';
import CubeTray from '../components/cubetray/CubeTray';
import FilterCollapse from '../components/FilterCollapse';
import AddToCubeModal from '../components/modals/AddToCubeModal';
import AnalysisViewContext from '../contexts/AnalysisViewContext';
import { CSRFContext } from '../contexts/CSRFContext';
import CubeContext from '../contexts/CubeContext';
import { CubeTrayProvider } from '../contexts/CubeTrayContext';
import DisplayContext from '../contexts/DisplayContext';
import FilterContext from '../contexts/FilterContext';
import { getCardDetails } from '../utils/cardDetailsCache';

// Display page size — how many cards a user sees per page.
const PAGE_SIZE = 96;
// How many results one fetch asks the recommender for. A fetch covers a whole
// window of display pages, so moving between pages inside a window costs no
// round trip, and a window that loses a few unresolvable ids still fills its
// first page.
const FETCH_LIMIT = PAGE_SIZE * 2;
const PAGES_PER_WINDOW = FETCH_LIMIT / PAGE_SIZE;
// A shrinking total retargets the fetch at the last page that still exists.
// Two retries is already far past what a single stale total can need; the cap
// only exists so a pathologically unstable total can't loop.
const MAX_FETCH_ATTEMPTS = 3;

type ErrorState = 'none' | 'ml-unavailable' | 'generic';

const Suggestions: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const { filterInput } = useContext(FilterContext);
  const { cube } = useContext(CubeContext);
  const { cubeSidebarExpanded } = useContext(DisplayContext);
  const analysisViewContext = useContext(AnalysisViewContext);
  // The boards whose cards the recommender treats as the cube.
  const boards = analysisViewContext?.boards ?? ['mainboard'];
  const boardsKey = boards.join(',');

  // An empty cube has no signal for the recommender, so Smart Search degrades to
  // plain card search sorted by Elo (via /tool/api/searchcards) instead.
  const isEmptyCube = boards.every((board) => (cube.cards?.[board]?.length ?? 0) === 0);
  // Keep the floating tray clear of the cube sidebar (expanded w-52 / collapsed w-16).
  const trayLeftClassName = cubeSidebarExpanded ? 'left-4 sm:left-[14rem]' : 'left-4 sm:left-20';

  // The cards on the page being shown. Other pages live in the window cache
  // below, not in state — a page is served from there without a fetch.
  const [pageCards, setPageCards] = useState<CardType[]>([]);
  const [page, setPage] = useState(0);
  // The server's count of every result matching the filter, before pagination.
  // The only source of the page count.
  const [total, setTotal] = useState(0);
  // True only while actively fetching a window the cache doesn't hold.
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>('none');
  const [modalCard, setModalCard] = useState<CardType | null>(null);

  // Mutable state for the fetch routine. Refs (not state) so the routine sees
  // live values and stays a stable callback that doesn't churn effects.
  const generationRef = useRef(0); // bumps on every new search; cancels stale fetches
  // Results already fetched, keyed by window index (recommender) or by page
  // index (empty-cube search, which is already one request per page). Replaced
  // wholesale on every generation bump, so it can never outlive its search.
  const cacheRef = useRef<Map<number, CardType[]>>(new Map());
  // The total the cached windows were fetched under. A different total means the
  // ranked list changed under us, so windows cached against the old one no
  // longer describe the same results and are dropped.
  const totalRef = useRef(0);
  // Only the newest navigation may commit; an older fetch still in flight is dropped.
  const requestRef = useRef(0);

  // Latest request params, read by the (otherwise stable) fetch routine.
  // react/refs flags the render-phase write. This is the "latest ref" idiom: the object is
  // only read from the async fetch routine, which always runs after render.
  const paramsRef = useRef({
    cubeId: cube.id,
    filterText: filterInput,
    printingPreference: cube.defaultPrinting,
    isEmpty: isEmptyCube,
    boards,
  });
  // eslint-disable-next-line react/refs
  paramsRef.current = {
    cubeId: cube.id,
    filterText: filterInput,
    printingPreference: cube.defaultPrinting,
    isEmpty: isEmptyCube,
    boards,
  };

  // Resolve the page the user asked for: serve it from the window cache when it
  // is there, otherwise fetch the one window that contains it. Random access —
  // no page before it is fetched, and the server's total comes back with it.
  const loadPage = useCallback(
    async (requestedPage: number): Promise<void> => {
      const generation = generationRef.current;
      const requestId = (requestRef.current += 1);
      // A newer search or a newer navigation has taken over; this fetch must not commit.
      const isStale = () => generationRef.current !== generation || requestRef.current !== requestId;

      let targetPage = requestedPage;

      // One pass per fetch. A second pass only happens when the server's total
      // shrank and the requested page no longer exists, which retargets at the
      // last page that does.
      for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
        const { cubeId, filterText, printingPreference, isEmpty, boards: boardKeys } = paramsRef.current;
        // Empty-cube search is already one request per display page, so its cache
        // key is the page itself and the whole response is the page.
        const key = isEmpty ? targetPage : Math.floor(targetPage / PAGES_PER_WINDOW);
        const offset = isEmpty ? 0 : (targetPage % PAGES_PER_WINDOW) * PAGE_SIZE;

        const cached = cacheRef.current.get(key);
        if (cached) {
          setPageCards(cached.slice(offset, offset + PAGE_SIZE));
          setErrorState('none');
          setLoadingMore(false);
          return;
        }

        // Nothing honest to show for a page we don't have yet: the spinner takes
        // over rather than leaving the last page's cards under a new page number.
        setPageCards([]);
        setLoadingMore(true);

        let fetched: CardType[];
        let serverTotal: number;

        try {
          if (isEmpty) {
            // Empty cube: fall back to plain card search sorted by Elo. The search
            // endpoint pages at PAGE_SIZE and takes the page number directly, and
            // returns full details, so no windowing and no per-id lookup.
            const params = new URLSearchParams({
              p: targetPage.toString(),
              f: filterText ?? '',
              s: 'Elo',
              d: 'descending',
              di: 'names',
            });
            const searchRes = await fetch(`/tool/api/searchcards/?${params.toString()}`);
            const searchJson = await searchRes.json().catch(() => ({}));
            if (isStale()) return;
            if (!searchRes.ok) {
              setErrorState('generic');
              setLoadingMore(false);
              return;
            }
            fetched = ((searchJson.data || []) as CardDetails[]).map((details) => detailsToCard(details));
            serverTotal = Number(searchJson.numResults ?? 0);
          } else {
            const res = await csrfFetch('/cube/api/adds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cubeID: cubeId,
                skip: key * FETCH_LIMIT,
                limit: FETCH_LIMIT,
                filterText,
                printingPreference,
                boards: boardKeys,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (isStale()) return;

            // Every response carries a total, including the failures, where it is
            // 0 — so the status decides whether this is an error, never the total.
            if (!res.ok) {
              // 503 with mlUnavailable means the recommender is down; anything
              // else is a generic failure.
              if (json?.mlUnavailable) setErrorState('ml-unavailable');
              else setErrorState('generic');
              setLoadingMore(false);
              return;
            }

            const cardIDs: string[] = json.cardIDs || [];
            const detailsById = cardIDs.length > 0 ? await getCardDetails(cardIDs) : {};
            if (isStale()) return;

            fetched = cardIDs
              .map((id) => detailsById[id])
              .filter((d): d is NonNullable<typeof d> => !!d)
              .map((details) => detailsToCard(details));
            // The recommender's count of eligible adds before pagination. Ids that
            // fail to resolve here shorten the window, never the count of results.
            serverTotal = Number(json.totalAdds ?? 0);
          }
        } catch {
          if (!isStale()) {
            setErrorState('generic');
            setLoadingMore(false);
          }
          return;
        }

        if (totalRef.current !== serverTotal) {
          cacheRef.current.clear();
          totalRef.current = serverTotal;
        }
        cacheRef.current.set(key, fetched);
        setTotal(serverTotal);

        // The total can shrink between requests (the cube or the catalog changed
        // under us). Land on the last page that exists rather than on an empty one.
        const lastPage = Math.max(0, Math.ceil(serverTotal / PAGE_SIZE) - 1);
        if (targetPage > lastPage) {
          targetPage = lastPage;
          setPage(lastPage);
          continue;
        }

        setPageCards(fetched.slice(offset, offset + PAGE_SIZE));
        setErrorState('none');
        setLoadingMore(false);
        return;
      }

      if (!isStale()) setLoadingMore(false);
    },
    [csrfFetch],
  );

  // New search: reset everything and load the first page. Bumping the
  // generation cancels any in-flight fetch from the previous search and
  // invalidates its cached windows.
  useEffect(() => {
    generationRef.current += 1;
    cacheRef.current = new Map();
    totalRef.current = 0;

    setPageCards([]);
    setTotal(0);
    setErrorState('none');
    setLoadingMore(false);
    setPage(0);

    if (filterInput && filterInput.trim().length > 0) {
      loadPage(0);
    }
  }, [filterInput, cube.id, cube.defaultPrinting, isEmptyCube, boardsKey, loadPage]);

  const goToPage = useCallback(
    (newPage: number) => {
      setPage(newPage);
      // Fetches only if the window holding this page isn't cached.
      loadPage(newPage);
    },
    [loadPage],
  );

  const noFilter = !filterInput || filterInput.trim().length === 0;
  // The server's total, never pages fetched so far: every page it counts is
  // reachable in one request.
  const pageCount = Math.ceil(total / PAGE_SIZE);
  // Spinner shows while we're fetching the page being viewed. A page served
  // from the window cache renders instantly (loadingMore never goes true).
  const showSpinner = loadingMore && pageCards.length === 0;

  let body: React.ReactNode;
  if (noFilter) {
    body = (
      <CardBody>
        <Flexbox direction="col" gap="3" alignItems="start" justify="start">
          <Text lg semibold>
            Enter a search filter
          </Text>
          <Text sm className="text-text-secondary">
            Smart Search ranks the cards matching your filter by how well they fit this cube. Type a filter above to see
            suggestions.
          </Text>
        </Flexbox>
      </CardBody>
    );
  } else if (showSpinner) {
    body = (
      <div className="centered m-4">
        <Spinner xl />
      </div>
    );
  } else if (pageCards.length > 0) {
    body = (
      <Flexbox direction="col" gap="2" className="mt-2">
        <Flexbox direction="row" justify="between" wrap="wrap" alignItems="center">
          <Text lg semibold className="whitespace-nowrap">
            <ResponsiveDiv md>
              {isEmptyCube
                ? `Elo-sorted results for the query: ${filterInput}`
                : `Smart-sorted results for the query: ${filterInput}`}
            </ResponsiveDiv>
          </Text>
          <Pagination count={pageCount} active={page} onClick={goToPage} loading={loadingMore} />
        </Flexbox>
        <CardGrid
          cards={pageCards}
          xs={2}
          sm={3}
          md={4}
          lg={5}
          xl={6}
          xxl={8}
          cardProps={{ autocard: true, className: 'clickable' }}
          onClick={(card) => setModalCard(card)}
          cubeTrayDraggable
        />
        <Flexbox direction="row" justify="end">
          <Pagination count={pageCount} active={page} onClick={goToPage} loading={loadingMore} />
        </Flexbox>
      </Flexbox>
    );
  } else if (errorState === 'ml-unavailable') {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              Recommender unavailable
            </Text>
            <Text sm className="text-text-secondary">
              The card recommender is temporarily unavailable, so we can't rank Smart Search results right now. Please
              try again in a moment.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  } else if (errorState === 'generic') {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              Something went wrong
            </Text>
            <Text sm className="text-text-secondary">
              We couldn't fetch Smart Search results. Please try again.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  } else {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              No results
            </Text>
            <Text sm className="text-text-secondary">
              No cards match this filter. Try a different one.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  }

  return (
    <CubeTrayProvider>
      <div className="p-2">
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
            <Text xl semibold>
              Smart Search
            </Text>
            <AnalysisBoardPicker />
          </Flexbox>
          <Text>
            {isEmptyCube
              ? `${boardsKey === 'mainboard' ? 'This cube has' : 'The selected boards have'} no cards yet, so there’s nothing to tailor recommendations to — Smart Search runs your filter against the full card pool sorted by Elo. Enter a search filter to begin.`
              : 'Smart Search is card search with a context-aware sort. It runs your filter against the full card pool and then ranks the results by how well each card fits this specific cube — surfacing relevant additions that a plain alphabetical search would bury. Enter a search filter to begin.'}
          </Text>
          <FilterCollapse isOpen buttonLabel="Search" />
        </Flexbox>

        {body}

        {modalCard && (
          <AddToCubeModal
            card={modalCard}
            isOpen={modalCard !== null}
            setOpen={(open) => {
              if (!open) setModalCard(null);
            }}
            cubeContext={cube.id}
          />
        )}
        <CubeTray leftClassName={trayLeftClassName} />
      </div>
    </CubeTrayProvider>
  );
};

export default Suggestions;
