import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, Col, FormGroup, Input, Label, Nav, NavItem, NavLink, Row, TabContent, TabPane } from 'reactstrap';

import Query from 'utils/Query';

import CSRFForm from 'components/CSRFForm';

const UserAccountPage = ({ user }) => {
  const [nav, setNav] = useState('profile');
  const handleClickNav = useCallback((event) => {
    event.preventDefault();
    setNav(event.target.getAttribute('data-nav'));
  }, []);

  useEffect(() => {
    setNav(Query.get('nav', 'profile'));
  }, []);
  useEffect(() => {
    if (nav === 'profile') {
      Query.del('nav');
    } else {
      Query.set('nav', nav);
    }
  }, [nav]);

  return (
    <>
      <h2 className="mt-3">My Account </h2>
      <Row>
        <Col xs={3}>
          <Nav vertical pills>
            <NavItem>
              <NavLink href="#" active={nav === 'profile'} data-nav="profile" onClick={handleClickNav}>Profile</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'password'} data-nav="password" onClick={handleClickNav}>Change Password</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'email'} data-nav="email" onClick={handleClickNav}>Update Email</NavLink>
            </NavItem>
          </Nav>
        </Col>
        <Col xs={9}>
          <TabContent activeTab={nav}>
            <TabPane tabId="profile">
              <CSRFForm action="/user/updateuserinfo">
                <div className="form-group">
                  <dl className="row">
                    <dt className="col-sm-3">Username</dt>
                    <dd className="col-sm-9">
                      <Input name="username" defaultValue={user.username} />
                    </dd>
                    <dt className="col-sm-3">Email</dt>
                    <dd className="col-sm-9">{user.email}</dd>
                    <dt className="col-sm-3">About</dt>
                    <dd className="col-sm-9">
                      <Input
                        type="textarea"
                        maxLength="2500"
                        placeholder="Describe yourself here... (max length 2500)"
                        name="body"
                        defaultValue={user.about}
                      />
                      <br />
                      <Button color="success" type="submit">Update</Button>
                    </dd>
                  </dl>
                </div>
              </CSRFForm>
            </TabPane>
            <TabPane tabId="password">
              <CSRFForm method="POST" action="/user/resetpassword">
                <FormGroup row>
                  <Label for="password" className="col-sm-4 col-form-Label">Old password:</Label>
                  <input className="form-control form-control col-sm-8" id="password" name="password" type="password" />
                </FormGroup>
                <FormGroup row>
                  <Label for="newPassword" className="col-sm-4 col-form-Label">New Password:</Label>
                  <input className="form-control form-control col-sm-8" id="newPassword" name="password2" type="password" />
                </FormGroup>
                <FormGroup row>
                  <Label for="confirmPassword" className="col-sm-4 col-form-Label">Confirm New Password:</Label>
                  <input
                    className="form-control form-control col-sm-8"
                    id="confirmPassword"
                    name="password3"
                    type="password"
                  />
                </FormGroup>
                <Button color="success" type="submit">Change Password</Button>
              </CSRFForm>
            </TabPane>
            <TabPane tabId="email">
              <CSRFForm method="POST" action="/user/updateemail">
                <FormGroup row>
                  <Label for="email" className="col-sm-4 col-form-Label">New Email:</Label>
                  <Input className="col-sm-8" id="email" name="email" type="email" defaultValue={user.email} />
                </FormGroup>
                <FormGroup row>
                  <Label for="emailPassword" className="col-sm-4 col-form-Label">Password:</Label>
                  <Input className="col-sm-8" id="emailPassword" name="password" type="password" />
                </FormGroup>
                <Button color="success" type="submit">Update</Button>
              </CSRFForm>
            </TabPane>
          </TabContent>
        </Col>
      </Row>
    </>
  );
};

UserAccountPage.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    about: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    users_following: PropTypes.arrayOf(PropTypes.string.isRequired),
  }).isRequired,
};

export default UserAccountPage;
