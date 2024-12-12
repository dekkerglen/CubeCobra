import React, { useContext, useMemo, useState } from 'react';
import Button from 'components/base/Button';
import Select from 'components/base/Select';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import CSRFForm from 'components/CSRFForm';
import UserContext from 'contexts/UserContext';

const UserThemeForm: React.FC = () => {
  const user = useContext(UserContext);
  const [selectedTheme, setSelectedTheme] = useState(user?.theme || 'default');
  const [hideFeaturedCubes, setHideFeaturedCubes] = useState(user?.hideFeatured || false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(
    () => ({ theme: selectedTheme, hideFeatured: `${hideFeaturedCubes}` }),
    [selectedTheme, hideFeaturedCubes],
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
        <Checkbox label="Hide featured cubes" checked={hideFeaturedCubes} setChecked={setHideFeaturedCubes} />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Update
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserThemeForm;
