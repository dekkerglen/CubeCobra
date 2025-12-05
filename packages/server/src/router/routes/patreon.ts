import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import crypto from 'crypto';
import Patron from 'dynamo/models/patron';
import User from 'dynamo/models/user';
import { oauth, patreon } from 'patreon';
import { handleRouteError, redirect } from 'serverutils/render';
import { ensureAuth } from 'src/router/middleware';

import { Request, Response } from '../../types/express';

const patreonOAuthClient = oauth(process.env.PATREON_CLIENT_ID || '', process.env.PATREON_CLIENT_SECRET || '');

const isValidPatreonSignature = (signature: string, body: any): boolean => {
  const hmac = crypto.createHmac('md5', process.env.PATREON_HOOK_SECRET || '');
  const data = hmac.update(JSON.stringify(body));
  const digest = data.digest('hex');

  return digest === signature;
};

export const unlinkHandler = async (req: Request, res: Response) => {
  try {
    await Patron.deleteById(req.user!.id);

    const user = await User.getById(req.user!.id);
    if (user) {
      user.roles = user.roles?.filter((role) => role !== UserRoles.PATRON);
      user.patron = undefined;
      await User.update(user);
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

    if (!isValidPatreonSignature(signature, req.body)) {
      return res.status(401).send({
        success: 'false',
      });
    }

    const { included, data } = req.body;

    const users = included.filter((item: any) => item.id === data.relationships.patron.data.id);

    if (users.length !== 1) {
      req.logger.error('Recieved a patreon hook with not exactly one user');
      return res.status(500).send({
        success: 'false',
      });
    }
    const email = users[0].attributes.email.toLowerCase();

    // if a patron with this email is already linked, we can't use it
    const document = await Patron.getByEmail(email);

    if (!document) {
      req.logger.error(`Recieved a patreon hook without a found email: "${email}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    const user = await User.getById(document.owner);

    if (!user) {
      req.logger.error(`Recieved a patreon hook without a found user: "${document.owner}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    if (action === 'pledges:update' || action === 'pledges:create') {
      const rewardId = data.relationships.reward.data.id;
      const rewards = included.filter((item: any) => item.id === rewardId);

      if (rewards.length === 0) {
        document.level = 0;
      } else {
        document.level = PatronLevels[rewards[0].attributes.title as keyof typeof PatronLevels];
      }

      document.status = PatronStatuses.ACTIVE;
      if (user.roles && !user.roles.includes(UserRoles.PATRON)) {
        user.roles.push(UserRoles.PATRON);
      }
    } else if (action === 'pledges:delete') {
      document.status = PatronStatuses.INACTIVE;
      if (user.roles) {
        user.roles = user.roles.filter((role) => role !== UserRoles.PATRON);
      }
    } else {
      req.logger.error(`Recieved an unsupported patreon hook action: "${action}"`);
      return res.status(500).send({
        success: 'false',
      });
    }

    await Patron.put(document);
    await User.update(user);

    return res.status(200).send({
      success: 'false',
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

  const patron = await Patron.getById(req.user!.id);

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
      const document = await Patron.getByEmail(email);

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

      await Patron.put(newPatron);

      const user = await User.getById(req.user!.id);
      if (user) {
        if (!user.roles?.includes(UserRoles.PATRON)) {
          user.roles?.push(UserRoles.PATRON);
        }
        await User.update(user);
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
