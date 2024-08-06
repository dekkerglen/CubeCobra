import React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import ButtonLink from 'components/ButtonLink';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const back = () => (window.history.length > 1 ? window.history.back() : window.close());

const LeaveWarningPage = ({ url, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h4>You are about to leave CubeCobra</h4>
      </CardHeader>
      <CardBody>
        <p>
          This link leads to: <code>{url}</code>
        </p>
        <p>Are you sure you want to proceed?</p>
      </CardBody>
      <CardFooter>
        <ButtonLink href={url} color="unsafe">
          Yes, continue
        </ButtonLink>
        <Button className="ms-2" color="secondary" onClick={back}>
          Go back
        </Button>
      </CardFooter>
    </Card>
  </MainLayout>
);

LeaveWarningPage.propTypes = {
  url: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

LeaveWarningPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(LeaveWarningPage);
