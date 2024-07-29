import React, { Dispatch, SetStateAction } from 'react';
import { InputGroup, InputGroupText, Input } from 'reactstrap';
import Cube from 'datatypes/Cube';

export interface AsfanDropdownProps {
  cube: Cube;
  alwaysOn?: boolean;
  useAsfans: boolean;
  setUseAsfans: Dispatch<SetStateAction<boolean>>;
  draftFormat: number;
  setDraftFormat: Dispatch<SetStateAction<number>>;
}

const AsfanDropdown: React.FC<AsfanDropdownProps> = ({
  cube,
  alwaysOn = false,
  useAsfans,
  setUseAsfans,
  draftFormat,
  setDraftFormat,
}) => {
  return (
    <InputGroup className="mb-3">
      {alwaysOn ? (
        <InputGroupText>Draft Format:</InputGroupText>
      ) : (
        <>
          <InputGroupText>Use Asfans</InputGroupText>
          <InputGroupText>
            <Input addon type="checkbox" checked={useAsfans} onChange={() => setUseAsfans(!useAsfans)} />
          </InputGroupText>
        </>
      )}
      <Input addon type="select" value={draftFormat} onChange={(e) => setDraftFormat(parseInt(e.target.value, 10))}>
        <option value={0}>Standard Draft Format</option>
        {cube.formats.length > 0 && <option disabled>Custom Formats</option>}
        {cube.formats.map((format, index) => (
          <option key={index} value={index}>
            {format.title}
          </option>
        ))}
      </Input>
    </InputGroup>
  );
};

export default AsfanDropdown;
