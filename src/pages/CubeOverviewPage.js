import React, { Component } from 'react';
import PropTypes from 'prop-types';

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

const FollowersModalLink = withModal('a', FollowersModal);
const CubeSettingsModalLink = withModal(NavLink, CubeSettingsModal);

class CubeOverview extends Component {
  constructor(props) {
    super(props);

    this.follow = this.follow.bind(this);
    this.unfollow = this.unfollow.bind(this);
    this.addAlert = this.addAlert.bind(this);
    this.error = this.error.bind(this);
    this.onCubeUpdate = this.onCubeUpdate.bind(this);
    this.handleChangeDeleteConfirm = this.handleChangeDeleteConfirm.bind(this);

    const { followed, cube } = props;

    this.state = {
      followed,
      alerts: [],
      cube,
      deleteConfirm: '',
    };
  }

  onCubeUpdate(updated) {
    this.setState(({ alerts }) => ({
      alerts: [
        ...alerts,
        {
          color: 'success',
          message: 'Update Successful',
        },
      ],
      cube: updated,
    }));
  }

  addAlert(color, message) {
    this.setState(({ alerts }) => ({
      alerts: [...alerts, { color, message }],
    }));
  }

  error(message) {
    this.addAlert('danger', message);
  }

  follow() {
    const { cube } = this.props;
    this.setState({
      followed: true,
    });
    csrfFetch(`/cube/follow/${cube._id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      }
    });
  }

  unfollow() {
    const { cube } = this.props;
    this.setState({
      followed: false,
    });
    csrfFetch(`/cube/unfollow/${cube._id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      }
    });
  }

  handleChangeDeleteConfirm(event) {
    this.setState({
      deleteConfirm: event.target.value,
    });
  }

  render() {
    const { post, priceOwned, pricePurchase, admin, followers, user, loginCallback } = this.props;
    const { cube, deleteConfirm, alerts, followed } = this.state;
    const { addAlert, onCubeUpdate } = this;

    const numFollowers = followers.length;

    return (
      <MainLayout loginCallback={loginCallback} user={user}>
        <CubeLayout cube={cube} cubeID={cube._id} canEdit={user && cube.owner === user.id} activeLink="overview">
          {user && cube.owner === user.id ? (
            <Navbar expand="md" light className="usercontrols mb-3">
              <Nav navbar>
                <NavItem>
                  <CubeOverviewModal
                    cube={cube}
                    cubeID={cube._id}
                    onError={this.error}
                    onCubeUpdate={this.onCubeUpdate}
                  />
                </NavItem>
              </Nav>
              <NavbarToggler
                className="ml-auto"
                id="cubeOverviewNavbarToggler"
                aria-controls="cubeOverviewNavbarCollapse"
              />
              <UncontrolledCollapse navbar id="cubeOverviewNavbarCollapse" toggler="#cubeOverviewNavbarToggler">
                <Nav navbar>
                  <NavItem>
                    <CubeSettingsModalLink cube={cube} modalProps={{ addAlert, onCubeUpdate }}>
                      Edit Settings
                    </CubeSettingsModalLink>
                  </NavItem>
                  <NavItem>
                    <NavLink href="#" data-toggle="modal" data-target="#deleteCubeModal">
                      Delete Cube
                    </NavLink>
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
                  <h3>{cube.name}</h3>
                  <Row>
                    <Col>
                      <h6 className="card-subtitle mb-2" style={{ marginTop: 10 }}>
                        <FollowersModalLink href="#" modalProps={{ followers }}>
                          {numFollowers} {numFollowers === 1 ? 'follower' : 'followers'}
                        </FollowersModalLink>
                      </h6>
                    </Col>
                    <div className="float-right" style={{ paddingTop: 3, marginRight: '1.25rem' }}>
                      <TextBadge name="Cube ID">
                        <Tooltip id="CubeOverviewIDTooltipId" text="Click to copy to clipboard">
                          <button
                            type="button"
                            className="cube-id-btn"
                            onKeyDown={() => {}}
                            onClick={(e) => {
                              navigator.clipboard.writeText(getCubeId(cube));
                              e.target.blur();
                              addAlert('success', 'Cube ID copied to clipboard.');
                            }}
                          >
                            {getCubeId(cube)}
                          </button>
                        </Tooltip>
                      </TextBadge>
                    </div>
                  </Row>
                </CardHeader>
                <div className="position-relative">
                  <img className="card-img-top w-100" alt={cube.image_name} src={cube.image_uri} />
                  <em className="cube-preview-artist">Art by {cube.image_artist}</em>
                </div>
                <CardBody className="pt-2 px-3 pb-3">
                  {cube.type && <p className="mb-1">{getCubeDescription(cube)}</p>}
                  <h6 className="mb-2">
                    <i>
                      Designed by
                      <a href={`/user/view/${cube.owner}`}> {cube.owner_name}</a>
                    </i>{' '}
                    • <a href={`/cube/rss/${cube._id}`}>RSS</a>
                  </h6>
                  {!cube.privatePrices && (
                    <Row noGutters className="mb-1">
                      {Number.isFinite(priceOwned) && (
                        <TextBadge name="Owned" className="mr-2">
                          <Tooltip
                            id="CubeOverviewOwnedTooltipId"
                            text="TCGPlayer Market Price as owned (excluding cards marked Not Owned)"
                          >
                            ${Math.round(priceOwned).toLocaleString()}
                          </Tooltip>
                        </TextBadge>
                      )}
                      {Number.isFinite(pricePurchase) && (
                        <TextBadge name="Buy">
                          <Tooltip
                            id="CubeOverviewPurchaseTooltipId"
                            text="TCGPlayer Market Price for cheapest version of each card"
                          >
                            ${Math.round(pricePurchase).toLocaleString()}
                          </Tooltip>
                        </TextBadge>
                      )}
                    </Row>
                  )}
                  {admin && (
                    <CSRFForm
                      method="POST"
                      id="featuredForm"
                      action={`/cube/${cube.isFeatured ? 'unfeature/' : 'feature/'}${cube._id}`}
                      className="mt-2"
                    >
                      <Button color="success" type="submit">
                        {' '}
                        {cube.isFeatured ? 'Remove from Featured' : 'Add to Featured'}
                      </Button>
                    </CSRFForm>
                  )}
                </CardBody>
                {user &&
                  cube.owner !== user.id &&
                  (followed ? (
                    <Button outline color="danger" className="rounded-0" onClick={this.unfollow}>
                      Unfollow
                    </Button>
                  ) : (
                    <Button color="success" className="rounded-0" onClick={this.follow}>
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
                  <Markdown markdown={cube.description || ''} />
                </CardBody>
                {cube.tags && cube.tags.length > 0 && (
                  <CardFooter>
                    <div className="autocard-tags">
                      {cube.tags.map((tag) => (
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
          <div
            className="modal fade"
            id="deleteCubeModal"
            tabIndex="-1"
            role="dialog"
            aria-labelledby="deleteCubeModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog" role="document">
              <CSRFForm method="POST" action={`/cube/remove/${cube._id}`}>
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="deleteCubeModalLabel">
                      Confirm Delete
                    </h5>
                    <button className="close" type="button" data-dismiss="modal" aria-label="Close">
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <p>Are you sure you wish to delete this cube? This action cannot be undone.</p>
                    <p>Please type 'Delete' in order to confirm</p>
                    <input
                      className="form-control"
                      type="text"
                      value={deleteConfirm}
                      onChange={this.handleChangeDeleteConfirm}
                    />
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-danger" type="submit" disabled={deleteConfirm !== 'Delete'}>
                      Delete
                    </button>
                    <button className="btn btn-secondary" type="button" data-dismiss="modal">
                      Cancel
                    </button>
                  </div>
                </div>
              </CSRFForm>
            </div>
          </div>
        </CubeLayout>
      </MainLayout>
    );
  }
}

CubeOverview.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  priceOwned: PropTypes.number,
  pricePurchase: PropTypes.number,
  admin: PropTypes.bool,
  cube: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    image_uri: PropTypes.string.isRequired,
    image_name: PropTypes.string.isRequired,
    image_artist: PropTypes.string.isRequired,
  }).isRequired,
  followed: PropTypes.bool.isRequired,
  followers: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ),
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

CubeOverview.defaultProps = {
  post: null,
  priceOwned: null,
  pricePurchase: null,
  admin: false,
  followers: [],
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeOverview);
