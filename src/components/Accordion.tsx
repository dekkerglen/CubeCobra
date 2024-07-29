import React, { ReactNode } from 'react';

import { Card, CardBody, CardHeader, Collapse } from 'reactstrap';

import useToggle from 'hooks/UseToggle';

export interface AccordionProps {
  defaultExpand?: boolean;
  children: ReactNode;
  title: string;
}

const Accordion: React.FC<AccordionProps> = ({ defaultExpand = false, children, title }) => {
  const [expanded, toggle] = useToggle(defaultExpand);

  return (
    <div className="accordion" id="syntax-accordion">
      <Card>
        <CardHeader onClick={toggle}>
          <button className="btn btn-link" type="button">
            <h5>{title}</h5>
          </button>
        </CardHeader>
        <Collapse isOpen={expanded}>
          <CardBody>{children}</CardBody>
        </Collapse>
      </Card>
    </div>
  );
};

export default Accordion;
