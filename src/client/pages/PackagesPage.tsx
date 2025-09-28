import React, { useCallback, useContext, useState } from 'react';

import Banner from 'components/Banner';
import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import Controls from 'components/base/Controls';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import CreatePackageModal from 'components/modals/CreatePackageModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

import CardPackageData, { CardPackageStatus } from '../../datatypes/CardPackage';

const CreatePackageModalLink = withModal(Button, CreatePackageModal);

interface PackagesPageProps {
  items: CardPackageData[];
  lastKey: string | null;
}

const PackagesPage: React.FC<PackagesPageProps> = ({ items, lastKey }) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [type, setType] = useQueryParam('t', CardPackageStatus.APPROVED);
  const [filter, setFilter] = useQueryParam('kw', '');
  const [sort, setSort] = useQueryParam('s', 'votes');
  const [ascending, setAscending] = useQueryParam('a', 'false');

  const [alerts, setAlerts] = useState<{ color: string; message: string }[]>([]);
  const [packages, setPackages] = useState<CardPackageData[]>(items);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);

  const addAlert = (color: string, message: string) => {
    setAlerts([...alerts, { color, message }]);
  };

  const getData = useCallback(
    async (t: string | null, f: string | null, s: string | null, a: string | null, key: any) => {
      const response = await csrfFetch('/packages/getmore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: t,
          keywords: f,
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
    const result = await getData(type, filter, sort, ascending, currentLastKey);

    setPackages([...packages, ...result.packages]);
    setLastKey(result.lastKey);
    setLoading(false);
  }, [getData, type, filter, sort, ascending, currentLastKey, packages]);

  const getNewData = useCallback(
    async (t: string | null, f: string | null, s: string | null, a: string | null) => {
      setLoading(true);
      setPackages([]);
      const result = await getData(t, f, s, a, null);

      setPackages(result.packages);
      setLastKey(result.lastKey);
      setLoading(false);
    },
    [getData],
  );

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
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
            <Flexbox direction="row" gap="2">
              <Input
                type="text"
                placeholder="Search for keywords or packages that include a card..."
                value={filter || ''}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    getNewData(type, filter, sort, ascending);
                  }
                }}
                className="flex-grow"
              />
              <Button
                color="primary"
                onClick={async () => {
                  await getNewData(type, filter, sort, ascending);
                }}
              >
                <span className="px-4">Apply</span>
              </Button>
            </Flexbox>
            <Row>
              <Col sm={4}>
                <Select
                  label="Type"
                  options={[
                    { value: 'a', label: 'Approved' },
                    { value: 's', label: 'Submitted' },
                    { value: 'u', label: 'Your Packages' },
                  ]}
                  value={type || 'approved'}
                  setValue={async (value) => {
                    setType(value);
                    await getNewData(value, filter, sort, ascending);
                  }}
                  className="mt-1"
                />
              </Col>
              <Col sm={4}>
                <Select
                  label="Sort By"
                  options={[
                    { value: 'votes', label: 'Votes' },
                    { value: 'date', label: 'Date' },
                  ]}
                  value={sort || 'votes'}
                  setValue={async (value) => {
                    setSort(value);
                    await getNewData(type, filter, value, ascending);
                  }}
                  className="mt-1"
                />
              </Col>
              <Col sm={4}>
                <Select
                  label="Direction"
                  options={[
                    { value: 'true', label: 'Ascending' },
                    { value: 'false', label: 'Descending' },
                  ]}
                  value={ascending || 'false'}
                  setValue={async (value) => {
                    setAscending(value);
                    await getNewData(type, filter, sort, value);
                  }}
                  className="mt-1"
                />
              </Col>
            </Row>
          </Flexbox>
        </Controls>
        {user && (
          <Flexbox direction="row" justify="end">
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
            {packages.map((pack) => (
              <CardPackage key={pack.id} cardPackage={pack} />
            ))}
            {loading && loader}
            {!loading && currentLastKey && (
              <Button color="primary" onClick={fetchMoreData}>
                Load More
              </Button>
            )}
          </Flexbox>
        )}
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(PackagesPage);
