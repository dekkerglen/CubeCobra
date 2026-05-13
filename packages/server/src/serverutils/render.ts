import { cdnUrl } from '@utils/cdnUrl';
import CubeType from '@utils/datatypes/Cube';
import Image from '@utils/datatypes/Image';
import { NotificationStatus } from '@utils/datatypes/Notification';
import User, { UserRoles, YourCubesSortOrder } from '@utils/datatypes/User';
import fs from 'fs';
import path from 'path';
import serialize from 'serialize-javascript';

import 'dotenv/config';

import { SortOrder } from '../dynamo/dao/CubeDynamoDao';
import { collaboratorIndexDao, cubeDao, notificationDao } from '../dynamo/daos';
import { Request, Response } from '../types/express';
import { GIT_COMMIT } from './git';
import { getBaseUrl } from './util';

interface BundleManifest {
  [key: string]: string | { [key: string]: string } | undefined;
  css?: { [key: string]: string };
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

const trimCube = (cube: CubeType): Pick<CubeType, 'id' | 'shortId' | 'name'> => ({
  id: cube.id,
  shortId: cube.shortId,
  name: cube.name,
});

const getCubes = async (req: Request, callback: (cubes: CubeType[]) => void): Promise<void> => {
  if (!req.user) {
    callback([]);
  } else {
    const { sort, ascending } = getCubesSortValues(req.user);
    const query = await cubeDao.queryByOwner(req.user.id, sort, ascending, undefined, 10);
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

  // Try to get hashed filenames from manifest, fall back to non-hashed.
  // cdnUrl prepends CDN_BASE_URL when set (prod with CloudFront), otherwise
  // returns the same-origin path that Express serves from public/.
  const vendors = cdnUrl((manifest['vendors'] as string) || `/js/vendors.bundle.js`);
  const commons = cdnUrl((manifest['commons'] as string) || `/js/commons.bundle.js`);
  const pageBundleName = cdnUrl((manifest[page] as string) || `/js/${page}.bundle.js`);

  return [vendors, commons, pageBundleName];
};

const CSS_BUNDLE_NAMES = ['stylesheet', 'autocomplete', 'editcube', 'tags'] as const;
type CssBundleName = (typeof CSS_BUNDLE_NAMES)[number];
type CssBundles = Record<CssBundleName, string>;

const getCssBundles = (): CssBundles => {
  const manifest = loadManifest();
  const cssMap = manifest.css || {};
  return CSS_BUNDLE_NAMES.reduce((acc, name) => {
    // In dev (no manifest), fall back to the un-hashed file with a commit
    // query string so a browser refresh after a deploy picks up changes.
    acc[name] = cdnUrl(cssMap[name] || `/css/${name}.css?v=${GIT_COMMIT}`);
    return acc;
  }, {} as CssBundles);
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
    cubes: Pick<CubeType, 'id' | 'shortId' | 'name'>[];
    collaboratingCubes?: Pick<CubeType, 'id' | 'shortId' | 'name'>[];
    notifications?: any[];
    defaultPrinting?: string;
    gridTightness?: string;
    autoBlog?: boolean;
    consentToHashedEmail?: boolean;
    email_token: string;
    yourCubesSortOrder?: YourCubesSortOrder;
    disableAnimations?: boolean;
    useTextOverIcons?: boolean;
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
      const [notifications, collaboratingCubeIds] = await Promise.all([
        notificationDao.getByToAndStatus(req.user.id, NotificationStatus.UNREAD),
        collaboratorIndexDao.getCubeIdsForUser(req.user.id),
      ]);
      const collaboratingCubes = collaboratingCubeIds.length > 0 ? await cubeDao.batchGet(collaboratingCubeIds) : [];

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
        cubes: cubes.map(trimCube),
        collaboratingCubes: collaboratingCubes.map(trimCube),
        notifications: notifications.items,
        defaultPrinting: req.user.defaultPrinting,
        gridTightness: req.user.gridTightness,
        autoBlog: req.user.autoBlog,
        consentToHashedEmail: req.user.consentToHashedEmail,
        email_token: req.user.consentToHashedEmail && req.user.email ? await sha256(req.user.email) : '',
        yourCubesSortOrder: req.user.yourCubesSortOrder,
        disableAnimations: req.user.disableAnimations,
        useTextOverIcons: req.user.useTextOverIcons,
      };
    }

    reactProps.nitroPayEnabled = process.env.NITROPAY_ENABLED === 'true';
    reactProps.baseUrl = getBaseUrl();
    reactProps.cdnBaseUrl = process.env.CDN_BASE_URL || '';
    reactProps.captchaSiteKey = process.env.CAPTCHA_SITE_KEY;
    if (res.locals.csrfToken) {
      reactProps.csrfToken = res.locals.csrfToken;
    }

    if (!options.metadata) {
      options.metadata = [];
    }
    // og:image must be an absolute URL for crawlers; baseUrl + cdnUrl handles
    // both cases (CloudFront when CDN_BASE_URL is set, otherwise same-origin).
    const stickerPath = cdnUrl('/content/sticker.png');
    const fallbackImage = stickerPath.startsWith('http') ? stickerPath : `${getBaseUrl()}${stickerPath}`;
    const existingOgImage = options.metadata.find((data) => data.property === 'og:image');
    if (!existingOgImage) {
      options.metadata.push({ property: 'og:image', content: fallbackImage });
    } else if (!existingOgImage.content) {
      existingOgImage.content = fallbackImage;
    }
    // Mirror the fallback onto twitter:image so both crawlers get a usable image.
    const existingTwitterImage = options.metadata.find((data) => data.property === 'twitter:image');
    if (existingTwitterImage && !existingTwitterImage.content) {
      existingTwitterImage.content = fallbackImage;
    }

    try {
      const theme = (req && req.user && req.user.theme) || 'system';
      const disableAnimations = req && req.user && req.user.disableAnimations;
      const htmlClasses = [theme, disableAnimations && 'disable-animations'].filter(Boolean).join(' ');
      res.render('main', {
        reactHTML: null, // TODO renable ReactDOMServer.renderToString(React.createElement(page, reactProps)),
        reactProps: serialize(reactProps),
        bundles: getBundlesForPage(page),
        cssBundles: getCssBundles(),
        metadata: options.metadata,
        title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
        patron: req.user && (req.user.roles || []).includes(UserRoles.PATRON),
        notice: process.env.NOTICE,
        theme,
        htmlClasses,
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
