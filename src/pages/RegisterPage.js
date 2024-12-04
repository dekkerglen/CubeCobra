import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Banner from 'components/Banner';
import Button from 'components/base/Button';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import Input from 'components/base/Input';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'components/RenderToRoot';
import Text from 'components/base/Text';

const RegisterPage = ({ username, email, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="mt-3">
      <CardHeader>
        <Text md semibold>Register</Text>
      </CardHeader>
      <CardBody>
        <CSRFForm method="POST" action="/user/register">
          <div className="flex flex-col space-y-4">
            <div className="flex space-between space-x-4 items-center">
              <label className="w-64">Email Address:</label>
              <Input maxLength="1000" name="email" id="email" type="text" defaultValue={email} />
            </div>
            <div className="flex space-between space-x-4 items-center">
              <label className="w-64">username:</label>
              <Input maxLength="1000" name="username" id="username" type="text" defaultValue={username} />
            </div>
            <div className="flex space-between space-x-4 items-center">
              <label className="w-64">Password:</label>
              <Input maxLength="1000" name="password" id="password" type="password" />
            </div>
            <div className="flex space-between space-x-4 items-center">
              <label className="w-64">Confirm Password:</label>
              <Input maxLength="1000" name="password2" id="confirmPassword" type="password" />
            </div>
            <Button type="submit" color="accent" block outline>
              Register
            </Button>
          </div>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

RegisterPage.propTypes = {
  email: PropTypes.string,
  username: PropTypes.string,
  loginCallback: PropTypes.string,
};

RegisterPage.defaultProps = {
  loginCallback: '/',
  email: '',
  username: '',
};

export default RenderToRoot(RegisterPage);
