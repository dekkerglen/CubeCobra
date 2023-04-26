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
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

import UserContext from 'contexts/UserContext';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import InfiniteScroll from 'react-infinite-scroll-component';
import Banner from 'components/Banner';
import Tab from 'components/Tab';
import CreatePackageModal from 'components/CreatePackageModal';
import withModal from 'components/WithModal';
import CardPackage from 'components/CardPackage';

const CreatePackageModalLink = withModal(Button, CreatePackageModal);

const tabTypes = {
  '0': 'approved',
  '1': 'pending',
  '2': 'yourpackages',
};

const UserPackagesPage = ({ loginCallback, items, lastKey }) => {
  const user = useContext(UserContext);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [sort, setSort] = useState('votes');
  const [sortDirection, setSortDirection] = useState('-1');
  const [selectedTab, setSelectedTab] = useState('0');
  const [packages, setPackages] = useState(items);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const addAlert = (color, message) => {
    setAlerts([...alerts, { color, message }]);
  };

  const fetchMoreData = useCallback(async () => {
    const post = filter.length > 0 ? `/${filter}` : '';
    const response = await csrfFetch(`/content/getpackages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: tabTypes[selectedTab],
        keywords: post,
        lastKey: currentLastKey,
        ascending: sortDirection === '1',
        sort,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setPackages([...packages, ...json.packages]);
        setLastKey(json.lastKey);
      }
    }
  }, [filter, selectedTab, currentLastKey, sortDirection, sort, packages]);

  const changeTab = (i) => {
    setPackages([]);
    setLastKey(null);
    setSelectedTab(i);
    fetchMoreData();
  };

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
            <InputGroupText htmlFor="filterInput">keywords</InputGroupText>
            <Input
              type="text"
              placeholder="Search for keywords or packages that include a card..."
              valid={filterTemp !== filter}
              value={filterTemp}
              onChange={(e) => setFilterTemp(e.target.value)}
              onKeyDown={(e) => e.keyCode === 13 && setFilter(filterTemp)}
            />
            <Button color="accent" className="square-left" onClick={() => setFilter(filterTemp)}>
              Apply
            </Button>
          </InputGroup>
          <Row className="px-3">
            <Col xs={12} sm={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Sort: </InputGroupText>
                <Input type="select" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="votes">Votes</option>
                  <option value="date">Date</option>
                </Input>
              </InputGroup>
            </Col>
            <Col xs={12} sm={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Direction: </InputGroupText>
                <Input type="select" value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
                  <option value="1">Ascending</option>
                  <option value="-1">Descending</option>
                </Input>
              </InputGroup>
            </Col>
          </Row>
        </div>
        <Nav tabs>
          <Tab tab={selectedTab} setTab={changeTab} index="0">
            Approved
          </Tab>
          <Tab tab={selectedTab} setTab={changeTab} index="1">
            Submitted
          </Tab>
          {user && (
            <Tab tab={selectedTab} setTab={changeTab} index="2">
              Your Packages
            </Tab>
          )}
        </Nav>
        <CardBody>
          <InfiniteScroll
            dataLength={packages.length}
            next={fetchMoreData}
            hasMore={currentLastKey != null}
            loader={loader}
          >
            {packages.map((pack) => (
              <CardPackage key={pack.id} cardPackage={pack} refresh={() => {}} />
            ))}
          </InfiniteScroll>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

UserPackagesPage.propTypes = {
  loginCallback: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string.isRequired,
};

UserPackagesPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(UserPackagesPage);
