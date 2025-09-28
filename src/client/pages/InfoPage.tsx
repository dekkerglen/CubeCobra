import React from 'react';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface InfoPageProps {
  title: string;
  content: {
    label: string;
    text: string;
    table?: [string, string][];
  }[];
}

const InfoPage: React.FC<InfoPageProps> = ({ title, content }) => (
  <MainLayout>
    <Banner />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <Text md semibold>
          {title}
        </Text>
      </CardHeader>
      <CardBody>
        {content.map((item, index) =>
          item.table ? (
            <div key={index} className="overflow-x-auto mt-3">
              <table className="min-w-full border">
                <tbody>
                  {item.table.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <th className="px-4 py-2 border border-border">{row[0]}</th>
                      <td className="px-4 py-2 border border-border">{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Row key={index} className={item.label.length > 0 ? 'mt-3' : 'my-0'}>
              <Col xs={12} sm={3}>
                <Text semibold>{item.label}</Text>
              </Col>
              <Col xs={12} sm={9}>
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

export default RenderToRoot(InfoPage);
