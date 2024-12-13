import React, { useCallback, useContext, useState } from 'react';
import { Col } from 'components/base/Layout';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import CubeContext from 'contexts/CubeContext';
import Collapse from 'components/base/Collapse';

interface CompareCollapseProps {
  isOpen: boolean;
}

const CompareCollapse: React.FC<CompareCollapseProps> = ({ isOpen }) => {
  const { cube } = useContext(CubeContext);
  const [compareID, setCompareID] = useState('');
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setCompareID(event.target.value),
    [],
  );

  const targetUrl = `/cube/compare/${cube.id}/to/${compareID}`;

  return (
    <Collapse isOpen={isOpen}>
      <Col xs={12}>
        <Input
          type="text"
          className="mb-2 me-2"
          placeholder="Comparison Cube ID"
          value={compareID}
          onChange={handleChange}
        />
      </Col>
      <Col>
        <Button color="accent" className="mb-2" href={targetUrl}>
          Compare cubes
        </Button>
      </Col>
    </Collapse>
  );
};

export default CompareCollapse;
