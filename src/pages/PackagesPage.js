import React, { useState, useContext, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  Spinner,
  Card,
  CardBody,
  Row,
  Col,
  Nav,
  UncontrolledAlert,
  Button,
  InputGroup,
  InputGroupText,
  Input,
  NavItem,
  NavLink,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

import UserContext from 'contexts/UserContext';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import InfiniteScroll from 'react-infinite-scroll-component';
import Banner from 'components/Banner';
import CreatePackageModal from 'components/CreatePackageModal';
import withModal from 'components/WithModal';
import CardPackage from 'components/CardPackage';

const CreatePackageModalLink = withModal(Button, CreatePackageModal);

const apis = {
  approved: '/packages/getmoreapproved',
  submitted: '/packages/getmoresubmitted',
  user: '/packages/getmoreuser',
};

const defaultSort = {
  approved: 'votes',
  submitted: 'date',
  user: 'date',
};

const defaultSortDirection = {
  approved: '-1',
  submitted: '-1',
  user: '-1',
};

function PackagesPage({ loginCallback, items, lastKey, activePage }) {
  const user = useContext(UserContext);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [sort, setSort] = useState(defaultSort[activePage]);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection[activePage]);
  const [packages, setPackages] = useState(items);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);

  const addAlert = (color, message) => {
    setAlerts([...alerts, { color, message }]);
  };

  const getData = useCallback(
    async (key, activeFilter, activeSort, direction) => {
      const post = activeFilter.length > 0 ? `/${activeFilter}` : '';
      const response = await csrfFetch(apis[activePage], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: post,
          lastKey: key,
          ascending: direction === '1',
          sort: activeSort,
        }),
      });

      if (response.ok) {
        return response.json();
      }

      return {};
    },
    [activePage],
  );

  const fetchMoreData = useCallback(async () => {
    const result = await getData(currentLastKey, filter, sort, sortDirection);

    setPackages([...packages, ...result.packages]);
    setLastKey(result.lastKey);
  }, [getData, currentLastKey, filter, sort, sortDirection, packages]);

  const updateSort = useCallback(
    async (newSort) => {
      if (newSort !== sort) {
        setLoading(true);
        setSort(newSort);

        const result = await getData(null, filter, newSort, sortDirection);

        setPackages(result.packages);
        setLastKey(result.lastKey);
        setLoading(false);
      }
    },
    [sort, getData, filter, sortDirection],
  );

  const updateDirection = useCallback(
    async (newDirection) => {
      if (newDirection !== sortDirection) {
        setLoading(true);
        setSortDirection(newDirection);

        const result = await getData(null, sort, filter, newDirection);

        setPackages(result.packages);
        setLastKey(result.lastKey);
        setLoading(false);
      }
    },
    [sortDirection, getData, sort, filter],
  );

  const updateFilter = useCallback(
    async (newFilter) => {
      if (newFilter !== filter) {
        setLoading(true);
        setFilter(newFilter);

        const result = await getData(null, newFilter, sort, sortDirection);

        setPackages(result.packages);
        setLastKey(result.lastKey);
        setLoading(false);
      }
    },
    [filter, getData, sort, sortDirection],
  );

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      {alerts.map(({ color, message }, index) => (
        <UncontrolledAlert color={color} key={/* eslint-disable-line react/no-array-index-key */ index}>
          {message}
        </UncontrolledAlert>
      ))}
      <Card>
        <div className="usercontrols pt-3 mb-3">
          <Row className="pb-3 me-1">
            <Col xs="6">
              <h3 className="mx-3">Browse Card Packages</h3>
            </Col>
            {user && (
              <Col xs="6">
                <div className="text-end">
                  <CreatePackageModalLink
                    outline
                    color="accent"
                    modalProps={{
                      onError: (message) => {
                        addAlert('danger', message);
                      },
                      onSuccess: (message) => {
                        addAlert('success', message);
                      },
                    }}
                  >
                    Create New Package
                  </CreatePackageModalLink>
                </div>
              </Col>
            )}
          </Row>
          <InputGroup className="mb-3 px-3">
            <InputGroupText htmlFor="filterInput">Keywords</InputGroupText>
            <Input
              type="text"
              placeholder="Search for keywords or packages that include a card..."
              valid={filterTemp !== filter}
              value={filterTemp}
              onChange={(e) => setFilterTemp(e.target.value)}
              onKeyDown={(e) => e.keyCode === 13 && updateFilter(filterTemp)}
            />
            <Button color="accent" className="square-left" onClick={() => updateFilter(filterTemp)}>
              Apply
            </Button>
          </InputGroup>
          <Row className="px-3">
            <Col xs={12} sm={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Sort: </InputGroupText>
                <Input type="select" value={sort} onChange={(event) => updateSort(event.target.value)}>
                  <option value="votes">Votes</option>
                  <option value="date">Date</option>
                </Input>
              </InputGroup>
            </Col>
            <Col xs={12} sm={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Direction: </InputGroupText>
                <Input type="select" value={sortDirection} onChange={(event) => updateDirection(event.target.value)}>
                  <option value="1">Ascending</option>
                  <option value="-1">Descending</option>
                </Input>
              </InputGroup>
            </Col>
          </Row>
        </div>
        <Nav tabs>
          <NavItem className="ms-2 clickable">
            <NavLink active={activePage === 'approved'} href="/packages/approved">
              Approved
            </NavLink>
          </NavItem>
          <NavItem className="ms-2 clickable">
            <NavLink active={activePage === 'submitted'} href="/packages/submitted">
              Submitted
            </NavLink>
          </NavItem>
          <NavItem className="ms-2 clickable">
            <NavLink active={activePage === 'user'} href="/packages/user">
              Your Packages
            </NavLink>
          </NavItem>
        </Nav>
        <CardBody>
          {
            // eslint-disable-next-line no-nested-ternary
            items.length === 0 ? (
              <p>No packages found</p>
            ) : loading ? (
              <div className="centered py-3">
                <Spinner className="position-absolute" />
              </div>
            ) : (
              <InfiniteScroll
                dataLength={packages.length}
                next={fetchMoreData}
                hasMore={currentLastKey != null}
                loader={loader}
              >
                {packages.map((pack) => (
                  <Row className="mx-0" key={pack.id}>
                    <CardPackage key={pack.id} cardPackage={pack} />
                  </Row>
                ))}
              </InfiniteScroll>
            )
          }
        </CardBody>
      </Card>
    </MainLayout>
  );
}

PackagesPage.propTypes = {
  loginCallback: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string.isRequired,
  activePage: PropTypes.string.isRequired,
};

PackagesPage.defaultProps = {
  loginCallback: '/',
};

export default PackagesPage;
