import React, { useCallback, useContext, useState } from 'react';

import CubeContext from '../../contexts/CubeContext';
import Button from '../base/Button';
import Collapse from '../base/Collapse';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';

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
        <Input
          type="text"
          placeholder="Comparison Cube ID"
          value={compareID}
          onChange={handleChange}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="link" color="primary" href={targetUrl} block>
          Compare cubes
        </Button>
      </Flexbox>
    </Collapse>
  );
};

export default CompareCollapse;
