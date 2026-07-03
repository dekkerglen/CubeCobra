import React, { useContext } from 'react';

import type { Icon as OcticonIcon } from '@primer/octicons-react';
import { HeartIcon, ImageIcon, KeyIcon, MailIcon, PaintbrushIcon, PersonIcon, TrashIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import Patron from '@utils/datatypes/Patron';
import { canUseImageHosting } from '@utils/hostedImagesUtil';
import classNames from 'classnames';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserAccountDeletion from 'components/user/UserAccountDeletion';
import UserEmailForm from 'components/user/UserEmailForm';
import UserHostedImages from 'components/user/UserHostedImages';
import UserPasswordForm from 'components/user/UserPasswordForm';
import UserPatreonConfig from 'components/user/UserPatreonConfig';
import UserProfile from 'components/user/UserProfile';
import UserThemeForm from 'components/user/UserThemeForm';
import UserContext from 'contexts/UserContext';
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
  userEmail?: string;
}

interface AccountSection {
  key: string;
  label: string;
  description: string;
  Icon: OcticonIcon;
  render: (props: UserAccountPageProps) => React.ReactNode;
}

const SECTIONS: AccountSection[] = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Update your username, avatar, and bio.',
    Icon: PersonIcon,
    render: ({ userEmail }) => <UserProfile userEmail={userEmail} />,
  },
  {
    key: 'password',
    label: 'Change Password',
    description: 'Rotate your password and keep your account secure.',
    Icon: KeyIcon,
    render: () => <UserPasswordForm />,
  },
  {
    key: 'email',
    label: 'Update Email',
    description: 'Change the email address associated with your account.',
    Icon: MailIcon,
    render: ({ userEmail }) => <UserEmailForm currentEmail={userEmail} />,
  },
  {
    key: 'display',
    label: 'Display Preferences',
    description: 'Theme, animations, and other interface settings.',
    Icon: PaintbrushIcon,
    render: () => <UserThemeForm />,
  },
  {
    key: 'images',
    label: 'My Images',
    description: 'Upload and manage images hosted on Cube Cobra.',
    Icon: ImageIcon,
    render: () => <UserHostedImages />,
  },
  {
    key: 'patreon',
    label: 'Patreon Integration',
    description: 'Link your Patreon account and manage supporter perks.',
    Icon: HeartIcon,
    render: ({ patron, featured, patreonClientId, patreonRedirectUri }) =>
      patron ? (
        <UserPatreonConfig patron={patron} featured={featured} />
      ) : (
        <Flexbox direction="col" gap="3">
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
        </Flexbox>
      ),
  },
  {
    key: 'delete',
    label: 'Delete Account',
    description: 'Permanently remove your account and associated data.',
    Icon: TrashIcon,
    render: () => <UserAccountDeletion />,
  },
];

const TILE_CLASSES =
  'group flex flex-col items-center text-center gap-2 p-4 rounded-lg border border-border bg-bg-accent hover:bg-bg-active hover:border-border-active transition-colors cursor-pointer';

const SectionTile: React.FC<{ section: AccountSection; onClick: () => void }> = ({ section, onClick }) => (
  <a
    href={`?nav=${section.key}`}
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={TILE_CLASSES}
  >
    <section.Icon size={28} />
    <Text lg semibold>
      {section.label}
    </Text>
    <Text sm className="text-text-secondary">
      {section.description}
    </Text>
  </a>
);

const SectionPill: React.FC<{ section: AccountSection; active: boolean; onClick: () => void }> = ({
  section,
  active,
  onClick,
}) => (
  <a
    href={`?nav=${section.key}`}
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={classNames(
      'flex items-center gap-2 px-4 py-2.5 rounded-full border font-medium transition-colors whitespace-nowrap',
      {
        'bg-button-primary text-button-text border-button-primary': active,
        'bg-bg-accent text-text border-border hover:bg-bg-active hover:border-border-active': !active,
      },
    )}
  >
    <section.Icon size={16} />
    {section.label}
  </a>
);

const UserAccountPage: React.FC<UserAccountPageProps> = (props) => {
  const { defaultNav, patron } = props;
  const user = useContext(UserContext);
  const [active, setActive] = useQueryParam('nav', defaultNav || '');

  // The "My Images" section is a Lotus Cobra perk (or Admin).
  const canUploadImages = canUseImageHosting(patron, user?.roles);
  const sections = canUploadImages ? SECTIONS : SECTIONS.filter((s) => s.key !== 'images');

  const selected = sections.find((s) => s.key === active);

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />

      {!selected ? (
        <Container md className="px-4">
          <Flexbox direction="col" gap="5" className="my-6">
            <div className="text-center">
              <Text xxxxl bold className="block">
                Settings
              </Text>
              <p className="mt-1 text-base text-text-secondary">Choose a section to manage your account.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map((section) => (
                <SectionTile key={section.key} section={section} onClick={() => setActive(section.key)} />
              ))}
            </div>
          </Flexbox>
        </Container>
      ) : (
        <Container xxxl className="px-4">
          <Flexbox direction="col" gap="3" className="my-3">
            <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
              <div>
                <Flexbox direction="col" gap="2">
                  {sections.map((section) => (
                    <SectionPill
                      key={section.key}
                      section={section}
                      active={section.key === selected.key}
                      onClick={() => setActive(section.key)}
                    />
                  ))}
                </Flexbox>
              </div>
              <div className="min-w-0">
                <Card>
                  <CardHeader>
                    <Text xl bold>
                      {selected.label}
                    </Text>
                  </CardHeader>
                  <CardBody>{selected.render(props)}</CardBody>
                </Card>
              </div>
            </div>
          </Flexbox>
        </Container>
      )}
    </MainLayout>
  );
};

export default RenderToRoot(UserAccountPage);
