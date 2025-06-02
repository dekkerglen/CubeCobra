const express = require('express');

const { render, redirect } = require('../util/render');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { cardFromId } = require('../util/carddb');

import { CardPackageStatus } from '../datatypes/CardPackage';
import Package from '../dynamo/models/package';
const User = require('../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

/*
 * There is no index on the Packages table for Owner and sorted by Vote count. Thus in order
 * to get the packages sorted by vote count, we have to load all the packages for a user, filter
 * by keywords, and then sort them in memory. This is not ideal, but it is the best we can do until
 * an index is added.
 * TODO: Add secondary index for Owner and sorted by Vote count
 */
const getAllByOwnerSortedByVoteCount = async (ownerId, keywords, ascending) => {
  let packages = {
    items: [],
    lastKey: null,
  };

  //Get all packages for the owner into memory
  do {
    const result = await Package.queryByOwner(ownerId, packages.lastKey);

    packages.items.push(...result.items);
    packages.lastKey = result.lastKey;
  } while (packages.lastKey);

  const sortByVotes = (a, b) => {
    if (ascending) {
      return a.voters.length - b.voters.length;
    } else {
      return b.voters.length - a.voters.length;
    }
  };

  if (keywords) {
    const words = keywords?.toLowerCase()?.split(' ') || [];

    // all words must exist in the keywords
    const filterByKeywords = (a) => {
      //Check that ALL filtering word exists in the package keywords
      return words.filter((x) => a.keywords.includes(x)).length === words.length;
    };

    packages.items = packages.items.filter(filterByKeywords);
  }
  packages.items.sort(sortByVotes);

  return packages;
};

const getPackages = async (req, type, keywords, ascending, sort, lastKey) => {
  let packages = {
    items: [],
    lastKey,
  };

  if (type === 'u' && req.user) {
    if (sort === 'votes' || sort === '') {
      packages = await getAllByOwnerSortedByVoteCount(req.user.id, keywords, ascending);
    } else {
      packages = await Package.queryByOwnerSortedByDate(req.user.id, keywords, ascending, packages.lastKey);
    }
  } else {
    if (sort === 'votes' || sort === '') {
      packages = await Package.querySortedByVoteCount(type, keywords, ascending, packages.lastKey);
    } else {
      packages = await Package.querySortedByDate(type, keywords, ascending, packages.lastKey);
    }
  }

  return packages;
};

router.get('/', async (req, res) => {
  const type = req.query.t || CardPackageStatus.APPROVED;
  const keywords = req.query.kw || '';
  const ascending = req.query.a === 'true';
  const sort = req.query.s || 'votes';

  let packages = await getPackages(req, type, keywords, ascending, sort, null);

  return render(req, res, 'PackagesPage', {
    items: packages.items,
    lastKey: packages.lastKey,
  });
});

router.post('/getmore', async (req, res) => {
  const type = req.body.type || CardPackageStatus.APPROVED;
  const keywords = req.body.keywords || '';
  const ascending = req.body.ascending === 'true';
  const sort = req.body.sort || 'votes';
  let lastKey = req.body.lastKey;

  let packages = await getPackages(req, type, keywords, ascending, sort, lastKey);

  return res.status(200).send({
    packages: packages.items,
    lastKey: packages.lastKey,
  });
});

router.post('/submit', ensureAuth, async (req, res) => {
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

  const poster = await User.getById(req.user.id);
  if (!poster) {
    return res.status(400).send({
      success: 'false',
      message: 'You must be logged in to create a package.',
    });
  }

  const pack = {
    title: packageName,
    date: new Date().valueOf(),
    owner: poster.id,
    status: 's',
    cards,
    voters: [],
    keywords: packageName
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(' '),
  };

  for (const card of cards) {
    pack.keywords.push(
      ...cardFromId(card)
        .name_lower.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        .split(' '),
    );
  }

  // make distinct
  pack.keywords = pack.keywords.filter((value, index, self) => self.indexOf(value) === index);

  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
  });
});

router.get('/upvote/:id', ensureAuth, async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.voters = [...new Set([...pack.voters, req.user.id])];
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
    voters: pack.voters,
  });
});

router.get('/downvote/:id', ensureAuth, async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.voters = pack.voters.filter((voter) => voter !== req.user.id);
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
    voters: pack.voters,
  });
});

router.get('/approve/:id', ensureRole('Admin'), async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.status = CardPackageStatus.APPROVED;
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
  });
});

router.get('/unapprove/:id', ensureRole('Admin'), async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.status = CardPackageStatus.SUBMITTED;
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
  });
});

router.get('/remove/:id', ensureRole('Admin'), async (req, res) => {
  await Package.delete(req.params.id);

  return res.status(200).send({
    success: 'true',
  });
});

router.get('/:id', async (req, res) => {
  const pack = await Package.getById(req.params.id);

  if (!pack) {
    req.flash('danger', `Package not found`);
    return redirect(req, res, '/packages');
  }

  return render(req, res, 'PackagePage', {
    pack,
  });
});

router.get('/', (req, res) => {
  redirect(req, res, '/packages');
});

module.exports = router;
