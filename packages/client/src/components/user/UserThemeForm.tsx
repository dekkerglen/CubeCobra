import React, { useContext, useMemo, useState } from 'react';

import { DefaultPrintingPreference, PrintingPreference } from '@utils/datatypes/Card';
import {
  DefaultGridTightnessPreference,
  DefaultYourCubesSortOrder,
  GridTightnessPreference,
  YourCubesSortOrder,
} from '@utils/datatypes/User';

import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import Checkbox from '../base/Checkbox';
import { Flexbox } from '../base/Layout';
import Select from '../base/Select';
import CSRFForm from '../CSRFForm';

const UserThemeForm: React.FC = () => {
  const user = useContext(UserContext);
  const [selectedTheme, setSelectedTheme] = useState(user?.theme || 'default');
  const [defaultPrinting, setDefaultPrinting] = useState(user?.defaultPrinting || DefaultPrintingPreference);
  const [gridTightness, setGridTightness] = useState(user?.gridTightness || DefaultGridTightnessPreference);
  const [autoBlog, setAutoblog] = useState(typeof user?.autoBlog !== 'undefined' ? user.autoBlog : false);
  const [yourCubesSortOrder, setYourCubesSortOrder] = useState(
    typeof user?.yourCubesSortOrder !== 'undefined' ? user.yourCubesSortOrder : DefaultYourCubesSortOrder,
  );
  const [hideFeaturedCubes, setHideFeaturedCubes] = useState(user?.hideFeatured || false);
  const [disableAnimations, setDisableAnimations] = useState(user?.disableAnimations || false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(
    () => ({
      theme: selectedTheme,
      hideFeatured: `${hideFeaturedCubes}`,
      defaultPrinting,
      gridTightness,
      autoBlog: `${autoBlog}`,
      yourCubesSortOrder: `${yourCubesSortOrder}`,
      disableAnimations: `${disableAnimations}`,
    }),
    [selectedTheme, hideFeaturedCubes, defaultPrinting, gridTightness, autoBlog, yourCubesSortOrder, disableAnimations],
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
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Select
          label="Default Printing (this applies when searching cards outside a cube)"
          value={formData.defaultPrinting}
          setValue={(value) => setDefaultPrinting(value as PrintingPreference)}
          options={[
            { value: PrintingPreference.RECENT, label: 'Most Recent' },
            { value: PrintingPreference.FIRST, label: 'First' },
          ]}
        />
        <Select
          label="Default grid tightness"
          value={formData.gridTightness}
          setValue={(value) => setGridTightness(value as GridTightnessPreference)}
          options={[
            { value: GridTightnessPreference.LOOSE, label: 'Loose' },
            { value: GridTightnessPreference.TIGHT, label: 'Tight (no space)' },
          ]}
        />
        <Checkbox label="Hide featured cubes" checked={hideFeaturedCubes} setChecked={setHideFeaturedCubes} />
        <Checkbox
          label="Check 'Create Blog posts' for cube change by default"
          checked={autoBlog}
          setChecked={setAutoblog}
        />
        <Checkbox label="Disable Animations" checked={disableAnimations} setChecked={setDisableAnimations} />
        <Select
          label="Your cubes sort order"
          value={formData.yourCubesSortOrder}
          setValue={(value) => setYourCubesSortOrder(value as YourCubesSortOrder)}
          options={[
            { value: YourCubesSortOrder.LASTUPDATED, label: 'Last updated date' },
            { value: YourCubesSortOrder.ALPHA, label: 'Alphabetical' },
          ]}
        />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Update
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserThemeForm;
