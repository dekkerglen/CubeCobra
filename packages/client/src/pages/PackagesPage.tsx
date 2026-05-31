import React, { useCallback, useContext, useEffect, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import CardPackageData from '@utils/datatypes/CardPackage';

import Banner from 'components/Banner';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import PackageSearchSyntaxModal from 'components/modals/PackageSearchSyntaxModal';
import RenderToRoot from 'components/RenderToRoot';
import SideBanner from 'components/SideBanner';
import { CSRFContext } from 'contexts/CSRFContext';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

const PAGE_SIZE = 36;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'votes', label: 'Sorted by Popularity' },
  { value: 'date', label: 'Sorted by Date' },
];

interface PackagesPageProps {
  items: CardPackageData[];
  lastKey: string | null;
  parsedQuery?: string[];
}

const PackagesPage: React.FC<PackagesPageProps> = ({ items, lastKey, parsedQuery }) => {
  const { csrfFetch } = useContext(CSRFContext);

  const [query, setQuery] = useQueryParam('q', '');
  const [sort, setSort] = useQueryParam('s', 'votes');
  const [ascending, setAscending] = useQueryParam('a', 'false');

  const [queryText, setQueryText] = useState(query || '');
  const [sortText, setSortText] = useState(sort || 'votes');
  const [ascendingText, setAscendingText] = useState(ascending || 'false');

  useEffect(() => {
    setQueryText(query || '');
    setSortText(sort || 'votes');
    setAscendingText(ascending || 'false');
  }, [query, sort, ascending]);

  const [packages, setPackages] = useState<CardPackageData[]>(items);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [currentParsedQuery, setParsedQuery] = useState<string[]>(parsedQuery || []);
  const [showSyntaxModal, setShowSyntaxModal] = useState(false);

  const pageCount = Math.ceil(packages.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const getData = useCallback(
    async (q: string | null, s: string | null, a: string | null, key: any) => {
      const response = await csrfFetch('/packages/getmore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sort: s, ascending: a, lastKey: key }),
      });
      if (response.ok) return response.json();
      return {};
    },
    [csrfFetch],
  );

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    const result = await getData(query, sort, ascending, currentLastKey);

    const newPackages = [...packages, ...result.packages];
    setPackages(newPackages);
    setLastKey(result.lastKey);
    if (result.parsedQuery) setParsedQuery(result.parsedQuery);

    const numItemsShowOnLastPage = packages.length % PAGE_SIZE;
    const newItemsShowOnLastPage = newPackages.length % PAGE_SIZE;

    if (numItemsShowOnLastPage === 0 && newItemsShowOnLastPage > 0) {
      setPage(page + 1);
    }
    setLoading(false);
  }, [getData, query, sort, ascending, currentLastKey, packages, page]);

  const getNewData = useCallback(
    async (q: string, s: string, a: string) => {
      setQuery(q);
      setSort(s);
      setAscending(a);
      setLoading(true);
      setPackages([]);
      setPage(0);
      const result = await getData(q, s, a, null);

      setPackages(result.packages);
      setLastKey(result.lastKey);
      if (result.parsedQuery) setParsedQuery(result.parsedQuery);
      setLoading(false);
    },
    [getData, setQuery, setSort, setAscending],
  );

  const renderPager = (inverted: boolean) => (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
      inverted={inverted}
    />
  );

  return (
    <MainLayout useContainer={false} transparentNav>
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
          {packages.length > 0 && (
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
          <div className="px-4 pt-28 pb-10 md:pt-36 md:pb-12">
            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-5">
              <div>
                <Text xxxxl bold className="!text-button-text block">
                  Card Packages
                </Text>
                <p className="mt-1 text-sm text-button-text/80">Browse community-curated packages of cards by theme.</p>
              </div>

              <div className="w-full flex flex-col gap-2">
                <form
                  action="#"
                  onSubmit={(e) => {
                    e.preventDefault();
                    getNewData(queryText, sortText, ascendingText);
                  }}
                >
                  <Flexbox direction="row" alignItems="center" gap="2" className="w-full">
                    <button
                      type="button"
                      onClick={() => setShowSyntaxModal(true)}
                      aria-label="Search syntax"
                      className="text-button-text/80 hover:text-button-text cursor-pointer p-1 inline-flex items-center"
                    >
                      <QuestionIcon size={20} />
                    </button>
                    <Input
                      placeholder='e.g. "reanimator" or card:Griselbrand'
                      value={queryText}
                      onChange={(event) => setQueryText(event.target.value)}
                      onEnter={() => getNewData(queryText, sortText, ascendingText)}
                      className="!bg-white !text-gray-800 !placeholder-gray-500 !border-gray-300"
                      otherInputProps={{ enterKeyHint: 'search', name: 'q' }}
                    />
                    {/* Hidden submit so mobile virtual keyboards' "Go"/"Search" key submits the form */}
                    <button type="submit" aria-hidden="true" tabIndex={-1} className="hidden" />
                    <div className="hidden md:block">
                      <LoadingButton color="primary" onClick={() => getNewData(queryText, sortText, ascendingText)}>
                        <span className="px-3">Search</span>
                      </LoadingButton>
                    </div>
                  </Flexbox>
                </form>

                <Flexbox direction="row" alignItems="center" justify="center" gap="2" wrap="wrap">
                  <div className="w-52">
                    <Select dense options={SORT_OPTIONS} value={sortText} setValue={(value) => setSortText(value)} />
                  </div>
                  <div className="w-36">
                    <Select
                      dense
                      options={[
                        { value: 'true', label: 'Ascending' },
                        { value: 'false', label: 'Descending' },
                      ]}
                      value={ascendingText}
                      setValue={(value) => setAscendingText(value)}
                    />
                  </div>
                </Flexbox>
              </div>
            </div>
          </div>

          <PackageSearchSyntaxModal isOpen={showSyntaxModal} setOpen={setShowSyntaxModal} />

          <Container xxxl className="pb-6">
            <Flexbox direction="row" gap="4">
              <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
                <SideBanner placementId="left-rail" />
              </ResponsiveDiv>
              <div className="flex-grow px-2 max-w-full min-w-0">
                <Flexbox direction="col" gap="3" className="pt-3 md:pt-4 pb-3">
                  <Flexbox direction="row" alignItems="center" justify="between" gap="3" wrap="wrap" className="w-full">
                    <Flexbox direction="col" gap="1" alignItems="start" className="text-left min-w-0">
                      <Text lg semibold className="!text-button-text">
                        {loading
                          ? 'Searching…'
                          : `${packages.length.toLocaleString()}${hasMore ? '+' : ''} packages found`}
                      </Text>
                      {currentParsedQuery.length > 0 && (
                        <Text sm semibold italic className="!text-button-text/80 break-all">
                          {currentParsedQuery.join(', ')}
                        </Text>
                      )}
                    </Flexbox>
                    {packages.length > 0 && renderPager(true)}
                  </Flexbox>
                </Flexbox>
                <DynamicFlash />
                <Banner />
                <Flexbox direction="col" gap="3" className="mt-3">
                  {packages.length > 0 ? (
                    <Flexbox direction="col" gap="2">
                      {packages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pack) => (
                        <CardPackage key={pack.id} cardPackage={pack} />
                      ))}
                      <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2">
                        {renderPager(false)}
                      </Flexbox>
                    </Flexbox>
                  ) : (
                    <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2 py-12">
                      {loading ? (
                        <Spinner xl />
                      ) : (
                        <Text semibold lg className="!text-button-text">
                          No Results
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
    </MainLayout>
  );
};

export default RenderToRoot(PackagesPage);
