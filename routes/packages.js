const express = require('express');

const { render } = require('../serverjs/render');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const carddb = require('../serverjs/carddb');

const Package = require('../dynamo/models/package');
const User = require('../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

router.get('/browse', async (req, res) => {
  return res.redirect('/packages/approved');
});

router.get('/approved', async (req, res) => {
  const packages = await Package.querySortedByVoteCount(Package.STATUSES.APPROVED, '', false);

  return render(req, res, 'ApprovedPackagesPage', {
    items: packages.items,
    lastKey: packages.lastKey,
  });
});

router.post('/getmoreapproved', async (req, res) => {
  const { keywords, lastKey, ascending, sort } = req.body;

  let packages = [];

  if (sort === 'votes') {
    packages = await Package.querySortedByVoteCount(Package.STATUSES.APPROVED, keywords, ascending, lastKey);
  } else {
    packages = await Package.querySortedByDate(Package.STATUSES.APPROVED, keywords, ascending, lastKey);
  }

  return res.status(200).send({
    packages: packages.items,
    lastKey: packages.lastKey,
  });
});

router.get('/submitted', async (req, res) => {
  const packages = await Package.querySortedByDate(Package.STATUSES.SUBMITTED, '', false);

  return render(req, res, 'SubmittedPackagesPage', {
    items: packages.items,
    lastKey: packages.lastKey,
  });
});

router.post('/getmoresubmitted', async (req, res) => {
  const { keywords, lastKey, ascending, sort } = req.body;

  let packages = [];

  if (sort === 'votes') {
    packages = await Package.querySortedByVoteCount(Package.STATUSES.SUBMITTED, keywords, ascending, lastKey);
  } else {
    packages = await Package.querySortedByDate(Package.STATUSES.SUBMITTED, keywords, ascending, lastKey);
  }

  return res.status(200).send({
    packages: packages.items,
    lastKey: packages.lastKey,
  });
});

router.get('/user', async (req, res) => {
  if (!req.user) {
    req.flash('danger', 'You must be logged in to view your packages.');
    return res.redirect('/404');
  }
  const packages = await Package.queryByOwner(req.user.id);

  return render(req, res, 'UserPackagesPage', {
    items: packages.items,
    lastKey: packages.lastKey,
  });
});

router.post('/getmoreuser', async (req, res) => {
  const { lastKey } = req.body;

  const packages = await Package.queryByOwner(req.user.id, lastKey);

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
      ...carddb
        .cardFromId(card)
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
  res.redirect('/packages/browse');
});

module.exports = router;
