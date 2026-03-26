import React, { useContext } from 'react';

import Cube, { CubeCards } from '@utils/datatypes/Cube';

import { Flexbox } from 'components/base/Layout';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import BoardsAndViewsSettings from 'components/settings/BoardsAndViewsSettings';
import CollaboratorsSettings from 'components/settings/CollaboratorsSettings';
import CustomSortsSettings from 'components/settings/CustomSortsSettings';
import DraftFormatsSettings from 'components/settings/DraftFormatsSettings';
import OptionsSettings from 'components/settings/OptionsSettings';
import OverviewSettings from 'components/settings/OverviewSettings';
import RestoreSettings from 'components/settings/RestoreSettings';
import SettingsNavbar from 'components/settings/SettingsNavbar';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import SettingsViewContext, { SettingsViewContextProvider } from 'contexts/SettingsViewContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface Version {
  versionId: string;
  timestamp: Date;
  isLatest: boolean;
}

interface CubeSettingsPageProps {
  cube: Cube;
  cards: CubeCards;
  versions?: Version[];
  followed: boolean;
  followersCount: number;
  priceOwned: number | null;
  pricePurchase: number | null;
}

const OWNER_ONLY_VIEWS = new Set(['overview', 'options']);

// Inner component that renders INSIDE CubeLayout (where CubeContextProvider is available)
// If CubeContextProvider is defined below, then isOwner would be a default value instead of actual computed boolean
const SettingsContent: React.FC<{ versions?: Version[] }> = ({ versions }) => {
  const settingsViewContext = useContext(SettingsViewContext);
  const { isOwner } = useContext(CubeContext);

  const rawView = settingsViewContext?.view || 'overview';
  // Redirect collaborators away from owner-only views
  const view = !isOwner && OWNER_ONLY_VIEWS.has(rawView) ? 'draft-formats' : rawView;

  let content;
  switch (view) {
    case 'options':
      content = <OptionsSettings />;
      break;
    case 'boards-and-views':
      content = <BoardsAndViewsSettings />;
      break;
    case 'custom-sorts':
      content = <CustomSortsSettings />;
      break;
    case 'draft-formats':
      content = <DraftFormatsSettings />;
      break;
    case 'collaborators':
      content = <CollaboratorsSettings />;
      break;
    case 'restore':
      content = <RestoreSettings versions={versions} />;
      break;
    case 'overview':
    default:
      content = <OverviewSettings />;
      break;
  }

  return (
    <Flexbox direction="col" gap="2" className="my-2">
      <DynamicFlash />
      <SettingsNavbar />
      {content}
    </Flexbox>
  );
};

const CubeSettingsPageContent: React.FC<CubeSettingsPageProps> = ({ cube, cards, versions }) => {
<<<<<<< HEAD
  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cards={cards} cube={cube} activeLink="overview">
          <SettingsContent versions={versions} />
=======
  const settingsViewContext = useContext(SettingsViewContext);
  const rawView = settingsViewContext?.view || 'overview';

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cards={cards} cube={cube} activeLink={rawView}>
          <SettingsContent versions={versions || []} />
>>>>>>> 52f38947 (bulk upload and draft format qol changes)
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

const CubeSettingsPage: React.FC<CubeSettingsPageProps> = (props) => {
  return (
    <SettingsViewContextProvider>
      <CubeSettingsPageContent {...props} />
    </SettingsViewContextProvider>
  );
};

export default RenderToRoot(CubeSettingsPage);
