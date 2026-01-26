import React from 'react';

import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';

interface CubesCardProps {
  cubes: Cube[];
  title: string;
  children?: React.ReactNode;
  sideLink?: {
    href: string;
    text: string;
  };
  lean?: boolean;
  alternateViewFewer?: React.ReactNode;
  viewAllLink?: string; // Link to view all cubes
  [key: string]: any; // To allow additional props
}

const CubesCard: React.FC<CubesCardProps> = ({
  children,
  cubes,
  title,
  sideLink,
  lean = false,
  alternateViewFewer,
  viewAllLink,
  ...props
}) => {
  // Only show the first 2 cubes
  const displayCubes = cubes.slice(0, 2);

  return (
    <Card {...props}>
      <CardHeader className="cubes-card-header">
        <Flexbox direction="row" justify="between">
          <Text semibold lg>
            {title}
          </Text>
          {sideLink && <Link href={sideLink.href}>{sideLink.text}</Link>}
        </Flexbox>
      </CardHeader>
      <Row gutters={0}>
        {displayCubes.map((cube) => (
          <Col key={cube.id} xs={6}>
            <CubePreview cube={cube} />
          </Col>
        ))}
      </Row>
      {(!lean || cubes.length > 2) && viewAllLink && (
        <CardBody>
          {alternateViewFewer ? (
            alternateViewFewer
          ) : (
            <Button color="primary" block href={viewAllLink}>
              View More...
            </Button>
          )}
        </CardBody>
      )}
      {children}
    </Card>
  );
};

export default CubesCard;
