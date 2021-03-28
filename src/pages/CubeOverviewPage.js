import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import UserPropType from 'proptypes/UserPropType';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Col,
  Nav,
  Navbar,
  NavbarToggler,
  NavItem,
  NavLink,
  Row,
  UncontrolledAlert,
  UncontrolledCollapse,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import { getCubeId, getCubeDescription } from 'utils/Util';

import BlogPost from 'components/BlogPost';
import CSRFForm from 'components/CSRFForm';
import CubeOverviewModal from 'components/CubeOverviewModal';
import CubeSettingsModal from 'components/CubeSettingsModal';
import DynamicFlash from 'components/DynamicFlash';
import FollowersModal from 'components/FollowersModal';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import Markdown from 'components/Markdown';
import withModal from 'components/WithModal';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import DeleteCubeModal from 'components/DeleteCubeModal';
import CustomizeBasicsModal from 'components/CustomizeBasicsModal';

const FollowersModalLink = withModal('a', FollowersModal);
const CubeSettingsModalLink = withModal(NavLink, CubeSettingsModal);
const DeleteCubeModalLink = withModal(NavLink, DeleteCubeModal);
const CustomizeBasicsModalLink = withModal(NavLink, CustomizeBasicsModal);

const CubeOverview = ({ post, priceOwned, pricePurchase, cube, followed, followers, user, loginCallback }) => {
  const [alerts, setAlerts] = useState([]);
  const [cubeState, setCubeState] = useState(cube);
  const [followedState, setFollowedState] = useState(followed);

  const addAlert = (color, message) => {
    setAlerts([...alerts, { color, message }]);
  };

  const onCubeUpdate = (updated) => {
    addAlert('success', 'Update Successful');
    setCubeState(updated);
  };

  const follow = () => {
    setFollowedState(true);

    csrfFetch(`/cube/follow/${cube._id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      }
    });
  };

  const unfollow = () => {
    setFollowedState(false);

    csrfFetch(`/cube/unfollow/${cube._id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      }
    });
  };

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cubeState} canEdit={user && cubeState.owner === user.id} activeLink="overview">
        {user && cubeState.owner === user.id ? (
          <Navbar expand="md" light className="usercontrols mb-3">
            <NavbarToggler
              className="ml-auto"
              id="cubeOverviewNavbarToggler"
              aria-controls="cubeOverviewNavbarCollapse"
            />
            <UncontrolledCollapse navbar id="cubeOverviewNavbarCollapse" toggler="#cubeOverviewNavbarToggler">
              <Nav navbar>
                <NavItem>
                  <CubeOverviewModal
                    cube={cubeState}
                    cubeID={cubeState._id}
                    onError={(message) => addAlert('danger', message)}
                    onCubeUpdate={onCubeUpdate}
                  />
                </NavItem>
                <NavItem>
                  <CubeSettingsModalLink cube={cubeState} modalProps={{ addAlert, onCubeUpdate }}>
                    Edit Settings
                  </CubeSettingsModalLink>
                </NavItem>
                <NavItem>
                  <CustomizeBasicsModalLink
                    modalProps={{
                      cube: cubeState,
                      onError: (message) => {
                        addAlert('danger', message);
                      },
                      updateBasics: (basics) => {
                        const deepClone = JSON.parse(JSON.stringify(cubeState));
                        deepClone.basics = basics;
                        onCubeUpdate(deepClone);
                      },
                    }}
                  >
                    Customize Basics
                  </CustomizeBasicsModalLink>
                </NavItem>
                <NavItem>
                  <DeleteCubeModalLink modalProps={{ cubeid: cubeState._id }}>Delete Cube</DeleteCubeModalLink>
                </NavItem>
              </Nav>
            </UncontrolledCollapse>
          </Navbar>
        ) : (
          <Row className="mb-3" />
        )}
        <DynamicFlash />
        {alerts.map(({ color, message }, index) => (
          <UncontrolledAlert color={color} key={/* eslint-disable-line react/no-array-index-key */ index}>
            {message}
          </UncontrolledAlert>
        ))}
        <Row>
          <Col md="4" className="mb-3">
            <Card>
              <CardHeader>
                <h3>{cubeState.name}</h3>
                <Row>
                  <Col>
                    <h6 className="card-subtitle mb-2" style={{ marginTop: 10 }}>
                      <FollowersModalLink href="#" modalProps={{ followers }}>
                        {cubeState.users_following.length}{' '}
                        {cubeState.users_following.length === 1 ? 'follower' : 'followers'}
                      </FollowersModalLink>
                    </h6>
                  </Col>
                  <div className="float-right" style={{ paddingTop: 3, marginRight: '1.25rem' }}>
                    <TextBadge name="Cube ID">
                      <Tooltip text="Click to copy to clipboard">
                        <button
                          type="button"
                          className="cube-id-btn"
                          onKeyDown={() => {}}
                          onClick={(e) => {
                            navigator.clipboard.writeText(getCubeId(cubeState));
                            e.target.blur();
                            addAlert('success', 'Cube ID copied to clipboard.');
                          }}
                        >
                          {getCubeId(cubeState)}
                        </button>
                      </Tooltip>
                    </TextBadge>
                  </div>
                </Row>
              </CardHeader>
              <div className="position-relative">
                <img className="card-img-top w-100" alt={cubeState.image_name} src={cubeState.image_uri} />
                <em className="cube-preview-artist">Art by {cubeState.image_artist}</em>
              </div>
              <CardBody className="pt-2 px-3 pb-3">
                {cube.type && <p className="mb-1">{getCubeDescription(cubeState)}</p>}
                <h6 className="mb-2">
                  <i>
                    Designed by
                    <a href={`/user/view/${cubeState.owner}`}> {cubeState.owner_name}</a>
                  </i>{' '}
                  • <a href={`/cube/rss/${cubeState._id}`}>RSS</a>
                </h6>
                {!cubeState.privatePrices && (
                  <Row noGutters className="mb-1">
                    {Number.isFinite(priceOwned) && (
                      <TextBadge name="Owned" className="mr-2">
                        <Tooltip text="TCGPlayer Market Price as owned (excluding cards marked Not Owned)">
                          ${Math.round(priceOwned).toLocaleString()}
                        </Tooltip>
                      </TextBadge>
                    )}
                    {Number.isFinite(pricePurchase) && (
                      <TextBadge name="Buy">
                        <Tooltip text="TCGPlayer Market Price for cheapest version of each card">
                          ${Math.round(pricePurchase).toLocaleString()}
                        </Tooltip>
                      </TextBadge>
                    )}
                  </Row>
                )}
                {user.roles.includes('Admin') && (
                  <CSRFForm
                    method="POST"
                    id="featuredForm"
                    action={`/cube/${cubeState.isFeatured ? 'unfeature/' : 'feature/'}${cubeState._id}`}
                    className="mt-2"
                  >
                    <Button color="success" type="submit">
                      {' '}
                      {cubeState.isFeatured ? 'Remove from Featured' : 'Add to Featured'}
                    </Button>
                  </CSRFForm>
                )}
              </CardBody>
              {user &&
                cubeState.owner !== user.id &&
                (followedState ? (
                  <Button outline color="danger" className="rounded-0" onClick={unfollow}>
                    Unfollow
                  </Button>
                ) : (
                  <Button color="success" className="rounded-0" onClick={follow}>
                    Follow
                  </Button>
                ))}
            </Card>
          </Col>
          <Col>
            <Card>
              <CardHeader>
                <h5 className="card-title">Description</h5>
              </CardHeader>
              <CardBody>
                <Markdown markdown={cubeState.description || ''} />
              </CardBody>
              {cubeState.tags && cubeState.tags.length > 0 && (
                <CardFooter>
                  <div className="autocard-tags">
                    {cubeState.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardFooter>
              )}
            </Card>
          </Col>
        </Row>
        <div className="mb-3">
          {post && (
            <BlogPost
              key={post._id}
              post={post}
              canEdit={false}
              userid={user ? user.id : null}
              loggedIn={user !== null}
            />
          )}
        </div>
      </CubeLayout>
    </MainLayout>
  );
};

CubeOverview.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  priceOwned: PropTypes.number,
  pricePurchase: PropTypes.number,
  cube: CubePropType.isRequired,
  followed: PropTypes.bool.isRequired,
  followers: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ),
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeOverview.defaultProps = {
  post: null,
  priceOwned: null,
  pricePurchase: null,
  followers: [],
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeOverview);
