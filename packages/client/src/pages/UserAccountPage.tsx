import React from 'react';

import Cube from '@utils/datatypes/Cube';
import Patron from '@utils/datatypes/Patron';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import { TabbedView } from 'components/base/Tabs';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserAccountDeletion from 'components/user/UserAccountDeletion';
import UserEmailForm from 'components/user/UserEmailForm';
import UserPasswordForm from 'components/user/UserPasswordForm';
import UserPatreonConfig from 'components/user/UserPatreonConfig';
import UserProfile from 'components/user/UserProfile';
import UserThemeForm from 'components/user/UserThemeForm';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface UserAccountPageProps {
  defaultNav: string;
  patreonClientId: string;
  patreonRedirectUri: string;
  patron?: Patron;
  featured?: {
    cube: Cube;
    position: number;
  };
}

const UserAccountPage: React.FC<UserAccountPageProps> = ({ patreonClientId, patreonRedirectUri, patron, featured }) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <TabbedView
          activeTab={parseInt(activeTab || '0', 10)}
          tabs={[
            {
              label: 'Profile',
              onClick: () => setActiveTab('0'),
              content: (
                <CardBody>
                  <UserProfile />
                </CardBody>
              ),
            },
            {
              label: 'Change Password',
              onClick: () => setActiveTab('1'),
              content: (
                <CardBody>
                  <UserPasswordForm />
                </CardBody>
              ),
            },
            {
              label: 'Update Email',
              onClick: () => setActiveTab('2'),
              content: (
                <CardBody>
                  <UserEmailForm />
                </CardBody>
              ),
            },
            {
              label: 'Display Preferences',
              onClick: () => setActiveTab('3'),
              content: (
                <CardBody>
                  <UserThemeForm />
                </CardBody>
              ),
            },
            {
              label: 'Patreon Integration',
              onClick: () => setActiveTab('4'),
              content: patron ? (
                <CardBody>
                  <UserPatreonConfig patron={patron} featured={featured} />
                </CardBody>
              ) : (
                <CardBody>
                  <p>Your account is currently not linked to your Patreon account.</p>
                  <Button
                    type="link"
                    block
                    outline
                    color="primary"
                    href={`https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${patreonClientId}&redirect_uri=${encodeURIComponent(
                      patreonRedirectUri,
                    )}`}
                  >
                    Link Patreon Account
                  </Button>
                </CardBody>
              ),
            },
            {
              label: 'Delete Account',
              onClick: () => setActiveTab('5'),
              content: (
                <CardBody>
                  <UserAccountDeletion />
                </CardBody>
              ),
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(UserAccountPage);
