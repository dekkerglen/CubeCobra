const express = require('express');
const fetch = require('node-fetch');
const events = require('events');
const Draft = require('../models/draft');
const util = require('../serverjs/util.js');
const secrets = require('../../cubecobrasecrets/secrets');

module.exports = (io) => {
  const router = express.Router();
  const eventEmitter = new events.EventEmitter();

  async function update(draftid, data) {
    await Promise.all(
      secrets.cluster.map((address) =>
        fetch(`${address}/draft/update/${draftid}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cobra-token': secrets.token,
          },
          body: JSON.stringify(data),
        }),
      ),
    );
  }

  io.sockets.on('connection', (socket) => {
    socket.on('register', (draft) => {
      socket.draft = draft;
      socket.join(draft);
      console.log(`${draft} connected.`);

      eventEmitter.on(socket.draft, () => {
        console.log('sending hello');
        io.emit('update', 'hello client');
      });
    });
  });

  router.post(
    '/update/:id',
    util.wrapAsyncApi(async (req, res) => {
      if (req.headers['cobra-token'] !== secrets.token) {
        res.status(401).send({
          success: 'true',
        });
      }
      console.log(`updated ${req.params.id}`);
      res.status(200).send({
        success: 'true',
      });
      eventEmitter.emit(req.params.id);
    }),
  );

  router.post('/pick/:id/:seat/:index', async (req, res) => {
    const draft = await Draft.findById(req.params.id);
    const seatIndex = req.params.seat;
    const pick = req.params.index;

    console.log(req.params);

    if (draft.seats[seatIndex].bot) {
      return res.status(400).send({
        message: 'Attempted to make a pick for a bot seat.',
        success: 'false',
      });
    }

    if (draft.seats[seatIndex].userid && req.user && !req.user._id.equals(draft.seats[seatIndex].userid)) {
      return res.status(401).send({
        message: 'Unauthorized: Must be logged in as correct user to pick for this seat.',
        success: 'false',
      });
    }

    await update(req.params.id, draft);

    // put draft pick logic here
    await Draft.updateOne({ _id: req.body._id }, req.body);

    return res.status(200).send({
      success: 'true',
    });
  });

  return router;
};
