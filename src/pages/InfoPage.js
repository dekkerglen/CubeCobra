import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Row, Col, Card, CardHeader, CardBody, Table } from 'reactstrap';

import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ContactPage = ({ user, title, content, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Banner user={user} />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h5>{title}</h5>
      </CardHeader>
      <CardBody>
        {content.map((item) =>
          item.table ? (
            <Table bordered responsive className="mt-lg-3">
              {item.table.map((row) => (
                <tr>
                  <th scope="col">{row[0]}</th>
                  <td>{row[1]}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Row key={item.label} className={item.label.length > 0 ? 'mt-3' : 'my-0'}>
              <Col xs="12" sm="3">
                <strong>{item.label}</strong>
              </Col>
              <Col xs="12" sm="9">
                <p>{item.text}</p>
              </Col>
            </Row>
          ),
        )}
        <span data-ccpa-link="1" />
      </CardBody>
    </Card>
  </MainLayout>
);

ContactPage.propTypes = {
  user: UserPropType,
  title: PropTypes.string.isRequired,
  content: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
    }),
  ).isRequired,
  loginCallback: PropTypes.string,
};

ContactPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ContactPage);
