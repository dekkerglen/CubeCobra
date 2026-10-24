import React, { Dispatch, useMemo } from 'react';

import Cube from '@utils/datatypes/Cube';

import useCoercedSelection from '../../hooks/useCoercedSelection';
import { getDraftFormatOptions } from '../../utils/draftFormats';
import Checkbox from '../base/Checkbox';
import { Flexbox } from '../base/Layout';
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
  const options = useMemo(
    () => getDraftFormatOptions(cube.formats, !cube.disableDraft),
    [cube.formats, cube.disableDraft],
  );

  useCoercedSelection(options, draftFormat, setDraftFormat);

  return (
    <Flexbox justify="between" direction="row" gap="2">
      {!alwaysOn && <Checkbox label="Use Asfans" checked={useAsfans} setChecked={setUseAsfans} />}
      <Select
        className="flex-grow"
        options={options}
        value={draftFormat}
        setValue={setDraftFormat}
        label="Draft Format for Asfans"
      />
    </Flexbox>
  );
};

export default AsfanDropdown;
