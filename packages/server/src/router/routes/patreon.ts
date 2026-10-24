import Patron, { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import crypto from 'crypto';
import { patronDao, userDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../types/express';

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
const isValidPatreonSignature = (
  secret: string,
  signature: string | undefined,
  rawBody: Buffer | undefined,
): boolean => {
  if (!secret || !signature || !rawBody) {
    return false;
  }

  const digest = crypto.createHmac('md5', secret).update(rawBody).digest('hex');

  // Constant-time comparison to avoid leaking timing information.
  const expected = Buffer.from(digest, 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
};

// The normalized state we derive from a webhook payload, regardless of API version.
// `patreonUserId` is Patreon's stable id for the pledging user; `email` is only the fallback
// for patron records linked before that id was stored.
type PledgeState = { patreonUserId?: string; email?: string; active: boolean; level: number };

// Maps a v2 member's highest currently entitled tier (resolved from `included`) to a
// PatronLevel. Falls back to the base 'Patron' level when no tier maps.
const levelFromEntitledTiers = (member: any, included: any): number => {
  const tierRefs = member.relationships?.currently_entitled_tiers?.data;
  if (Array.isArray(tierRefs) && tierRefs.length > 0 && Array.isArray(included)) {
    const levels = tierRefs
      .map((ref: any) => included.find((item: any) => item.id === ref.id && item.type === 'tier'))
      .map((tier: any) => (tier ? PatronLevels[tier.attributes?.title as keyof typeof PatronLevels] : undefined))
      .filter((l: any): l is number => typeof l === 'number');
    if (levels.length > 0) {
      return Math.max(...levels);
    }
  }
  return PatronLevels['Patron'];
};

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
  const userId: string | undefined = data.relationships?.user?.data?.id || undefined;
  if (userId && Array.isArray(included)) {
    const user = included.find((item: any) => item.id === userId && item.type === 'user');
    email = user?.attributes?.email;
  }
  if (!email) {
    email = data.attributes?.email;
  }
  if (!email && !userId) {
    return null;
  }
  const identity = { patreonUserId: userId, email: email?.toLowerCase() };

  // A member (pledge) deletion means the membership is gone → inactive.
  if (action === 'members:delete' || action === 'members:pledge:delete') {
    return { ...identity, active: false, level: 0 };
  }

  // For create/update, trust patron_status rather than the event name.
  if (data.attributes?.patron_status !== 'active_patron') {
    return { ...identity, active: false, level: 0 };
  }

  return { ...identity, active: true, level: levelFromEntitledTiers(data, included) };
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
    return { patreonUserId: patronId, email, active: false, level: 0 };
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
  return { patreonUserId: patronId, email, active: true, level };
};

// Finds the patron record a webhook is about. The Patreon user id is the reliable key: the
// email on a Patreon account can change, after which an email match would miss (leaving perks
// active after a cancellation). Records linked before the id was stored can only be found by
// email, and an email match on a record pinned to a different Patreon user is not this one.
const findPatronForPledge = async (state: PledgeState): Promise<Patron | undefined> => {
  if (state.patreonUserId) {
    const byId = await patronDao.getByPatreonUserId(state.patreonUserId);
    if (byId) {
      return byId;
    }
  }

  if (!state.email) {
    return undefined;
  }

  const byEmail = await patronDao.getByEmail(state.email);
  if (byEmail?.patreonUserId && state.patreonUserId && byEmail.patreonUserId !== state.patreonUserId) {
    return undefined;
  }
  return byEmail;
};

const PATREON_PAGE = '/user/account?nav=patreon';

// The OAuth `state` round-trips through Patreon and must come back to the session that started
// the link, so an attacker can't get their own Patreon grant attached to someone else's account.
type PatreonSession = { patreonOAuthState?: string };

// Starts linking: remembers a fresh `state` in the session and sends the user to Patreon.
export const linkHandler = async (req: Request, res: Response) => {
  const clientId = process.env.PATREON_CLIENT_ID;
  const redirectUri = process.env.PATREON_REDIRECT;
  if (!clientId || !redirectUri) {
    req.logger.error('Patreon linking is not configured (PATREON_CLIENT_ID / PATREON_REDIRECT)');
    req.flash('danger', `Linking Patreon accounts isn't available right now. Please try again later.`);
    return redirect(req, res, PATREON_PAGE);
  }

  const state = crypto.randomBytes(16).toString('hex');
  (req.session as unknown as PatreonSession).patreonOAuthState = state;

  const authorizeUrl =
    'https://www.patreon.com/oauth2/authorize?response_type=code' +
    `&scope=${encodeURIComponent('identity identity[email]')}` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  // redirect() saves the session first, so the state is stored before the user comes back.
  return redirect(req, res, authorizeUrl);
};

// Single use: whatever came back, the stored state is consumed.
const consumeOAuthState = (req: Request): boolean => {
  const session = req.session as unknown as PatreonSession | undefined;
  const expected = session?.patreonOAuthState;
  if (session) {
    delete session.patreonOAuthState;
  }

  const provided = req.query.state;
  if (!expected || typeof provided !== 'string') {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
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
    return redirect(req, res, PATREON_PAGE);
  } catch (err) {
    return handleRouteError(req, res, err as Error, PATREON_PAGE);
  }
};

export const hookHandler = async (req: Request, res: Response) => {
  try {
    const action = req.headers['x-patreon-event'] as string;
    const signature = req.headers['x-patreon-signature'] as string;

    // Without a secret every signature check would be an HMAC under an empty key, which anyone
    // can forge. Refuse instead; 503 lets Patreon retry once the secret is configured.
    const secret = process.env.PATREON_HOOK_SECRET ?? '';
    if (!secret.trim()) {
      req.logger.error('Rejected a patreon hook: PATREON_HOOK_SECRET is not set');
      return res.status(503).send({
        success: 'false',
      });
    }

    // While the webhook secret is being rotated in Patreon's portal, hooks may arrive signed with
    // either value; PATREON_HOOK_SECRET_PREVIOUS (when set) covers that window.
    const secrets = [secret, process.env.PATREON_HOOK_SECRET_PREVIOUS].filter(
      (value): value is string => !!value?.trim(),
    );
    if (!secrets.some((candidate) => isValidPatreonSignature(candidate, signature, req.rawBody))) {
      return res.status(401).send({
        success: 'false',
      });
    }

    if (!req.body || !req.body.data) {
      req.logger.error('Received a patreon hook with no data');
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
      // Not a fault — Patreon fans out every event type to the hook — so log at info.
      req.logger.info(`Received an unsupported patreon hook action: "${action}"`);
      return res.status(200).send({
        success: 'true',
      });
    }

    if (!state) {
      // Payload didn't resolve to a pledge state (e.g. missing email/member data). Expected
      // for some event shapes and not actionable on our side — info, not error.
      req.logger.info(`Received a patreon hook that could not be parsed: "${action}"`);
      return res.status(200).send({
        success: 'false',
      });
    }

    const document = await findPatronForPledge(state);

    if (!document) {
      // The pledging Patreon user has no linked Cube Cobra patron record (never linked, or
      // unlinked). A normal condition, not a server fault — log at info to keep it off the
      // error dashboard.
      req.logger.info(
        `Received a patreon hook without a linked patron: user "${state.patreonUserId ?? ''}", email "${state.email ?? ''}"`,
      );

      return res.status(200).send({
        success: 'false',
      });
    }

    const user = await userDao.getByIdWithSensitiveData(document.owner);

    if (!user) {
      req.logger.error(`Received a patreon hook without a found user: "${document.owner}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    // Pin legacy (email-only) records to the Patreon user the signed webhook names, so later
    // events still match after a Patreon email change.
    if (!document.patreonUserId && state.patreonUserId) {
      document.patreonUserId = state.patreonUserId;
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

// Exchanges an OAuth grant code for an access token (Patreon API v2).
const exchangePatreonCode = async (code: string): Promise<string> => {
  const response = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: process.env.PATREON_CLIENT_ID || '',
      client_secret: process.env.PATREON_CLIENT_SECRET || '',
      redirect_uri: process.env.PATREON_REDIRECT || '',
    }),
  });
  if (!response.ok) {
    throw new Error(`Patreon token exchange failed (${response.status}): ${await response.text()}`);
  }
  const json: any = await response.json();
  if (!json.access_token) {
    throw new Error('Patreon token exchange returned no access token');
  }
  return json.access_token;
};

// Fetches the authorizing user's identity plus their membership to our campaign (Patreon
// API v2). Without the `identity.memberships` scope, Patreon only returns the membership
// to the client owner's campaign, which is exactly the one we care about.
const fetchPatreonIdentity = async (accessToken: string): Promise<any> => {
  const params = new URLSearchParams({
    include: 'memberships,memberships.currently_entitled_tiers',
    'fields[user]': 'email',
    'fields[member]': 'patron_status',
    'fields[tier]': 'title',
  });
  const response = await fetch(`https://www.patreon.com/api/oauth2/v2/identity?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Patreon identity request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
};

export const redirectHandler = async (req: Request, res: Response) => {
  try {
    if (!consumeOAuthState(req)) {
      req.flash(
        'danger',
        `Your Patreon link request expired or didn't come from this browser. Please try linking again.`,
      );
      return redirect(req, res, PATREON_PAGE);
    }

    const oauthGrantCode = req.query.code as string;
    if (!oauthGrantCode || typeof oauthGrantCode !== 'string') {
      req.flash('danger', `Patreon did not return an authorization code. Please try linking again.`);
      return redirect(req, res, PATREON_PAGE);
    }

    const patron = await patronDao.getById(req.user!.id);

    // if this user is already a patron, error
    if (patron && patron.status === PatronStatuses.ACTIVE) {
      req.flash('danger', `A Patreon account has already been linked.`);
      return redirect(req, res, PATREON_PAGE);
    }

    const accessToken = await exchangePatreonCode(oauthGrantCode);
    const identity = await fetchPatreonIdentity(accessToken);

    // use email for unique key
    const rawEmail: string | undefined = identity.data?.attributes?.email;
    if (!rawEmail) {
      req.flash(
        'danger',
        `Patreon did not share an email address for this account. Please make sure your Patreon email is verified and try again.`,
      );
      return redirect(req, res, PATREON_PAGE);
    }
    const email = rawEmail.toLowerCase();
    const patreonUserId: string | undefined = identity.data?.id ? String(identity.data.id) : undefined;

    // if this Patreon account (by its id, or by email for records linked before ids were
    // stored) is already linked, we can't use it
    const document =
      (patreonUserId ? await patronDao.getByPatreonUserId(patreonUserId) : undefined) ??
      (await patronDao.getByEmail(email));

    if (document && document.owner !== req.user!.id) {
      req.flash(
        'danger',
        `This Patreon account has already been linked to another Cube Cobra account. If you think this was done by mistake, please contact us.`,
      );
      return redirect(req, res, PATREON_PAGE);
    }

    const included = Array.isArray(identity.included) ? identity.included : [];
    const member = included.find(
      (item: any) => item.type === 'member' && item.attributes?.patron_status === 'active_patron',
    );

    if (!member) {
      req.flash('danger', `This Patreon account does not appear to currently support Cube Cobra.`);
      return redirect(req, res, PATREON_PAGE);
    }

    const newPatron: any = {
      email,
      patreonUserId,
      owner: req.user!.id,
      status: PatronStatuses.ACTIVE,
      level: levelFromEntitledTiers(member, included),
    };

    await (patron ? patronDao.update({ ...patron, ...newPatron }) : patronDao.put(newPatron));

    const user = await userDao.getByIdWithSensitiveData(req.user!.id);
    if (user) {
      if (!user.roles) {
        user.roles = [UserRoles.PATRON];
      } else if (!user.roles.includes(UserRoles.PATRON)) {
        user.roles.push(UserRoles.PATRON);
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
    return redirect(req, res, PATREON_PAGE);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    req.logger.error(error.message, error.stack);

    req.flash('danger', `There was an error linking your Patreon account. Please try again or contact us.`);
    return redirect(req, res, PATREON_PAGE);
  }
};

export const routes = [
  {
    path: '/link',
    method: 'get',
    handler: [ensureAuth, linkHandler],
  },
  {
    // POST, not GET: a GET could be fired by an image tag in someone else's Markdown.
    path: '/unlink',
    method: 'post',
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
