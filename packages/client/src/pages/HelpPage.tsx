import React from 'react';

import type { Icon as OcticonIcon } from '@primer/octicons-react';
import { BookIcon, CodeIcon, FilterIcon, HeartIcon, MailIcon, MarkdownIcon, SyncIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';

import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface HelpLink {
  label: string;
  href: string;
  description: string;
  Icon: OcticonIcon;
}

const HELP_LINKS: HelpLink[] = [
  {
    label: 'Wiki',
    href: '/wiki',
    description: 'Guides and how-tos for building cubes, drafting, and using the site.',
    Icon: BookIcon,
  },
  {
    label: 'Filter Syntax',
    href: '/wiki/reference/filter-syntax',
    description: 'Reference for the search syntax used throughout cube and card search.',
    Icon: FilterIcon,
  },
  {
    label: 'Markdown Guide',
    href: '/wiki/reference/markdown',
    description: 'How to format blog posts, comments, and cube descriptions with Markdown.',
    Icon: MarkdownIcon,
  },
  {
    label: 'API Docs',
    href: '/help/apidocs',
    description: 'Reference for the public-facing Cube Cobra API endpoints.',
    Icon: CodeIcon,
  },
  {
    label: 'Card Updates',
    href: '/help/cardupdates',
    description: 'Recent additions and changes to the card database.',
    Icon: SyncIcon,
  },
  {
    label: 'Contact',
    href: '/help/contact',
    description: 'Get in touch with the Cube Cobra team for help or feedback.',
    Icon: MailIcon,
  },
  {
    label: 'Donate',
    href: '/help/donate',
    description: 'Support Cube Cobra and help keep the site running.',
    Icon: HeartIcon,
  },
];

const HeroLinkCard: React.FC<HelpLink> = ({ label, href, description, Icon }) => {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex flex-col items-center text-center gap-2 p-4 rounded-lg border border-button-text/30 bg-bg-secondary/40 backdrop-blur-sm text-button-text hover:bg-bg-secondary/70 hover:border-button-text transition-colors"
    >
      <Icon size={32} />
      <Text lg semibold className="!text-button-text">
        {label}
      </Text>
      <Text sm className="text-button-text/70">
        {description}
      </Text>
    </a>
  );
};

const HelpPage: React.FC = () => {
  return (
    <MainLayout useContainer={false} transparentNav>
      <div className="relative w-full min-h-screen overflow-hidden bg-bg-secondary">
        <img
          src={cdnUrl('/content/year_of_snake.webp')}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover object-left-top md:object-top select-none pointer-events-none"
        />
        <div className="absolute inset-0 bg-bg-secondary/80" />

        <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-24">
          <div className="w-full max-w-5xl flex flex-col items-center text-center gap-10">
            <div>
              <Text xxxxl bold className="!text-button-text block">
                Help
              </Text>
              <p className="mt-2 text-base text-button-text/80">
                Guides, syntax references, and answers to common questions about using Cube Cobra.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {HELP_LINKS.map((link) => (
                <HeroLinkCard key={link.href} {...link} />
              ))}
            </div>
          </div>
        </div>

        <a
          href="https://gracelwyart.myportfolio.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-20 right-3 text-xs text-button-text/70 hover:text-button-text underline-offset-2 hover:underline z-[15]"
        >
          Art by Grace Lam
        </a>
      </div>
    </MainLayout>
  );
};

export default RenderToRoot(HelpPage);
