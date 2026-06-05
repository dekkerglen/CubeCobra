import React from 'react';

import type { Icon as OcticonIcon } from '@primer/octicons-react';
import {
  ArrowLeftIcon,
  CodeIcon,
  FilterIcon,
  HeartIcon,
  MailIcon,
  MarkdownIcon,
  SyncIcon,
} from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import classNames from 'classnames';

import Banner from 'components/Banner';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';

export interface HelpLink {
  label: string;
  href: string;
  Icon: OcticonIcon;
}

export const HELP_LINKS: HelpLink[] = [
  { label: 'Filter Syntax', href: '/help/filters', Icon: FilterIcon },
  { label: 'Markdown Guide', href: '/help/markdown', Icon: MarkdownIcon },
  { label: 'API Docs', href: '/help/apidocs', Icon: CodeIcon },
  { label: 'Card Updates', href: '/help/cardupdates', Icon: SyncIcon },
  { label: 'Contact', href: '/help/contact', Icon: MailIcon },
  { label: 'Donate', href: '/help/donate', Icon: HeartIcon },
];

interface HelpLayoutProps {
  activeHref?: string;
  /** Set on pages with brief content (e.g. Contact, Donate) where the taper would extend past the content. */
  noTaper?: boolean;
  /** Hide ads/banner messages. Set on the donate page, where showing ads would be inappropriate. */
  noBanner?: boolean;
  children: React.ReactNode;
}

const HelpLayout: React.FC<HelpLayoutProps> = ({ activeHref, noTaper = false, noBanner = false, children }) => {
  return (
    <MainLayout useContainer={false} transparentNav>
      <div className="relative min-h-screen">
        <div className="absolute inset-x-0 top-0 h-screen overflow-hidden bg-bg-secondary pointer-events-none z-0">
          <img
            src={cdnUrl('/content/year_of_snake.webp')}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-left-top md:object-top select-none"
          />
          <div className="absolute inset-0 bg-bg-secondary/80" />
          {activeHref && !noTaper && (
            <div className="absolute inset-x-0 bottom-0 h-[25vh] bg-gradient-to-b from-transparent to-bg pointer-events-none" />
          )}
        </div>

        <a
          href="https://gracelwyart.myportfolio.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-20 right-3 text-xs text-button-text/70 hover:text-button-text underline-offset-2 hover:underline z-[15]"
        >
          Art by Grace Lam
        </a>

        <div className="relative z-10">
          <Container lg className="pt-28 pb-6 md:pt-36 md:pb-8">
            <div className="px-2">
              <Flexbox direction="row" gap="6" className="md:flex-row flex-col">
                <div className="md:w-60 md:flex-shrink-0">
                  <div className="md:sticky md:top-24">
                    <Flexbox direction="col" gap="3">
                      {/* Mobile: single back-to-help pill */}
                      <a
                        href="/help"
                        className="md:hidden inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold border bg-bg-secondary/40 backdrop-blur-sm text-button-text border-button-text/40 hover:bg-button-text/15 hover:border-button-text transition-colors w-fit"
                      >
                        <ArrowLeftIcon size={16} />
                        <span className="whitespace-nowrap">Back to Help</span>
                      </a>

                      {/* Desktop: full pill nav */}
                      <Flexbox direction="col" gap="2" className="hidden md:flex">
                        {HELP_LINKS.map(({ label, href, Icon }) => {
                          const active = activeHref === href;
                          return (
                            <a
                              key={href}
                              href={href}
                              aria-current={active ? 'page' : undefined}
                              className={classNames(
                                'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold border transition-colors',
                                active
                                  ? 'bg-button-text text-bg-secondary border-button-text'
                                  : 'bg-bg-secondary/40 backdrop-blur-sm text-button-text border-button-text/40 hover:bg-button-text/15 hover:border-button-text',
                              )}
                            >
                              <Icon size={16} />
                              <span className="whitespace-nowrap">{label}</span>
                            </a>
                          );
                        })}
                      </Flexbox>
                    </Flexbox>
                  </div>
                </div>

                <div className="flex-grow min-w-0">
                  <DynamicFlash />
                  {!noBanner && <Banner />}
                  <div className="mt-3">{children}</div>
                </div>
              </Flexbox>
            </div>
          </Container>
        </div>
      </div>
    </MainLayout>
  );
};

export default HelpLayout;
