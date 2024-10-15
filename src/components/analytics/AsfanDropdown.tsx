import React, { Dispatch } from 'react';

import Cube from 'datatypes/Cube';
import { Flexbox } from '../base/Layout';
import Checkbox from '../base/Checkbox';
import Select from '../base/Select';

export interface AsfanDropdownProps {
  cube: Cube;
  alwaysOn?: boolean;
  useAsfans: boolean;
  setUseAsfans: Dispatch<boolean>;
  draftFormat: string;
  setDraftFormat: Dispatch<string>;
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
    <Flexbox justify="between" direction="row" gap="2">
      {!alwaysOn && <Checkbox label="Use Asfans" checked={useAsfans} setChecked={setUseAsfans} />}
      <Select
        className="flex-grow"
        options={cube.formats.map((format, index) => ({ value: index.toString(), label: format.title }))}
        value={draftFormat}
        setValue={setDraftFormat}
        label="Draft Format for Asfans"
      />
    </Flexbox>
  );
};

export default AsfanDropdown;
