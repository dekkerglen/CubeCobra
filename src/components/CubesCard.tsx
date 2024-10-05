import React, { useState } from 'react';
import CubePreview from 'components/CubePreview';
import Cube from 'datatypes/Cube';
import Text from 'components/base/Text';
import Link from './base/Link';
import { Card, CardBody, CardHeader } from './base/Card';
import { Row, Col } from './base/Layout';
import Button from './base/Button';
import Collapse from './base/Collapse';

interface CubesCardProps {
  cubes: Cube[];
  title: string;
  header?: string;
  children?: React.ReactNode;
  sideLink?: {
    href: string;
    text: string;
  };
  lean?: boolean;
  [key: string]: any; // To allow additional props
}

const CubesCard: React.FC<CubesCardProps> = ({ children, cubes, title, header, sideLink, lean = false, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <Card {...props}>
      <CardHeader className="cubes-card-header">
        <Text semibold xl>
          {title}
        </Text>
        {sideLink && <Link href={sideLink.href}>{sideLink.text}</Link>}
      </CardHeader>
      <Row noGutters>
        {cubes.slice(0, 2).map((cube) => (
          <Col key={cube.id} xs={6}>
            <CubePreview cube={cube} />
          </Col>
        ))}
      </Row>
      <Collapse isOpen={isOpen}>
        <Row noGutters>
          {cubes.slice(2).map((cube) => (
            <Col key={cube.id} xs={6}>
              <CubePreview cube={cube} />
            </Col>
          ))}
        </Row>
      </Collapse>
      {(!lean || cubes.length > 2) && (
        <CardBody>
          <Button color="accent" block onClick={toggle}>
            {isOpen ? 'View Fewer...' : 'View More...'}
          </Button>
        </CardBody>
      )}
      {children}
    </Card>
  );
};

export default CubesCard;
