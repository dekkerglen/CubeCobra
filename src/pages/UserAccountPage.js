import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  FormGroup,
  Input,
  InputGroup,
  InputGroupText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  Row,
  TabContent,
  TabPane,
} from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import PatronPropType from 'proptypes/PatronPropType';

import AutocompleteInput from 'components/AutocompleteInput';
import Banner from 'components/Banner';
import CSRFForm from 'components/CSRFForm';
import CubePreview from 'components/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import TextEntry from 'components/TextEntry';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import useMount from 'hooks/UseMount';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import Query from 'utils/Query';
import RenderToRoot from 'utils/RenderToRoot';

const LEVELS = ['Patron', 'Cobra Hatchling', 'Coiling Oracle', 'Lotus Cobra'];

const AddFeaturedModal = ({ isOpen, toggle, cubes }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <CSRFForm method="POST" action="/user/queuefeatured">
        <ModalHeader toggle={toggle}>Select Cube</ModalHeader>
        <ModalBody>
          <Input type="select" id="featuredCube" name="cubeId">
            {cubes.map((cube) => (
              <option value={cube.id}>{cube.name}</option>
            ))}
          </Input>
        </ModalBody>
        <ModalFooter>
          <Button type="submit" color="accent">
            Submit
          </Button>
          <Button type="button" color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

AddFeaturedModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const RemoveFeaturedModal = ({ isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>Removing featured cube</ModalHeader>
      <ModalBody>
        <p>You are about to remove your cube from the featured cubes queue. Do you wish to proceed?</p>
        <CSRFForm method="POST" action="/user/unqueuefeatured">
          <Button type="submit" block color="unsafe" outline>
            Yes, remove my cube.
          </Button>
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

RemoveFeaturedModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const AddFeaturedButton = withModal(Button, AddFeaturedModal);
const RemoveFeaturedButton = withModal(Button, RemoveFeaturedModal);

const UserAccountPage = ({ defaultNav, loginCallback, patreonClientId, patreonRedirectUri, patron, featured }) => {
  const user = useContext(UserContext);
  const [nav, setNav] = useQueryParam('nav', defaultNav);
  const [imageValue, setImageValue] = useState(user.image.imageName);
  const [imageDict, setImageDict] = useState({});
  const [markdown, setMarkdown] = useState(user?.about ?? '');

  useMount(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => setImageDict(json.dict));
  });

  const handleClickNav = useCallback(
    (event) => {
      event.preventDefault();
      setNav(event.target.getAttribute('data-nav'));
    },
    [setNav],
  );

  const handleSubmitImage = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleChangeMarkdown = useCallback((event) => setMarkdown(event.target.value), [setMarkdown]);

  const result = imageDict[imageValue.toLowerCase()];
  let image;
  if (result) {
    image = {
      name: imageValue,
      ...result,
    };
  } else {
    image = {
      name: user.image_name,
      uri: user.image,
      artist: user.artist,
    };
  }

  useEffect(() => {
    if (nav === 'profile') {
      Query.del('nav');
    } else {
      Query.set('nav', nav);
    }
  }, [nav]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <h2 className="mt-3">My Account </h2>
      <DynamicFlash />
      <Row className="mb-3">
        <Col xs={3}>
          <Nav vertical pills>
            <NavItem>
              <NavLink href="#" active={nav === 'profile'} data-nav="profile" onClick={handleClickNav}>
                Profile
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'password'} data-nav="password" onClick={handleClickNav}>
                Change Password
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'email'} data-nav="email" onClick={handleClickNav}>
                Update Email
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'display'} data-nav="display" onClick={handleClickNav}>
                Display Preferences
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'patreon'} data-nav="patreon" onClick={handleClickNav}>
                Patreon Integration
              </NavLink>
            </NavItem>
          </Nav>
        </Col>
        <Col xs={9}>
          <TabContent activeTab={nav}>
            <TabPane tabId="profile">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/updateuserinfo">
                    <div className="mb-3">
                      <dl className="row">
                        <dt className="col-sm-3">Username</dt>
                        <dd className="col-sm-9">
                          <Input name="username" defaultValue={user.username} />
                        </dd>
                        <dt className="col-sm-3">Email</dt>
                        <dd className="col-sm-9">{user.email}</dd>
                        <dt className="col-sm-3">Profile Pic</dt>
                        <dd className="col-sm-9">
                          <Row>
                            <Col xs={6}>
                              <div className="position-relative">
                                <img width="100%" src={image.uri} alt={image.name} />
                                <em className="cube-preview-artist">Art by {image.artist}</em>
                              </div>
                            </Col>
                            <Col xs={6}>
                              <AutocompleteInput
                                treeUrl="/cube/api/fullnames"
                                treePath="cardnames"
                                type="text"
                                className="me-2"
                                name="remove"
                                value={imageValue}
                                setValue={setImageValue}
                                onSubmit={handleSubmitImage}
                                placeholder="Cardname for image"
                                autoComplete="off"
                                data-lpignore
                                noMargin
                              />
                              {result && <Input type="hidden" name="image" value={imageValue.toLowerCase()} />}
                            </Col>
                          </Row>
                        </dd>
                        <dt className="col-sm-3">About</dt>
                        <dd className="col-sm-9">
                          <TextEntry maxLength={2500} onChange={handleChangeMarkdown} name="body" value={markdown} />
                        </dd>
                      </dl>
                      <Row className="g-0">
                        <Button className="ms-auto" block outline color="accent" type="submit">
                          Update
                        </Button>
                      </Row>
                    </div>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
            <TabPane tabId="password">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/resetpassword">
                    <FormGroup row>
                      <Label for="password" sm={4}>
                        Old password:
                      </Label>
                      <Col sm={8}>
                        <Input id="currentPassword" name="password" type="password" />
                      </Col>
                    </FormGroup>
                    <FormGroup row>
                      <Label for="newPassword" sm={4}>
                        New Password:
                      </Label>
                      <Col sm={8}>
                        <Input id="newPassword" name="password2" type="password" />
                      </Col>
                    </FormGroup>
                    <FormGroup row>
                      <Label for="confirmPassword" sm={4}>
                        Confirm New Password:
                      </Label>
                      <Col sm={8}>
                        <Input id="confirmPassword" name="password3" type="password" />
                      </Col>
                    </FormGroup>
                    <Button outline block color="accent" type="submit">
                      Change Password
                    </Button>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
            <TabPane tabId="email">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/updateemail">
                    <FormGroup row>
                      <Label for="email" sm={4}>
                        New email:
                      </Label>
                      <Col sm={8}>
                        <Input id="email" name="email" type="email" defaultValue={user.email} />
                      </Col>
                    </FormGroup>
                    <FormGroup row>
                      <Label for="emailPassword" sm={4}>
                        Password:
                      </Label>
                      <Col sm={8}>
                        <Input id="emailPassword" name="password" type="password" />
                      </Col>
                    </FormGroup>
                    <Button block outline color="accent" type="submit">
                      Update
                    </Button>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
            <TabPane tabId="display">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/changedisplay">
                    <InputGroup className="mb-3">
                      <InputGroupText>theme</InputGroupText>
                      <Input type="select" id="theme" name="theme" defaultValue={user.theme}>
                        <option value="default">Default</option>
                        <option value="dark">Dark Mode</option>
                      </Input>
                    </InputGroup>
                    <FormGroup check className="mb-3">
                      <Input
                        id="hideFeatured"
                        name="hideFeatured"
                        type="checkbox"
                        defaultChecked={user.hide_featured || false}
                      />
                      <Label for="hideFeatured">Hide featured cubes</Label>
                    </FormGroup>
                    <Button block outline color="accent" type="submit">
                      Update
                    </Button>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>

            <TabPane tabId="patreon">
              <Card>
                {patron ? (
                  <CardBody>
                    {user.roles.includes('Patron') ? (
                      <p>
                        Your account is linked at the <b>{LEVELS[patron.level]}</b> level.
                      </p>
                    ) : (
                      <p>Your account is linked, but you are not an active patron.</p>
                    )}
                    <Card className="my-3">
                      <CardHeader>
                        <h5>Featured Cube</h5>
                      </CardHeader>
                      <CardBody>
                        {' '}
                        {/* ternaries are impossible to avoid in jsx */}
                        {featured ? (
                          <Row>
                            <Col xs={12} lg={5} className="p-0">
                              <CubePreview cube={featured?.cube} />
                            </Col>
                            <Col xs={12} lg={7} className="mt-4 mt-lg-0">
                              <h6>
                                Current position in&nbsp;queue: <span className="text-muted">{featured?.position}</span>
                              </h6>
                              <AddFeaturedButton
                                className="mt-3"
                                block
                                outline
                                color="accent"
                                modalProps={{ cubes: user.cubes }}
                              >
                                Replace in&nbsp;queue
                              </AddFeaturedButton>
                              <RemoveFeaturedButton className="mt-2" block outline color="unsafe">
                                Remove from&nbsp;queue
                              </RemoveFeaturedButton>
                            </Col>
                          </Row>
                        ) : [2, 3].includes(patron.level) ? (
                          <>
                            <p>Share your cube with others by adding it to a rotating queue of featured cubes!</p>
                            <AddFeaturedButton block outline color="accent" modalProps={{ cubes: user.cubes }}>
                              Add cube to queue
                            </AddFeaturedButton>
                          </>
                        ) : (
                          <p>
                            Patrons subscribed at the <b>Coiling oracle</b> level and above get to feature their cube as
                            a reward for their generous support. If you'd like to have your cube featured as well,{' '}
                            <a href="https://patreon.com/cubecobra" target="_blank" rel="noopener noreferrer">
                              upgrade your membership level.
                            </a>
                          </p>
                        )}
                      </CardBody>
                    </Card>
                    <p className="text-center">
                      <i>More Patreon features are coming soon!</i>
                    </p>
                    <Button block outline color="unsafe" href="/patreon/unlink">
                      Unlink Patreon Account
                    </Button>
                  </CardBody>
                ) : (
                  <CardBody>
                    <p>Your account is currently not linked to your patreon account.</p>
                    <Button
                      block
                      outline
                      color="accent"
                      href={`https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${patreonClientId}&redirect_uri=${encodeURIComponent(
                        patreonRedirectUri,
                      )}`}
                    >
                      Link Patreon Account
                    </Button>
                  </CardBody>
                )}
              </Card>
            </TabPane>
          </TabContent>
        </Col>
      </Row>
    </MainLayout>
  );
};

UserAccountPage.propTypes = {
  defaultNav: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
  patreonClientId: PropTypes.string.isRequired,
  patreonRedirectUri: PropTypes.string.isRequired,
  patron: PatronPropType,
  featured: PropTypes.shape({
    cube: CubePropType,
    position: PropTypes.number,
  }),
};

UserAccountPage.defaultProps = {
  loginCallback: '/',
  patron: null,
  featured: null,
};

export default RenderToRoot(UserAccountPage);
