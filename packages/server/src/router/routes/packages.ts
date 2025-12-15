import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import CardPackage, { CardPackageStatus } from '@utils/datatypes/CardPackage';
import { UserRoles } from '@utils/datatypes/User';
import { packageDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth, ensureRole } from 'router/middleware';
import { cardFromId } from 'serverutils/carddb';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

/*
 * There is no index on the Packages table for Owner and sorted by Vote count. Thus in order
 * to get the packages sorted by vote count, we have to load all the packages for a user, filter
 * by keywords, and then sort them in memory. This is not ideal, but it is the best we can do until
 * an index is added.
 * TODO: Add secondary index for Owner and sorted by Vote count
 */
const getAllByOwnerSortedByVoteCount = async (ownerId: string, keywords: string | undefined, ascending: boolean) => {
  const packages: {
    items: CardPackage[];
    lastKey: Record<string, NativeAttributeValue> | undefined;
  } = {
    items: [],
    lastKey: undefined,
  };

  // Get all packages for the owner into memory
  do {
    const result = await packageDao.queryByOwner(ownerId, packages.lastKey);

    packages.items.push(...(result.items || []));
    packages.lastKey = result.lastKey;
  } while (packages.lastKey);

  const sortByVotes = (a: CardPackage, b: CardPackage) => {
    if (ascending) {
      return a.voters.length - b.voters.length;
    } else {
      return b.voters.length - a.voters.length;
    }
  };

  if (keywords) {
    const words = keywords?.toLowerCase()?.split(' ') || [];

    // all words must exist in the keywords
    const filterByKeywords = (a: CardPackage) => {
      // Check that ALL filtering word exists in the package keywords
      return words.filter((x) => a.keywords.includes(x)).length === words.length;
    };

    packages.items = packages.items.filter(filterByKeywords);
  }
  packages.items.sort(sortByVotes);

  return packages;
};

const getPackages = async (
  req: Request,
  type: string,
  keywords: string | undefined,
  ascending: boolean,
  sort: string,
  lastKey: Record<string, NativeAttributeValue> | undefined,
) => {
  let packages: {
    items: CardPackage[];
    lastKey: Record<string, NativeAttributeValue> | undefined;
  } = {
    items: [],
    lastKey,
  };

  if (type === 'u' && req.user) {
    if (sort === 'votes' || sort === '') {
      packages = await getAllByOwnerSortedByVoteCount(req.user.id, keywords, ascending);
    } else {
      const result = await packageDao.queryByOwnerSortedByDate(
        req.user.id,
        keywords || '',
        ascending,
        packages.lastKey,
      );
      packages.items = result.items || [];
      packages.lastKey = result.lastKey;
    }
  } else {
    if (sort === 'votes' || sort === '') {
      const result = await packageDao.querySortedByVoteCount(
        type as CardPackageStatus,
        keywords || '',
        ascending,
        packages.lastKey,
      );
      packages.items = result.items || [];
      packages.lastKey = result.lastKey;
    } else {
      const result = await packageDao.querySortedByDate(
        type as CardPackageStatus,
        keywords || '',
        ascending,
        packages.lastKey,
      );
      packages.items = result.items || [];
      packages.lastKey = result.lastKey;
    }
  }

  return packages;
};

export const getIndexHandler = async (req: Request, res: Response) => {
  try {
    const type = (req.query.t as string) || CardPackageStatus.APPROVED;
    const keywords = (req.query.kw as string) || '';
    const ascending = req.query.a === 'true';
    const sort = (req.query.s as string) || 'votes';

    const packages = await getPackages(req, type, keywords, ascending, sort, undefined);

    return render(req, res, 'PackagesPage', {
      items: packages.items,
      lastKey: packages.lastKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const getMoreHandler = async (req: Request, res: Response) => {
  try {
    const type = req.body.type || CardPackageStatus.APPROVED;
    const keywords = req.body.keywords || '';
    const ascending = req.body.ascending === 'true';
    const sort = req.body.sort || 'votes';
    const lastKey = req.body.lastKey;

    const packages = await getPackages(req, type, keywords, ascending, sort, lastKey);

    return res.status(200).send({
      packages: packages.items,
      lastKey: packages.lastKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const submitHandler = async (req: Request, res: Response) => {
  try {
    const { cards, packageName } = req.body;

    if (typeof packageName !== 'string' || packageName.length === 0) {
      return res.status(400).send({
        success: 'false',
        message: 'Please provide a name for your new package.',
      });
    }

    if (!Array.isArray(cards) || cards.length < 2) {
      return res.status(400).send({
        success: 'false',
        message: 'Please provide more than one card for your package.',
      });
    }

    if (cards.length > 100) {
      return res.status(400).send({
        success: 'false',
        message: 'Packages cannot be more than 100 cards.',
      });
    }

    if (!req.user) {
      return res.status(400).send({
        success: 'false',
        message: 'You must be logged in to create a package.',
      });
    }

    const poster = await userDao.getById(req.user.id);
    if (!poster) {
      return res.status(400).send({
        success: 'false',
        message: 'You must be logged in to create a package.',
      });
    }

    const keywords = packageName
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(' ');

    for (const card of cards) {
      keywords.push(
        ...cardFromId(card)
          .name_lower.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
          .split(' '),
      );
    }

    // make distinct
    const distinctKeywords = keywords.filter((value, index, self) => self.indexOf(value) === index);

    await packageDao.createPackage({
      title: packageName,
      date: Date.now(),
      owner: poster.id,
      status: 's' as CardPackageStatus,
      cards,
      voters: [],
      keywords: distinctKeywords,
    });

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const upvoteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'You must be logged in to upvote.',
      });
    }

    pack.voters = [...new Set([...pack.voters, req.user.id])];
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
      voters: pack.voters,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const downvoteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'You must be logged in to downvote.',
      });
    }

    pack.voters = pack.voters.filter((voter: string) => voter !== req.user!.id);
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
      voters: pack.voters,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const approveHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    pack.status = CardPackageStatus.APPROVED;
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const unapproveHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    pack.status = CardPackageStatus.SUBMITTED;
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const removeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);
    if (pack) {
      await packageDao.delete(pack);
    }

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const getPackageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid package ID');
      return redirect(req, res, '/packages');
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      req.flash('danger', `Package not found`);
      return redirect(req, res, '/packages');
    }

    return render(req, res, 'PackagePage', {
      pack,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [csrfProtection, getIndexHandler],
  },
  {
    path: '/getmore',
    method: 'post',
    handler: [csrfProtection, getMoreHandler],
  },
  {
    path: '/submit',
    method: 'post',
    handler: [ensureAuth, csrfProtection, submitHandler],
  },
  {
    path: '/upvote/:id',
    method: 'get',
    handler: [ensureAuth, csrfProtection, upvoteHandler],
  },
  {
    path: '/downvote/:id',
    method: 'get',
    handler: [ensureAuth, csrfProtection, downvoteHandler],
  },
  {
    path: '/approve/:id',
    method: 'get',
    handler: [ensureRole(UserRoles.ADMIN), csrfProtection, approveHandler],
  },
  {
    path: '/unapprove/:id',
    method: 'get',
    handler: [ensureRole(UserRoles.ADMIN), csrfProtection, unapproveHandler],
  },
  {
    path: '/remove/:id',
    method: 'get',
    handler: [ensureRole(UserRoles.ADMIN), csrfProtection, removeHandler],
  },
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, getPackageHandler],
  },
];
