import React from 'react';
import { Button, Card, CardBody, CardHeader, Input } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const AdminDashboardPage = ({ loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CSRFForm method="POST" action="/content/submitapplication" autoComplete="off">
        <CardHeader>
          <h5>Apply to be a Cube Cobra Content Creator Partner</h5>
        </CardHeader>
        <CardBody>
          <p>
            Content Creator Partners have access to post articles, videos, and podcasts on Cube Cobra. If you have more
            questions about the program, please reach out <a href="/contact">here</a>.
          </p>
          <p>
            Please explain why you want to become a content creator partner. Links to existing content are appreciated.
            If you do not have any existing content, what are your goals, and what sort of content are you looking to
            create?
          </p>
          <Input
            type="textarea"
            className="w-100 mb-3"
            id="info"
            name="info"
            placeholder="Please list as much info as you can here."
          />
          <Button color="accent" block outline>
            Submit
          </Button>
        </CardBody>
      </CSRFForm>
    </Card>
  </MainLayout>
);

AdminDashboardPage.propTypes = {
  loginCallback: PropTypes.string,
};

AdminDashboardPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(AdminDashboardPage);
