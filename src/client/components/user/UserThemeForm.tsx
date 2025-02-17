import React, { useContext, useMemo, useState } from 'react';

import { PrintFilter } from '../../../datatypes/Card';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import Checkbox from '../base/Checkbox';
import { Flexbox } from '../base/Layout';
import Select from '../base/Select';
import CSRFForm from '../CSRFForm';

const UserThemeForm: React.FC = () => {
  const user = useContext(UserContext);
  const [selectedTheme, setSelectedTheme] = useState(user?.theme || 'default');
  const [defaultPrinting, setDefaultPrinting] = useState(user?.defaultPrinting || PrintFilter.RECENT);
  const [hideFeaturedCubes, setHideFeaturedCubes] = useState(user?.hideFeatured || false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(
    () => ({ theme: selectedTheme, hideFeatured: `${hideFeaturedCubes}`, defaultPrinting }),
    [selectedTheme, hideFeaturedCubes, defaultPrinting],
  );

  return (
    <CSRFForm method="POST" action="/user/changedisplay" ref={formRef} formData={formData}>
      <Flexbox direction="col" gap="2">
        <Select
          label="Theme"
          id="theme"
          value={selectedTheme}
          setValue={(value) => setSelectedTheme(value)}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Select
          label="Default Printing (this applies when searching cards outside a cube)"
          value={formData.defaultPrinting}
          setValue={(value) => setDefaultPrinting(value as PrintFilter)}
          options={[
            { value: PrintFilter.RECENT, label: 'Most Recent' },
            { value: PrintFilter.FIRST, label: 'First' },
          ]}
        />
        <Checkbox label="Hide featured cubes" checked={hideFeaturedCubes} setChecked={setHideFeaturedCubes} />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Update
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserThemeForm;
