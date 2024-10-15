import React, { ReactNode } from 'react';

import useToggle from 'hooks/UseToggle';
import { Card, CardBody, CardHeader } from './Card';
import Collapse from './Collapse';
import Text from './Text';
import { Flexbox } from './Layout';

export interface AccordionProps {
  defaultExpand?: boolean;
  children: ReactNode;
  title: string;
}

const Accordion: React.FC<AccordionProps> = ({ defaultExpand = false, children, title }) => {
  const [expanded, toggle] = useToggle(defaultExpand);

  return (
    <Card>
      <CardHeader onClick={toggle} className="cursor-pointer bg-bg-accent hover:bg-bg-active">
        <Text semibold md>
          {title}
        </Text>
      </CardHeader>
      <Collapse isOpen={expanded}>
        <CardBody>
          <Flexbox direction="col" gap="2">
            {children}
          </Flexbox>
        </CardBody>
      </Collapse>
    </Card>
  );
};

export default Accordion;
