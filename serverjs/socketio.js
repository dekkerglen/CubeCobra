const { eventEmitter } = require('./redis');
const {
  seatRef,
  lobbyOrderRef,
  lobbyPlayersRef,
  draftRef,
  getCurrentPackCards,
  getCurrentPackStepQueue,
} = require('./multiplayerDrafting');

const setup = (io) => {
  io.on('connection', (socket) => {
    socket.on('joinLobby', ({ draftId }) => {
      const onDraftUpdate = async (data) => {
        // eslint-disable-next-line no-console
        console.log('onDraftUpdate', data);
        socket.emit('draft', data);
      };

      const onLobbySeatsUpdate = async (data) => {
        socket.emit('lobbyseats', data);
      };

      const onLobbyPlayersUpdate = async (data) => {
        socket.emit('lobbyplayers', data);
      };

      eventEmitter.on(lobbyOrderRef(draftId), onLobbySeatsUpdate);
      eventEmitter.on(draftRef(draftId), onDraftUpdate);
      eventEmitter.on(lobbyPlayersRef(draftId), onLobbyPlayersUpdate);

      socket.on('disconnect', () => {
        eventEmitter.removeListener(lobbyOrderRef(draftId), onLobbySeatsUpdate);
        eventEmitter.removeListener(draftRef(draftId), onDraftUpdate);
        eventEmitter.removeListener(lobbyPlayersRef(draftId), onLobbyPlayersUpdate);
      });
    });

    socket.on('joinDraft', ({ draftId, seat }) => {
      const onSeatUpdate = async (data) => {
        if (data.length > 0) {
          const pack = data[data.length - 1];
          socket.emit('seat', {
            pack: await getCurrentPackCards(pack),
            steps: await getCurrentPackStepQueue(draftId, seat),
          });
        }
      };

      eventEmitter.on(seatRef(draftId, seat), onSeatUpdate);

      socket.on('disconnect', () => {
        eventEmitter.removeListener(seatRef(draftId, seat), onSeatUpdate);
      });
    });
  });
};

module.exports = {
  setup,
};
