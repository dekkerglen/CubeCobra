const express = require('express');

const { render } = require('../serverjs/render');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const carddb = require('../serverjs/carddb');

const Package = require('../dynamo/models/package');
const User = require('../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

router.post('/getpackages', async (req, res) => {
  const { status, keywords, lastKey, ascending } = req.body;

  const packages = await Package.querySortedByDate(status, keywords, ascending, lastKey);

  return res.status(200).send({
    packages: packages.items,
    lastKey: packages.lastKey,
  });
});

router.get('/browse', async (req, res) => {
  return render(req, res, 'BrowsePackagesPage', {});
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
    votes: pack.votes,
  });
});

router.get('/downvote/:id', ensureAuth, async (req, res) => {
  const pack = await Package.getById(req.params.id);

  pack.voters = pack.voters.filter((voter) => voter !== req.user.id);
  await Package.put(pack);

  return res.status(200).send({
    success: 'true',
    votes: pack.votes,
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
