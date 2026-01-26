import CubeType from '@utils/datatypes/Cube';
import Image from '@utils/datatypes/Image';
import { NotificationStatus } from '@utils/datatypes/Notification';
import User, { UserRoles, YourCubesSortOrder } from '@utils/datatypes/User';
import fs from 'fs';
import path from 'path';
import serialize from 'serialize-javascript';

import 'dotenv/config';

import { SortOrder } from '../dynamo/dao/CubeDynamoDao';
import { cubeDao, notificationDao } from '../dynamo/daos';
import { Request, Response } from '../types/express';
import { getBaseUrl } from './util';

interface BundleManifest {
  [key: string]: string;
}

let bundleManifest: BundleManifest | null = null;
const loadManifest = (): BundleManifest => {
  // Only load manifest in production
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

  if (!bundleManifest) {
    try {
      const manifestPath = path.join(__dirname, '../../public/manifest.json');
      bundleManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BundleManifest;
    } catch (err) {
      console.error('Failed to load bundle manifest, falling back to non-hashed filenames:', (err as Error).message);
      bundleManifest = {};
    }
  }
  return bundleManifest || {};
};

export const getCubesSortValues = (user: User): { sort: SortOrder; ascending: boolean } => {
  if (user.yourCubesSortOrder === YourCubesSortOrder.ALPHA) {
    return { sort: 'alphabetical', ascending: true };
  } else {
    return { sort: 'date', ascending: false };
  }
};

const getCubes = async (req: Request, callback: (cubes: CubeType[]) => void): Promise<void> => {
  if (!req.user) {
    callback([]);
  } else {
    const { sort, ascending } = getCubesSortValues(req.user);
    const query = await cubeDao.queryByOwner(req.user.id, sort, ascending, undefined, 36);
    callback(query.items);
  }
};

const redirect = (req: Request, res: Response, to: string): void => {
  if (req.session) {
    req.session.save(() => {
      res.redirect(to);
    });
  } else {
    res.redirect(to);
  }
};

const getBundlesForPage = (page: string): string[] => {
  const manifest = loadManifest();

  // Try to get hashed filenames from manifest, fall back to non-hashed
  const vendors = manifest['vendors'] || `/js/vendors.bundle.js`;
  const commons = manifest['commons'] || `/js/commons.bundle.js`;
  const pageBundleName = manifest[page] || `/js/${page}.bundle.js`;

  return [vendors, commons, pageBundleName];
};

const sha256 = async (data: string): Promise<string> => {
  const buffer = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');
  return hashHex;
};

interface MetadataItem {
  property: string;
  content: string;
}

interface RenderOptions {
  metadata?: MetadataItem[];
  title?: string;
  noindex?: boolean;
}

interface ReactProps {
  user?: {
    id: string;
    username: string;
    email?: string;
    about?: string;
    image?: Image;
    roles?: UserRoles[];
    theme?: string;
    hideFeatured?: boolean;
    hideTagColors?: boolean;
    cubes: CubeType[];
    notifications?: any[];
    defaultPrinting?: string;
    gridTightness?: string;
    autoBlog?: boolean;
    consentToHashedEmail?: boolean;
    email_token: string;
    yourCubesSortOrder?: YourCubesSortOrder;
  };
  nitroPayEnabled?: boolean;
  baseUrl?: string;
  captchaSiteKey?: string;
  csrfToken?: string;
  [key: string]: any;
}

const render = (
  req: Request,
  res: Response,
  page: string,
  reactProps: ReactProps = {},
  options: RenderOptions = {},
): void => {
  getCubes(req, async (cubes) => {
    if (req.user) {
      const notifications = await notificationDao.getByToAndStatus(req.user.id, NotificationStatus.UNREAD);

      reactProps.user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        image: req.user.image,
        roles: req.user.roles,
        theme: req.user.theme,
        hideFeatured: req.user.hideFeatured,
        hideTagColors: req.user.hideTagColors,
        cubes,
        notifications: notifications.items,
        defaultPrinting: req.user.defaultPrinting,
        gridTightness: req.user.gridTightness,
        autoBlog: req.user.autoBlog,
        consentToHashedEmail: req.user.consentToHashedEmail,
        email_token: req.user.consentToHashedEmail && req.user.email ? await sha256(req.user.email) : '',
        yourCubesSortOrder: req.user.yourCubesSortOrder,
      };
    }

    reactProps.nitroPayEnabled = process.env.NITROPAY_ENABLED === 'true';
    reactProps.baseUrl = getBaseUrl();
    reactProps.captchaSiteKey = process.env.CAPTCHA_SITE_KEY;
    if (res.locals.csrfToken) {
      reactProps.csrfToken = res.locals.csrfToken;
    }

    if (!options.metadata) {
      options.metadata = [];
    }
    if (!options.metadata.some((data) => data.property === 'og:image')) {
      options.metadata.push({
        property: 'og:image',
        content: '/content/sticker.png',
      });
    }

    try {
      const theme = (req && req.user && req.user.theme) || 'default';
      res.render('main', {
        reactHTML: null, // TODO renable ReactDOMServer.renderToString(React.createElement(page, reactProps)),
        reactProps: serialize(reactProps),
        bundles: getBundlesForPage(page),
        metadata: options.metadata,
        title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
        patron: req.user && (req.user.roles || []).includes(UserRoles.PATRON),
        notice: process.env.NOTICE,
        theme,
        noindex: options.noindex || false,
      });
    } catch {
      res.status(500).send('Error rendering page');
    }
  });
};

const handleRouteError = function (req: Request, res: Response, err: any, reroute: string): void {
  if (err instanceof Error === false) {
    err = new Error('Unknown error');
  }

  req.logger.error(err.message, err.stack);
  req.flash('danger', err.message);
  redirect(req, res, reroute);
};

export { handleRouteError, redirect, render };

export default {
  render,
  redirect,
  handleRouteError,
};
