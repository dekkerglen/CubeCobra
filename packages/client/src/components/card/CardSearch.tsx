import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { DownloadIcon, GearIcon, QuestionIcon } from '@primer/octicons-react';
import { cardElo, cardId, detailsToCard } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import { allFields, CardDetails, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';
import { filterToReadableString } from '@utils/filtering/FilterCards';
import { ORDERED_SORTS } from '@utils/sorting/Sort';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Paginate from 'components/base/Pagination';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import useCubeTrayDrag from 'components/cubetray/useCubeTrayDrag';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import AdvancedFilterModal from 'components/modals/AdvancedFilterModal';
import SideBanner from 'components/SideBanner';
import withAutocard from 'components/WithAutocard';
import FilterContext from 'contexts/FilterContext';
import Query from 'utils/Query';

const AutocardA = withAutocard(Link);

type ViewMode = 'cards' | 'rows';
type DistinctMode = 'names' | 'printings';
type SortDirection = 'ascending' | 'descending';

const DISTINCT_OPTIONS: { value: DistinctMode; label: string }[] = [
  { value: 'names', label: 'Cards' },
  { value: 'printings', label: 'Printings' },
];

const DIRECTION_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: 'ascending', label: 'Ascending' },
  { value: 'descending', label: 'Descending' },
];

const DEFAULT_SORT = 'Elo';

// A <select> whose value matches none of its options silently displays the first one, so an
// unrecognized query param would leave a control disagreeing with the results on screen (the
// sets page used to link with the singular "printing"). Clamp every param to a real option,
// matching how the search API reads it: anything but "names" is printings, and anything but
// "descending" is ascending.
const toDistinct = (value: string): DistinctMode => (value === 'names' ? 'names' : 'printings');
const toDirection = (value: string): SortDirection => (value === 'descending' ? 'descending' : 'ascending');
const toSort = (value: string): string => (ORDERED_SORTS.includes(value) ? value : DEFAULT_SORT);
// The api accepts both spellings of the flag, so links using its "1"/"0" form must work here too.
const toIncludeExtras = (value: string): boolean => value === 'true' || value === '1';
const toPage = (value: string): number => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const PICK_COUNT_BASELINE = 'pickcount>=100';

const CardSearch: React.FC = () => {
  const { filterInput, setFilterInput, filterValid, cardFilter } = useContext(FilterContext);
  const drag = useCubeTrayDrag();
  const [cards, setCards] = useState<CardDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(toPage(Query.get('p', '0')));
  const [count, setCount] = useState('');
  const [distinct, setDistinct] = useState<DistinctMode>(toDistinct(Query.get('di', 'names')));
  const [includeExtras, setIncludeExtras] = useState(toIncludeExtras(Query.get('ie', 'false')));
  const [sort, setSort] = useState(toSort(Query.get('s', DEFAULT_SORT)));
  const [direction, setDirection] = useState<SortDirection>(toDirection(Query.get('d', 'descending')));
  const [view, setView] = useState<ViewMode>((Query.get('v', 'cards') as ViewMode) === 'rows' ? 'rows' : 'cards');

  const [filterText, setFilterText] = useState(filterInput || '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<Partial<FilterValues>>({});
  const [controlsOpen, setControlsOpen] = useState(false);
  const latestRequest = useRef(0);
  const didMountRef = useRef(false);

  // The url has to track the controls on its own rather than as a side effect of searching:
  // in card view with no filter nothing is fetched, so the chosen options would otherwise be
  // dropped on reload. Values left at their default are removed to keep shared links short.
  // The filter itself is owned by FilterContext, which writes "f".
  useEffect(() => {
    const sync = (key: string, value: string, defaultValue: string) => {
      if (value === defaultValue) {
        Query.del(key);
      } else {
        Query.set(key, value);
      }
    };

    sync('p', page.toString(), '0');
    sync('s', sort, DEFAULT_SORT);
    sync('d', direction, 'descending');
    sync('di', distinct, 'names');
    sync('ie', includeExtras ? 'true' : 'false', 'false');
    sync('v', view, 'cards');
  }, [page, sort, direction, distinct, includeExtras, view]);

  useEffect(() => {
    setFilterText(filterInput || '');
  }, [filterInput]);

  const effectiveFilter = useCallback(() => {
    const user = filterInput?.trim() ?? '';
    if (view === 'rows') {
      return user ? `${PICK_COUNT_BASELINE} ${user}` : PICK_COUNT_BASELINE;
    }
    return user;
  }, [filterInput, view]);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams([
      ['p', page.toString()],
      ['f', effectiveFilter()],
      ['s', sort],
      ['d', direction],
      ['di', distinct],
      ['ie', includeExtras ? '1' : '0'],
    ]);

    const requestId = (latestRequest.current += 1);
    const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
    if (!response.ok) console.error(response);

    const json = await response.json();

    // A slower earlier request must not overwrite the results of the one the controls now
    // describe; options changed while a search is in flight would otherwise be undone by
    // whichever response happens to land last.
    if (requestId !== latestRequest.current) {
      return;
    }

    setCards(json.data);
    setCount(json.numResults.toString());
    setLoading(false);
  }, [page, sort, direction, distinct, includeExtras, effectiveFilter]);

  useEffect(() => {
    const shouldFetch = view === 'rows' || (!!filterInput && filterInput !== '');
    if (shouldFetch) {
      setLoading(true);
      fetchData();
    } else {
      // Clearing the filter has to invalidate anything still in flight, or its response would
      // repopulate the grid after the results were cleared.
      latestRequest.current += 1;
      setLoading(false);
      setCards([]);
    }
  }, [page, direction, distinct, includeExtras, sort, filterInput, view, fetchData]);

  // Anything that changes which cards match invalidates the current page, so go back to the
  // first one. The mount run is skipped so a shared link's "p" survives the first render.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setPage(0);
  }, [filterInput, view, includeExtras, distinct]);

  const updatePage = (index: number) => {
    setLoading(true);
    setPage(index);
  };

  const applyAdvanced = useCallback(() => {
    const tokens: string[] = [];
    for (const name of allFields) {
      if (advancedValues[name]) {
        if (isColorField(name)) {
          const op = advancedValues[`${name}Op`] || '=';
          if (advancedValues[name] && (advancedValues[name] as string[]).length > 0) {
            tokens.push(`${name}${op}${(advancedValues[name] as string[]).join('')}`);
          }
        } else {
          const op = isNumField(name) ? advancedValues[`${name}Op`] || '=' : ':';
          let value = (advancedValues[name] as string).replace(/"/g, '\\"');
          if (value.indexOf(' ') > -1) value = `"${value}"`;
          tokens.push(`${name}${op}${value}`);
        }
      }
    }
    const filterString = tokens.join(' ');
    setFilterText(filterString);
    setFilterInput(filterString);
    setAdvancedOpen(false);
  }, [advancedValues, setFilterInput]);

  const updateAdvancedValue = useCallback(
    (value: string | string[], name: keyof FilterValues) => {
      setAdvancedValues({ ...advancedValues, [name]: value as any });
    },
    [advancedValues],
  );

  const pageCount = Math.ceil(parseInt(count || '0', 10) / 96);
  // Top pager sits on the dark splash; bottom pager sits past the splash on
  // the regular page bg. Pass inverted only for the top one.
  const topPager = <Paginate count={pageCount} active={page} onClick={(i: number) => updatePage(i)} inverted />;
  const bottomPager = <Paginate count={pageCount} active={page} onClick={(i: number) => updatePage(i)} />;

  // Downloads every result matching the current query (not just the visible
  // page) as CSV. Mirrors the params sent to the search API so the file matches
  // what the user is looking at.
  const csvHref = `/tool/searchcards/csv?${new URLSearchParams([
    ['f', effectiveFilter()],
    ['s', sort],
    ['d', direction],
    ['di', distinct],
    ['ie', includeExtras ? '1' : '0'],
  ]).toString()}`;

  const tableHeaders = ['Name', 'Cost', 'Type', 'Elo', 'Total Picks', 'Cube Count'];
  const tableHeaderTooltips = {
    Elo: "A card's draft rating, calculated like chess Elo: every time a card is picked over another card in the same pack, it 'wins' against each card left behind and its rating rises while theirs falls, weighted by the gap between their ratings. Cards start at 1200.",
  };
  const tableRows = cards.map((card) => ({
    Name: (
      <AutocardA href={`/tool/card/${card.scryfall_id}`} card={detailsToCard(card)}>
        {card.name}
      </AutocardA>
    ),
    Cost: (
      <span className="inline-flex items-center">
        {(card.parsed_cost ?? [])
          .slice(0)
          .reverse()
          .map((symbol, index) => (
            <img
              key={`mana-symbol-${index}`}
              alt={symbol}
              className="mana-symbol-sm"
              src={cdnUrl(`/content/symbols/${symbol}.png`)}
            />
          ))}
      </span>
    ),
    Type: card.type,
    Elo: card.elo === null ? '' : Math.round(cardElo(detailsToCard(card))).toLocaleString(),
    'Total Picks': card.pickCount === null ? '' : Number(card.pickCount).toLocaleString(),
    'Cube Count': card.cubeCount === null ? '' : Number(card.cubeCount).toLocaleString(),
  }));

  // Make each table row a cube-tray drag source (mirrors the grid view).
  const getRowProps = drag.active
    ? (rowIndex: number) => ({
        className: 'cursor-grab active:cursor-grabbing',
        onPointerDown: (e: React.PointerEvent<HTMLTableRowElement>) => drag.start(detailsToCard(cards[rowIndex]), e),
        onDragStart: (e: React.DragEvent<HTMLTableRowElement>) => e.preventDefault(),
        // Capture so a drag's trailing click doesn't follow the Name link.
        onClickCapture: (e: React.MouseEvent<HTMLTableRowElement>) => {
          if (drag.suppressClick()) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
      })
    : undefined;

  const emptyMessage = view === 'cards' && !filterInput ? 'Enter a filter above to begin searching.' : 'No cards found';
  const formattedCount = Number(count || '0').toLocaleString();
  const showSummary = !(view === 'cards' && !filterInput);
  const headlineCount = loading ? 'Searching…' : `${formattedCount} results`;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0 top-0 h-screen overflow-hidden bg-bg-secondary pointer-events-none z-0">
        <img
          src={cdnUrl('/content/retrocobra.webp')}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover object-top select-none"
        />
        <div className="absolute inset-0 bg-bg-secondary/80" />
        {cards.length > 0 && (
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
        <div className="px-4 pt-28 md:pt-36">
          <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-5">
            <div>
              <Text xxxxl bold className="!text-button-text block">
                Search Cards
              </Text>
              <p className="mt-1 text-sm text-button-text/80">
                Find any Magic card. Toggle between card images and an info table.
              </p>
            </div>

            <form
              action="#"
              onSubmit={(e) => {
                e.preventDefault();
                setFilterInput(filterText);
              }}
              className="w-full"
            >
              <Flexbox direction="row" alignItems="center" gap="2" className="w-full">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(true)}
                  aria-label="Advanced filters"
                  className="text-button-text/80 hover:text-button-text cursor-pointer p-1 inline-flex items-center"
                >
                  <QuestionIcon size={20} />
                </button>
                <Input
                  placeholder='Filter cards: e.g. name:"Ambush Viper"'
                  value={filterText}
                  valid={(filterInput?.length ?? 0) > 0 ? filterValid : undefined}
                  onChange={(event) => setFilterText(event.target.value)}
                  onEnter={() => setFilterInput(filterText)}
                  className="!bg-white !text-gray-800 !placeholder-gray-500 !border-gray-300"
                  otherInputProps={{ enterKeyHint: 'search', name: 'f' }}
                />
                {/* Hidden submit so mobile virtual keyboards' "Go"/"Search" key submits the form */}
                <button type="submit" aria-hidden="true" tabIndex={-1} className="hidden" />
                <button
                  type="button"
                  onClick={() => setControlsOpen(true)}
                  aria-label="Display options"
                  className="md:hidden text-button-text/80 hover:text-button-text cursor-pointer p-1 inline-flex items-center"
                >
                  <GearIcon size={20} />
                </button>
                <div className="hidden md:block">
                  <LoadingButton color="primary" onClick={() => setFilterInput(filterText)}>
                    <span className="px-3">Search</span>
                  </LoadingButton>
                </div>
              </Flexbox>
            </form>
          </div>
        </div>

        <AdvancedFilterModal
          isOpen={advancedOpen}
          setOpen={setAdvancedOpen}
          apply={applyAdvanced}
          values={advancedValues}
          updateValue={updateAdvancedValue}
        />

        <Modal isOpen={controlsOpen} setOpen={setControlsOpen} sm>
          <ModalHeader setOpen={setControlsOpen}>Display Options</ModalHeader>
          <ModalBody>
            <Flexbox direction="col" gap="3">
              <Select
                label="Distinct"
                options={DISTINCT_OPTIONS}
                value={distinct}
                setValue={(value) => {
                  setLoading(true);
                  setDistinct(toDistinct(value));
                }}
              />
              <Select
                label="View"
                options={[
                  { value: 'cards', label: 'Card Images' },
                  { value: 'rows', label: 'Info Rows' },
                ]}
                value={view}
                setValue={(value) => {
                  setLoading(true);
                  setView(value as ViewMode);
                }}
              />
              <Select
                label="Sort"
                options={ORDERED_SORTS.map((s) => ({ value: s, label: s }))}
                value={sort}
                setValue={(value) => {
                  setLoading(true);
                  setSort(toSort(value));
                }}
              />
              <Select
                label="Direction"
                options={DIRECTION_OPTIONS}
                value={direction}
                setValue={(value) => {
                  setLoading(true);
                  setDirection(toDirection(value));
                }}
              />
              <Checkbox
                label="Include extras (tokens, art cards, etc.)"
                checked={includeExtras}
                setChecked={(value) => {
                  setLoading(true);
                  setIncludeExtras(value);
                }}
              />
            </Flexbox>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={() => setControlsOpen(false)} block>
              Done
            </Button>
          </ModalFooter>
        </Modal>

        <Container xxxl className="pb-6">
          <Flexbox direction="row" gap="4">
            <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
              <SideBanner placementId="left-rail" />
            </ResponsiveDiv>
            <div className="flex-grow px-2 max-w-full min-w-0">
              <Flexbox direction="col" gap="3" className="pt-3 md:pt-4 pb-3">
                <Flexbox
                  direction="row"
                  alignItems="center"
                  justify="center"
                  gap="2"
                  wrap="wrap"
                  className="hidden md:flex lg:flex-nowrap"
                >
                  <div className="w-28">
                    <Select
                      dense
                      options={DISTINCT_OPTIONS}
                      value={distinct}
                      setValue={(value) => {
                        setLoading(true);
                        setDistinct(toDistinct(value));
                      }}
                    />
                  </div>
                  <span className="text-sm text-button-text/80">as</span>
                  <div className="w-24">
                    <Select
                      dense
                      options={[
                        { value: 'cards', label: 'Images' },
                        { value: 'rows', label: 'Rows' },
                      ]}
                      value={view}
                      setValue={(value) => {
                        setLoading(true);
                        setView(value as ViewMode);
                      }}
                    />
                  </div>
                  <span className="text-sm text-button-text/80 whitespace-nowrap">sorted by</span>
                  <div className="w-36">
                    <Select
                      dense
                      options={ORDERED_SORTS.map((s) => ({ value: s, label: s }))}
                      value={sort}
                      setValue={(value) => {
                        setLoading(true);
                        setSort(toSort(value));
                      }}
                    />
                  </div>
                  <span className="text-sm text-button-text/80">:</span>
                  <div className="w-32">
                    <Select
                      dense
                      options={DIRECTION_OPTIONS}
                      value={direction}
                      setValue={(value) => {
                        setLoading(true);
                        setDirection(toDirection(value));
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm text-button-text/80 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-primary-button"
                      checked={includeExtras}
                      onChange={(e) => {
                        setLoading(true);
                        setIncludeExtras(e.target.checked);
                      }}
                    />
                    Include extras
                  </label>
                </Flexbox>

                {showSummary && (
                  <Flexbox direction="row" alignItems="center" justify="between" gap="3" wrap="wrap" className="w-full">
                    <Flexbox direction="col" gap="1" alignItems="start" className="text-left min-w-0">
                      <Text lg semibold className="!text-button-text">
                        {headlineCount}
                      </Text>
                      {filterInput && filterValid && (
                        <Text sm semibold italic className="!text-button-text/80 break-words">
                          {filterToReadableString(cardFilter.filter)}
                        </Text>
                      )}
                    </Flexbox>
                    {cards.length > 0 && (
                      <Flexbox direction="row" alignItems="center" gap="3" wrap="wrap">
                        <a
                          href={csvHref}
                          download
                          className="inline-flex items-center gap-1 text-sm font-semibold text-button-text/90 hover:text-button-text underline-offset-2 hover:underline whitespace-nowrap"
                        >
                          <DownloadIcon size={16} />
                          Download CSV
                        </a>
                        {topPager}
                      </Flexbox>
                    )}
                  </Flexbox>
                )}
              </Flexbox>

              <Banner />
              <DynamicFlash />
              <Flexbox direction="col" gap="3" className="mt-3">
                {cards && cards.length > 0 ? (
                  <Flexbox direction="col" gap="2">
                    {loading ? (
                      <div className="centered m-4">
                        <Spinner xl />
                      </div>
                    ) : view === 'rows' ? (
                      <Table
                        headers={tableHeaders}
                        headerTooltips={tableHeaderTooltips}
                        rows={tableRows}
                        hideOnMobile={['Cost', 'Type']}
                        getRowProps={getRowProps}
                      />
                    ) : (
                      <CardGrid
                        cards={cards.map(detailsToCard)}
                        xs={2}
                        sm={3}
                        md={4}
                        lg={5}
                        xl={6}
                        xxl={8}
                        cardProps={{ autocard: true, className: 'clickable' }}
                        hrefFn={(card) => `/tool/card/${cardId(card)}`}
                        cubeTrayDraggable
                      />
                    )}
                    <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2">
                      {bottomPager}
                    </Flexbox>
                  </Flexbox>
                ) : (
                  <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2 py-12">
                    {loading ? (
                      <Spinner xl />
                    ) : (
                      <Text semibold lg className="!text-button-text">
                        {emptyMessage}
                      </Text>
                    )}
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
  );
};

export default CardSearch;
