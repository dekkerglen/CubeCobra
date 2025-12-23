import React, { useCallback, useContext, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import CardPackageData from '@utils/datatypes/CardPackage';

import Banner from 'components/Banner';
import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import Controls from 'components/base/Controls';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import CreatePackageModal from 'components/modals/CreatePackageModal';
import PackageSearchSyntaxModal from 'components/modals/PackageSearchSyntaxModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

const CreatePackageModalLink = withModal(Button, CreatePackageModal);

const PAGE_SIZE = 36;

interface PackagesPageProps {
  items: CardPackageData[];
  lastKey: string | null;
  parsedQuery?: string[];
}

const PackagesPage: React.FC<PackagesPageProps> = ({ items, lastKey, parsedQuery }) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [query, setQuery] = useQueryParam('q', '');
  const [sort, setSort] = useQueryParam('s', 'votes');
  const [ascending, setAscending] = useQueryParam('a', 'false');

  const [alerts, setAlerts] = useState<{ color: string; message: string }[]>([]);
  const [packages, setPackages] = useState<CardPackageData[]>(items);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [currentParsedQuery, setParsedQuery] = useState<string[]>(parsedQuery || []);
  const [showSyntaxModal, setShowSyntaxModal] = useState(false);

  const pageCount = Math.ceil(packages.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const addAlert = (color: string, message: string) => {
    setAlerts([...alerts, { color, message }]);
  };

  const getData = useCallback(
    async (q: string | null, s: string | null, a: string | null, key: any) => {
      const response = await csrfFetch('/packages/getmore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: q,
          sort: s,
          ascending: a,
          lastKey: key,
        }),
      });

      if (response.ok) {
        return response.json();
      }

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
    if (result.parsedQuery) {
      setParsedQuery(result.parsedQuery);
    }

    const numItemsShowOnLastPage = packages.length % PAGE_SIZE;
    const newItemsShowOnLastPage = newPackages.length % PAGE_SIZE;

    if (numItemsShowOnLastPage === 0 && newItemsShowOnLastPage > 0) {
      setPage(page + 1);
    }

    setLoading(false);
  }, [getData, query, sort, ascending, currentLastKey, packages, page]);

  const getNewData = useCallback(
    async (q: string | null, s: string | null, a: string | null) => {
      setLoading(true);
      setPackages([]);
      setPage(0);
      const result = await getData(q, s, a, null);

      setPackages(result.packages);
      setLastKey(result.lastKey);
      if (result.parsedQuery) {
        setParsedQuery(result.parsedQuery);
      }
      setLoading(false);
    },
    [getData],
  );

  const pager = (
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
    />
  );

  return (
    <MainLayout>
      <Flexbox direction="col" gap="4" className="pb-4">
        <Controls className="p-2">
          <Banner />
          <DynamicFlash />
          {alerts.map(({ color, message }, index) => (
            <Alert color={color} key={index}>
              {message}
            </Alert>
          ))}
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between">
              <Text xl semibold>
                Browse Card Packages
              </Text>
              <ResponsiveDiv sm>
                <Flexbox direction="row" gap="4">
                  <Link href="/tool/topcards">View Top cards</Link>
                  <Link href="/tool/searchcards">Search Cards</Link>
                </Flexbox>
              </ResponsiveDiv>
            </Flexbox>
            <Text sm className="text-text-secondary">
              Search by keywords, or filter packages that include a card using <code>card:cardname</code> syntax
            </Text>
            <Flexbox direction="row" gap="2" alignItems="center">
              <button
                onClick={() => setShowSyntaxModal(true)}
                className="text-green-600 hover:text-green-700 cursor-pointer"
                aria-label="Search syntax help"
              >
                <QuestionIcon size={20} />
              </button>
              <Input
                type="text"
                placeholder='Search for keywords or packages: e.g. "reanimator" or "card:Griselbrand"'
                value={query || ''}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    getNewData(query, sort, ascending);
                  }
                }}
                className="flex-grow"
              />
              <Button
                color="primary"
                onClick={async () => {
                  await getNewData(query, sort, ascending);
                }}
              >
                <span className="px-4">Apply</span>
              </Button>
            </Flexbox>
            {currentParsedQuery.length > 0 && (
              <Flexbox direction="row" justify="start" gap="2" className="w-full">
                <Text sm semibold italic>
                  {currentParsedQuery.join(', ')}
                </Text>
              </Flexbox>
            )}
            <Row>
              <Col sm={6}>
                <Select
                  label="Sort By"
                  options={[
                    { value: 'votes', label: 'Popularity' },
                    { value: 'date', label: 'Date' },
                  ]}
                  value={sort || 'votes'}
                  setValue={async (value) => {
                    setSort(value);
                    await getNewData(query, value, ascending);
                  }}
                  className="mt-1"
                />
              </Col>
              <Col sm={6}>
                <Select
                  label="Direction"
                  options={[
                    { value: 'true', label: 'Ascending' },
                    { value: 'false', label: 'Descending' },
                  ]}
                  value={ascending || 'false'}
                  setValue={async (value) => {
                    setAscending(value);
                    await getNewData(query, sort, value);
                  }}
                  className="mt-1"
                />
              </Col>
            </Row>
          </Flexbox>
        </Controls>
        {user && (
          <Flexbox direction="row" justify="end" gap="2">
            <Button color="primary" type="link" href={`/packages?q=user:${user.username}`}>
              <span className="p-2">Your Packages</span>
            </Button>
            <CreatePackageModalLink
              color="primary"
              modalprops={{
                onError: (message: string) => {
                  addAlert('danger', message);
                },
                onSuccess: (message: string) => {
                  addAlert('success', message);
                },
              }}
            >
              <span className="p-2">Create New Package</span>
            </CreatePackageModalLink>
          </Flexbox>
        )}
        {packages.length === 0 ? (
          <p>No packages found</p>
        ) : (
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Packages Found ({packages.length}
                {hasMore ? '+' : ''})
              </Text>
              {packages.length > 0 && pager}
            </Flexbox>
            {packages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pack) => (
              <CardPackage key={pack.id} cardPackage={pack} />
            ))}
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </Flexbox>
        )}
        <PackageSearchSyntaxModal isOpen={showSyntaxModal} setOpen={setShowSyntaxModal} />
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(PackagesPage);
