import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardText,
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

import BlogPost from 'components/BlogPost';
import CSRFForm from 'components/CSRFForm';
import CubeOverviewModal from 'components/CubeOverviewModal';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import CubeLayout from 'layouts/CubeLayout';

class CubeOverview extends Component {
  constructor(props) {
    super(props);

    this.follow = this.follow.bind(this);
    this.unfollow = this.unfollow.bind(this);
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

  error(message) {
    this.setState(({ alerts }) => ({
      alerts: [
        ...alerts,
        {
          color: 'danger',
          message,
        },
      ],
    }));
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
    const { post, priceOwned, pricePurchase, owner, admin, cubeID, canEdit, userID, loggedIn } = this.props;
    const { cube, deleteConfirm, alerts, followed } = this.state;

    return (
      <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="overview">
        {canEdit ? (
          <Navbar expand="md" light className="usercontrols mb-3">
            <Nav navbar>
              <NavItem>
                <CubeOverviewModal cube={cube} cubeID={cubeID} onError={this.error} onCubeUpdate={this.onCubeUpdate} />
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
                  <NavLink href="#" data-toggle="modal" data-target="#deleteCubeModal">
                    Delete Cube
                  </NavLink>
                </NavItem>
              </Nav>
            </UncontrolledCollapse>
          </Navbar>
        ) : <Row className="mb-3" />}
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
                <h6 className="card-subtitle mb-2 text-muted">{cube.users_following.length} followers</h6>
              </CardHeader>
              <div className="position-relative">
                <img className="card-img-top w-100" alt={cube.image_name} src={cube.image_uri} />
                <em className="cube-preview-artist">Art by {cube.image_artist}</em>
              </div>
              <CardBody className="pt-2 px-3 pb-3">
                {cube.type && (
                  <p className="mb-1">
                    {cube.overrideCategory
                      ? `${cube.card_count} Card ${
                          cube.categoryPrefixes.length > 0 ? `${cube.categoryPrefixes.join(' ')} ` : ''
                        }${cube.categoryOverride} Cube`
                      : `${cube.card_count} Card ${cube.type} Cube`}
                  </p>
                )}
                <h6 className="mb-2">
                  <i>
                    Designed by
                    <a href={`/user/view/${owner}`}> {owner}</a>
                  </i>{' '}
                  • <a href={`/cube/rss/${cube._id}`}>RSS</a>
                </h6>
                {!cube.privatePrices && (
                  <Row noGutters className="mb-1">
                    <TextBadge name="Owned" className="mr-2">
                      <Tooltip text="TCGPlayer Market Price as owned (excluding cards marked Not Owned)">
                        ${Math.round(priceOwned).toLocaleString()}
                      </Tooltip>
                    </TextBadge>
                    <TextBadge name="Buy">
                      <Tooltip text="TCGPlayer Market Price for cheapest version of each card">
                        ${Math.round(pricePurchase).toLocaleString()}
                      </Tooltip>
                    </TextBadge>
                  </Row>
                )}
                {admin && (
                  <CSRFForm
                    method="POST"
                    id="featuredForm"
                    action={`/cube/${cube.isFeatured ? 'unfeature' : 'feature'}${cube._id}`}
                    className="mt-2"
                  >
                    <Button color="success" type="submit">
                      {' '}
                      {cube.isFeatured ? 'Remove from Featured' : 'Add to Featured'}
                    </Button>
                  </CSRFForm>
                )}
              </CardBody>
              {loggedIn &&
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
                {cube.descriptionhtml && cube.descriptionhtml !== 'undefined' ? (
                  <CardText dangerouslySetInnerHTML={{ __html: cube.descriptionhtml }} />
                ) : (
                  <CardText>{cube.description || ''}</CardText>
                )}
              </CardBody>
              {cube.tags.length > 0 && (
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
        {post && <BlogPost key={post._id} post={post} canEdit={false} userid={userID} loggedIn={loggedIn} />}
        <div
          className="modal fade"
          id="deleteCubeModal"
          tabIndex="-1"
          role="dialog"
          aria-labelledby="deleteCubeModalLabel"
          aria-hidden="true"
        >
          <div className="modal-dialog" role="document">
            <CSRFForm method="POST" action={`/cube/remove/${cubeID}`}>
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
    );
  }
}

CubeOverview.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  priceOwned: PropTypes.number.isRequired,
  pricePurchase: PropTypes.number.isRequired,
  owner: PropTypes.string.isRequired,
  admin: PropTypes.bool,
  cube: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    image_uri: PropTypes.string.isRequired,
    image_name: PropTypes.string.isRequired,
    image_artist: PropTypes.string.isRequired,
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  userID: PropTypes.string.isRequired,
  loggedIn: PropTypes.bool,
  followed: PropTypes.bool.isRequired,
};

CubeOverview.defaultProps = {
  admin: false,
  canEdit: false,
  loggedIn: false,
}

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary>
    <CubeOverview {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
