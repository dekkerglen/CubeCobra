import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody } from 'reactstrap';

import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const LandingPage = ({ user, version, host }) => {
  return (
    <MainLayout user={user}>
      <Card className="my-3">
        <CardHeader>
          <h4>Deployment Details</h4>
        </CardHeader>
        <CardBody>
          <dl className="row">
            <dt className="col-3">Build Version</dt>
            <dd className="col-9">
              <p>{version}</p>
            </dd>
          </dl>
          <dl className="row">
            <dt className="col-3">Host</dt>
            <dd className="col-9">
              <p>{host}</p>
            </dd>
          </dl>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

LandingPage.propTypes = {
  version: PropTypes.string.isRequired,
  host: PropTypes.string.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

LandingPage.defaultProps = {
  user: null,
};

export default RenderToRoot(LandingPage);
