import React, { useCallback, useContext, useState } from 'react';
import { Flexbox } from 'components/base/Layout';
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
      <Flexbox direction="row" gap="2" className="mt-2">
        <Input type="text" placeholder="Comparison Cube ID" value={compareID} onChange={handleChange} />
        <Button type="link" color="primary" href={targetUrl} block>
          Compare cubes
        </Button>
      </Flexbox>
    </Collapse>
  );
};

export default CompareCollapse;
