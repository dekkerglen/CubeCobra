import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import {
  Row,
  Col,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardText,
  Button,
  Navbar,
  UncontrolledAlert,
} from 'reactstrap';

import BlogPost from './components/BlogPost';
import CSRFForm from './components/CSRFForm';
import CubeOverviewModal from './components/CubeOverviewModal';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';

class CubeOverview extends Component {
  constructor(props) {
    super(props);

    this.follow = this.follow.bind(this);
    this.unfollow = this.unfollow.bind(this);
    this.error = this.error.bind(this);
    this.onCubeUpdate = this.onCubeUpdate.bind(this);
    this.handleChangeDeleteConfirm = this.handleChangeDeleteConfirm.bind(this);

    this.state = {
      followed: this.props.followed,
      alerts: [],
      cube: props.cube,
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
    this.setState({
      followed: true,
    });
    csrfFetch(`/cube/follow/${this.props.cube._id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      }
    });
  }

  unfollow() {
    this.setState({
      followed: false,
    });
    csrfFetch(`/cube/unfollow/${this.props.cube._id}`, {
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
    const { post, price, owner, admin, cubeID, canEdit, userID, loggedIn } = this.props;
    const { cube, deleteConfirm } = this.state;
    return (
      <>
        {canEdit && (
          <div className="usercontrols">
            <Navbar expand="md" className="navbar-light">
              <div className="collapse navbar-collapse">
                <ul className="navbar-nav flex-wrap">
                  <li className="nav-item">
                    <CubeOverviewModal
                      cube={cube}
                      cubeID={cubeID}
                      onError={this.error}
                      onCubeUpdate={this.onCubeUpdate}
                    />
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#" data-toggle="modal" data-target="#deleteCubeModal">
                      Delete Cube
                    </a>
                  </li>
                </ul>
              </div>
            </Navbar>
          </div>
        )}
        <DynamicFlash />
        {this.state.alerts.map(({ color, message }) => (
          <div key={message}>
            <br />
            <UncontrolledAlert color={color}>{message}</UncontrolledAlert>
          </div>
        ))}
        <Row>
          <Col md="4">
            <Card className="mt-3">
              <CardHeader>
                <h3>{cube.name}</h3>
                <h6 className="card-subtitle mb-2 text-muted">{cube.users_following.length} followers</h6>
              </CardHeader>
              <img className="card-img-top w-100" src={cube.image_uri} />
              <em className="text-right p-1">
                Art by:
                {cube.image_artist}
              </em>
              <CardBody>
                {cube.type && (
                  <>
                    <a>
                      {cube.overrideCategory
                        ? cube.card_count +
                          ' Card ' +
                          (cube.categoryPrefixes.length > 0 ? cube.categoryPrefixes.join(' ') + ' ' : '') +
                          cube.categoryOverride +
                          ' Cube'
                        : cube.card_count + ' Card ' + cube.type + ' Cube'}
                    </a>
                    <br />
                  </>
                )}
                {!cube.privatePrices && (
                  <>
                    <a>Approx: ${price}</a>
                    <br />
                  </>
                )}
                <a href={`/cube/rss/${cube._id}`}>RSS</a>
                <em>
                  <h6>
                    Designed by
                    <a href={`/user/view/${owner}`}> {owner}</a>
                  </h6>
                </em>
                {admin && (
                  <CSRFForm
                    method="POST"
                    id="featuredForm"
                    action={`/cube/${cube.isFeatured ? 'unfeature' : 'feature'}${cube._id}`}
                  >
                    <Button color="success" type="submit">
                      {' '}
                      {cube.isFeatured ? 'Remove from Featured' : 'Add to Featured'}
                    </Button>
                  </CSRFForm>
                )}
              </CardBody>
              {loggedIn ? (
                this.state.followed ? (
                  <Button outline color="danger" className="rounded-0" onClick={this.unfollow}>
                    Unfollow
                  </Button>
                ) : (
                  <Button color="success" className="rounded-0" onClick={this.follow}>
                    Follow
                  </Button>
                )
              ) : (
                []
              )}
            </Card>
          </Col>
          <Col>
            <Card className="mt-3">
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
      </>
    );
  }
}

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary>
    <CubeOverview {...reactProps} />
  </ErrorBoundary>
);
wrapper ? ReactDOM.render(element, wrapper) : false;
