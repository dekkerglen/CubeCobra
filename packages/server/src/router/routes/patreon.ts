import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import crypto from 'crypto';
import { patronDao, userDao } from 'dynamo/daos';
import { oauth, patreon } from 'patreon';
import { ensureAuth } from 'router/middleware';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const patreonOAuthClient = oauth(process.env.PATREON_CLIENT_ID || '', process.env.PATREON_CLIENT_SECRET || '');

// Patreon's registered webhook URL is uppercase (`/PATREON/HOOK`). Express routes
// case-insensitively so the handler still runs, but `req.originalUrl` preserves the
// original casing. The body-parser `verify` hook that captures the raw request bytes
// (needed for HMAC signature verification) must therefore match case-insensitively —
// otherwise rawBody is never captured for the real (uppercase) requests and every event
// 401s. Prefix match tolerates a trailing query string.
export const isPatreonHookPath = (originalUrl: string): boolean =>
  originalUrl.toLowerCase().startsWith('/patreon/hook');

// Patreon signs the webhook with HMAC-MD5 over the exact raw bytes of the request body.
// We must verify against those raw bytes (captured by the body-parser `verify` hook) — a
// re-serialization of the parsed body (JSON.stringify) is not byte-exact and fails to match.
const isValidPatreonSignature = (signature: string | undefined, rawBody: Buffer | undefined): boolean => {
  if (!signature || !rawBody) {
    return false;
  }

  const digest = crypto
    .createHmac('md5', process.env.PATREON_HOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to avoid leaking timing information.
  const expected = Buffer.from(digest, 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
};

// The normalized state we derive from a webhook payload, regardless of API version.
type PledgeState = { email: string; active: boolean; level: number };

// Parses the current Patreon API v2 `members:*` webhook shape.
// The membership resource is `data` (type: "member"); the linked user and entitled tiers
// are in `included`. `patron_status` is the source of truth for whether the pledge is active.
const resolveMemberV2 = (action: string, body: any): PledgeState | null => {
  const { included, data } = body;
  if (!data || data.type !== 'member') {
    return null;
  }

  // Prefer the linked user's account email (matches what we store at link time); fall back
  // to the member email attribute.
  let email: string | undefined;
  const userId = data.relationships?.user?.data?.id;
  if (userId && Array.isArray(included)) {
    const user = included.find((item: any) => item.id === userId && item.type === 'user');
    email = user?.attributes?.email;
  }
  if (!email) {
    email = data.attributes?.email;
  }
  if (!email) {
    return null;
  }
  email = email.toLowerCase();

  // A member (pledge) deletion means the membership is gone → inactive.
  if (action === 'members:delete' || action === 'members:pledge:delete') {
    return { email, active: false, level: 0 };
  }

  // For create/update, trust patron_status rather than the event name.
  if (data.attributes?.patron_status !== 'active_patron') {
    return { email, active: false, level: 0 };
  }

  // Highest entitled tier determines the level.
  let level = PatronLevels['Patron'];
  const tierRefs = data.relationships?.currently_entitled_tiers?.data;
  if (Array.isArray(tierRefs) && tierRefs.length > 0 && Array.isArray(included)) {
    const levels = tierRefs
      .map((ref: any) => included.find((item: any) => item.id === ref.id && item.type === 'tier'))
      .map((tier: any) => (tier ? PatronLevels[tier.attributes?.title as keyof typeof PatronLevels] : undefined))
      .filter((l: any): l is number => typeof l === 'number');
    if (levels.length > 0) {
      level = Math.max(...levels);
    }
  }
  return { email, active: true, level };
};

// Parses the deprecated Patreon API v1 `pledges:*` webhook shape. Retained so any events
// still queued under the legacy triggers are processed correctly when the hook is resumed.
const resolvePledgeV1 = (action: string, body: any): PledgeState | null => {
  const { included, data } = body;
  const patronId = data?.relationships?.patron?.data?.id;
  if (!Array.isArray(included) || !patronId) {
    return null;
  }

  const users = included.filter((item: any) => item.id === patronId);
  if (users.length !== 1) {
    return null;
  }
  const email = users[0].attributes?.email?.toLowerCase();
  if (!email) {
    return null;
  }

  if (action === 'pledges:delete') {
    return { email, active: false, level: 0 };
  }

  let level = PatronLevels['Patron'];
  const rewardId = data.relationships?.reward?.data?.id;
  if (rewardId) {
    const rewards = included.filter((item: any) => item.id === rewardId);
    if (rewards.length > 0) {
      const mapped = PatronLevels[rewards[0].attributes?.title as keyof typeof PatronLevels];
      if (typeof mapped === 'number') {
        level = mapped;
      }
    }
  }
  return { email, active: true, level };
};

export const unlinkHandler = async (req: Request, res: Response) => {
  try {
    await patronDao.deleteById(req.user!.id);

    const user = await userDao.getByIdWithSensitiveData(req.user!.id);
    if (user) {
      user.roles = user.roles?.filter((role) => role !== UserRoles.PATRON);
      user.patron = undefined;
      await userDao.update(user as any);
    }

    req.flash('success', `Patron account has been unlinked.`);
    return redirect(req, res, '/user/account?nav=patreon');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/account?nav=patreon');
  }
};

export const hookHandler = async (req: Request, res: Response) => {
  try {
    const action = req.headers['x-patreon-event'] as string;
    const signature = req.headers['x-patreon-signature'] as string;

    if (!isValidPatreonSignature(signature, req.rawBody)) {
      return res.status(401).send({
        success: 'false',
      });
    }

    if (!req.body || !req.body.data) {
      req.logger.error('Recieved a patreon hook with no data');
      return res.status(200).send({
        success: 'false',
      });
    }

    // Resolve the payload into a version-agnostic state. `members:*` is the current v2
    // model; `pledges:*` is the deprecated v1 model, kept for any queued legacy events.
    let state: PledgeState | null;
    if (action?.startsWith('members:')) {
      state = resolveMemberV2(action, req.body);
    } else if (action?.startsWith('pledges:')) {
      state = resolvePledgeV1(action, req.body);
    } else {
      // Acknowledge unrelated events (e.g. posts:*) with a 2xx so Patreon does not retry.
      req.logger.error(`Recieved an unsupported patreon hook action: "${action}"`);
      return res.status(200).send({
        success: 'true',
      });
    }

    if (!state) {
      req.logger.error(`Recieved a patreon hook that could not be parsed: "${action}"`);
      return res.status(200).send({
        success: 'false',
      });
    }

    const document = await patronDao.getByEmail(state.email);

    if (!document) {
      req.logger.error(`Recieved a patreon hook without a found email: "${state.email}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    const user = await userDao.getByIdWithSensitiveData(document.owner);

    if (!user) {
      req.logger.error(`Recieved a patreon hook without a found user: "${document.owner}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    if (state.active) {
      document.status = PatronStatuses.ACTIVE;
      document.level = state.level;
      if (!user.roles) {
        user.roles = [UserRoles.PATRON];
      } else if (!user.roles.includes(UserRoles.PATRON)) {
        user.roles.push(UserRoles.PATRON);
      }
    } else {
      // Deactivate but preserve the last known level so the prior tier stays visible for
      // reporting; the perk gates only grant access while status is ACTIVE.
      document.status = PatronStatuses.INACTIVE;
      if (user.roles) {
        user.roles = user.roles.filter((role) => role !== UserRoles.PATRON);
      }
    }

    await patronDao.update(document);
    await userDao.update(user as any);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({
      success: 'false',
    });
  }
};

export const redirectHandler = async (req: Request, res: Response) => {
  const oauthGrantCode = req.query.code as string;

  const patron = await patronDao.getById(req.user!.id);

  // if this user is already a patron, error
  if (patron && patron.status === PatronStatuses.ACTIVE) {
    req.flash('danger', `A Patreon account has already been linked.`);
    return redirect(req, res, '/user/account?nav=patreon');
  }

  return patreonOAuthClient
    .getTokens(oauthGrantCode, process.env.PATREON_REDIRECT)
    .then((tokensResponse: any) => {
      const patreonAPIClient = patreon(tokensResponse.access_token);
      return patreonAPIClient('/current_user');
    })
    .then(async ({ rawJson }: any) => {
      // use email for unique key
      const email = rawJson.data.attributes.email.toLowerCase();

      // if a patron with this email is already linked, we can't use it
      const document = await patronDao.getByEmail(email);

      if (document) {
        req.flash(
          'danger',
          `This Patreon account has already been linked to another Cube Cobra account. If you think this was done by mistake, please contact us.`,
        );
        return redirect(req, res, '/user/account?nav=patreon');
      }

      const newPatron: any = {
        email,
        owner: req.user!.id,
        status: PatronStatuses.INACTIVE,
      };
      if (!rawJson.included) {
        req.flash('danger', `This Patreon account does not appear to be currently support Cube Cobra.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      const pledges = rawJson.included.filter((item: any) => item.type === 'pledge');

      if (pledges.length === 0) {
        req.flash('danger', `This Patreon account does not appear to be currently support Cube Cobra.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      if (pledges.length > 1) {
        req.flash('danger', `The server response from Patreon was malformed. Please contact us for more information.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      if (!pledges[0].relationships.reward || !pledges[0].relationships.reward.data) {
        newPatron.level = PatronLevels['Patron'];
      } else {
        const rewardId = pledges[0].relationships.reward.data.id;

        const rewards = rawJson.included.filter((item: any) => item.id === rewardId);

        if (rewards.length > 1) {
          req.flash(
            'danger',
            `The server response from Patreon was malformed, too many reward objects. Please contact us for more information.`,
          );
          return redirect(req, res, '/user/account?nav=patreon');
        }

        if (rewards.length === 0) {
          newPatron.level = PatronLevels['Patron'];
        } else {
          newPatron.level = PatronLevels[rewards[0].attributes.title as keyof typeof PatronLevels];
        }
      }

      newPatron.status = PatronStatuses.ACTIVE;

      await patronDao.put(newPatron);

      const user = await userDao.getByIdWithSensitiveData(req.user!.id);
      if (user) {
        if (!user.roles?.includes(UserRoles.PATRON)) {
          user.roles?.push(UserRoles.PATRON);
        }
        await userDao.update(user as any);
      }

      if (newPatron.level === 0) {
        req.flash(
          'warning',
          "Your pledge isn't tied to any support tiers. Choose an eligible tier on Patreon to get access to all your rewards.",
        );
      }
      req.flash('success', `Your Patreon account has successfully been linked.`);
      return redirect(req, res, '/user/account?nav=patreon');
    })
    .catch((err: any) => {
      console.error(err);
      req.logger.error(err.message, err.stack, JSON.stringify(err));

      req.flash('danger', `There was an error linking your Patreon account: ${err.message}`);
      return redirect(req, res, '/user/account?nav=patreon');
    });
};

export const routes = [
  {
    path: '/unlink',
    method: 'get',
    handler: [ensureAuth, unlinkHandler],
  },
  {
    path: '/hook',
    method: 'post',
    handler: [hookHandler],
  },
  {
    path: '/redirect',
    method: 'get',
    handler: [ensureAuth, redirectHandler],
  },
];
