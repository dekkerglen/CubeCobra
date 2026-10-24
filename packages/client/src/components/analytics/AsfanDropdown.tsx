import React, { Dispatch, useEffect, useMemo } from 'react';

import Cube from '@utils/datatypes/Cube';

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
  const options = useMemo(() => {
    const customFormats = (cube.formats ?? []).map((format, index) => ({
      value: index.toString(),
      label: format.title || `Format ${index + 1}`,
    }));

    // -1 is the sentinel for the built-in 3x15 pack structure. Hide it when the cube has
    // standard draft turned off, unless there is no custom format to analyze instead.
    if (cube.disableDraft && customFormats.length > 0) {
      return customFormats;
    }

    return [{ value: '-1', label: 'Standard Draft' }, ...customFormats];
  }, [cube.formats, cube.disableDraft]);

  // The selection can come from a query param, so it may name a format this cube no longer
  // offers. Fall back to the first available option rather than rendering a blank select
  // while the analysis quietly uses a different format.
  useEffect(() => {
    const firstOption = options[0];
    if (firstOption && !options.some((option) => option.value === draftFormat)) {
      setDraftFormat(firstOption.value);
    }
  }, [options, draftFormat, setDraftFormat]);

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
