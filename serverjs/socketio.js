const { eventEmitter } = require('./redis');
const { seatRef, lobbyOrderRef, lobbyPlayersRef, draftRef, getCurrentPackCards } = require('./multiplayerDrafting');

const setup = (io) => {
  io.on('connection', (socket) => {
    socket.on('joinRoom', (room) => {
      socket.join(room);

      // display a welcome message to the user who have joined a room
      socket.emit('message', `You joined ${room}`);

      // displays a joined room message to all other room users except that particular user
      socket.broadcast.to(room).emit('message', 'Another user joined');

      eventEmitter.on(room, (data) => {
        socket.emit('message', data);
      });
    });

    socket.on('joinLobby', ({ draftId }) => {
      const onDraftUpdate = async (data) => {
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
          socket.emit('seat', await getCurrentPackCards(pack));
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
