import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

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

import { LinkExternalIcon, QuestionIcon, EyeClosedIcon } from '@primer/octicons-react';

import { csrfFetch } from 'utils/CSRF';
import { getCubeId, getCubeDescription } from 'utils/Util';

import UserContext from 'contexts/UserContext';
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
import CubeIdModal from 'components/CubeIdModal';
import QRCodeModal from 'components/QRCodeModal';
import Username from 'components/Username';
import MtgImage from 'components/MtgImage';
import BlogPostPropType from 'proptypes/BlogPostPropType';
import UserPropType from 'proptypes/UserPropType';
import CardPropType from 'proptypes/CardPropType';

const FollowersModalLink = withModal('a', FollowersModal);
const CubeOverviewModalLink = withModal(NavLink, CubeOverviewModal);
const CubeSettingsModalLink = withModal(NavLink, CubeSettingsModal);
const DeleteCubeModalLink = withModal(NavLink, DeleteCubeModal);
const CustomizeBasicsModalLink = withModal(NavLink, CustomizeBasicsModal);
const CubeIdModalLink = withModal('span', CubeIdModal);
const QRCodeModalLink = withModal('a', QRCodeModal);

const PrivateCubeIcon = () => (
  <Tooltip
    text="This cube is set as private."
    wrapperTag="span"
    className="text-secondary"
    style={{ position: 'relative', top: '-3px' }}
  >
    <EyeClosedIcon size={24} />
  </Tooltip>
);

const CubeOverview = ({ post, cards, priceOwned, pricePurchase, cube, followed, followers, loginCallback }) => {
  const user = useContext(UserContext);

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

    csrfFetch(`/cube/follow/${cube.id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.error(response);
      }
    });
  };

  const unfollow = () => {
    setFollowedState(false);

    csrfFetch(`/cube/unfollow/${cube.id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.error(response);
      }
    });
  };

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cards={cards} cube={cubeState} activeLink="overview">
        {user && cubeState.owner === user.id ? (
          <Navbar expand="md" light className="usercontrols mb-3">
            <NavbarToggler
              className="ms-auto"
              id="cubeOverviewNavbarToggler"
              aria-controls="cubeOverviewNavbarCollapse"
            />
            <UncontrolledCollapse navbar id="cubeOverviewNavbarCollapse" toggler="#cubeOverviewNavbarToggler">
              <Nav navbar>
                <NavItem>
                  <CubeOverviewModalLink
                    modalProps={{
                      cube: cubeState,
                      cubeID: cubeState.id,
                      onError: (message) => addAlert('danger', message),
                      onCubeUpdate,
                    }}
                  >
                    Edit Overview
                  </CubeOverviewModalLink>
                </NavItem>
                <NavItem>
                  <CubeSettingsModalLink modalProps={{ addAlert, onCubeUpdate }}>Edit Settings</CubeSettingsModalLink>
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
                    Customize basics
                  </CustomizeBasicsModalLink>
                </NavItem>
                <NavItem>
                  <DeleteCubeModalLink modalProps={{ cubeId: cubeState.id, cubeName: cubeState.name }}>
                    Delete Cube
                  </DeleteCubeModalLink>
                </NavItem>
              </Nav>
            </UncontrolledCollapse>
          </Navbar>
        ) : (
          <Row />
        )}
        <DynamicFlash />
        {alerts.map(({ color, message }, index) => (
          <UncontrolledAlert color={color} key={/* eslint-disable-line react/no-array-index-key */ index}>
            {message}
          </UncontrolledAlert>
        ))}
        <Card>
          <CardHeader>
            <Row>
              <Col>
                <h3>
                  {cubeState.name} {cubeState.visibility !== 'pu' && <PrivateCubeIcon />}
                </h3>
              </Col>
              <Col xs="auto" className="ms-auto d-flex">
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
                <CubeIdModalLink
                  modalProps={{ fullID: cube.id, shortId: getCubeId(cubeState), alert: addAlert }}
                  aria-label="Show Cube IDs"
                  className="ms-1 pt-1"
                >
                  <QuestionIcon size="18" />
                </CubeIdModalLink>
              </Col>
            </Row>
          </CardHeader>
          <Row>
            <Col md="4" className="mb-3 ">
              <MtgImage cardname={cubeState.imageName} showArtist />
              <CardBody className="pt-2 px-3 pb-3">
                <p className="mb-1">{getCubeDescription(cubeState)}</p>
                <h6 className="card-subtitle mb-2" style={{ marginTop: 10 }}>
                  <FollowersModalLink href="#" modalProps={{ followers }}>
                    {(cubeState.following || []).length}{' '}
                    {(cubeState.following || []).length === 1 ? 'follower' : 'followers'}
                  </FollowersModalLink>
                </h6>
                <h6 className="mb-2">
                  <i>
                    {'Designed by '}
                    <Username userId={cubeState.owner} />
                  </i>{' '}
                  • <a href={`/cube/rss/${cubeState.id}`}>RSS</a> •{' '}
                  <QRCodeModalLink
                    href="#"
                    modalProps={{ link: `https://cubecobra.com/c/${cube.id}`, cubeName: cube.name }}
                  >
                    QR Code
                  </QRCodeModalLink>
                </h6>
                <p>
                  <a href={`https://luckypaper.co/resources/cube-map/?cube=${cubeState.id}`}>
                    View in Cube Map <LinkExternalIcon size={16} />
                  </a>
                </p>
                {cubeState.priceVisibility === 'pu' && (
                  <Row className="mb-1 g-0">
                    {Number.isFinite(priceOwned) && (
                      <TextBadge name="Owned" className="me-2">
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
                {user && user.roles.includes('Admin') && (
                  <CSRFForm
                    method="POST"
                    id="featuredForm"
                    action={`/cube/${cubeState.featured ? 'unfeature/' : 'feature/'}${cubeState.id}`}
                    className="mt-2"
                  >
                    <Button color="accent" type="submit" disabled={cubeState.visibility !== 'pu'}>
                      {' '}
                      {cubeState.featured ? 'Remove from featured' : 'Add to featured'}
                    </Button>
                  </CSRFForm>
                )}
              </CardBody>
              {user &&
                cubeState.owner !== user.id &&
                (followedState ? (
                  <Button outline color="unsafe" className="rounded-0" onClick={unfollow}>
                    Unfollow
                  </Button>
                ) : (
                  <Button color="accent" className="rounded-0" onClick={follow}>
                    Follow
                  </Button>
                ))}
            </Col>
            <Col>
              <CardBody>
                <Markdown markdown={cubeState.description || ''} />
              </CardBody>
            </Col>
          </Row>
          {cubeState.tags && cubeState.tags.length > 0 && (
            <CardFooter>
              <div className="autocard-tags">
                {cubeState.tags.map((tag) => (
                  <a href={`/search/tag:${tag}`}>
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  </a>
                ))}
              </div>
            </CardFooter>
          )}
        </Card>
        <div className="my-3">{post && <BlogPost key={post.id} post={post} />}</div>
      </CubeLayout>
    </MainLayout>
  );
};

CubeOverview.propTypes = {
  post: BlogPostPropType,
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(CardPropType),
  }).isRequired,
  priceOwned: PropTypes.number,
  pricePurchase: PropTypes.number,
  cube: CubePropType.isRequired,
  followed: PropTypes.bool.isRequired,
  followers: PropTypes.arrayOf(UserPropType),
  loginCallback: PropTypes.string,
};

CubeOverview.defaultProps = {
  post: null,
  priceOwned: null,
  pricePurchase: null,
  followers: [],
  loginCallback: '/',
};

export default RenderToRoot(CubeOverview);
