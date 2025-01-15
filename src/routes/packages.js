const express = require('express');

const { render, redirect } = require('../util/render');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { cardFromId } = require('../util/carddb');

const Package = require('../dynamo/models/package');
const User = require('../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

const getPackages = async (req, type, keywords, ascending, sort, lastKey) => {
  let packages = {
    items: [],
    lastKey,
  };

  if (type === 'u' && req.user) {
    do {
      const result = await Package.queryByOwner(req.user.id, packages.lastKey);

      packages.items.push(...result.items);
      packages.lastKey = result.lastKey;
    } while (packages.lastKey);

    if (sort === 'votes' || sort === '') {
      packages.items.sort((a, b) => {
        if (ascending) {
          return a.voters.length - b.voters.length;
        } else {
          return b.voters.length - a.voters.length;
        }
      });
    } else {
      packages.items.sort((a, b) => {
        if (ascending) {
          return a.date - b.date;
        } else {
          return b.date - a.date;
        }
      });
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
  const type = req.query.t || Package.STATUSES.APPROVED;
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
  const type = req.body.type || Package.STATUSES.APPROVED;
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

  pack.status = Package.STATUSES.APPROVED;
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
  });
});

router.get('/unapprove/:id', ensureRole('Admin'), async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.status = Package.STATUSES.SUBMITTED;
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
  return render(req, res, 'PackagePage', {
    pack: await Package.getById(req.params.id),
  });
});

router.get('/', (req, res) => {
  redirect(req, res, '/packages');
});

module.exports = router;
