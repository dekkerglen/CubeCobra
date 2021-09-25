const { eventEmitter } = require('./redis');
const { seatRef, seatsRef, draftRef, getCurrentPackCards, draftPlayersRef } = require('./multiplayerDrafting');

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

      const onSeatsUpdate = async (data) => {
        socket.emit('seats', data);
      };

      const onPlayersUpdate = async (data) => {
        socket.emit('players', data);
      };

      eventEmitter.on(seatsRef(draftId), onSeatsUpdate);
      eventEmitter.on(draftRef(draftId), onDraftUpdate);
      eventEmitter.on(draftPlayersRef(draftId), onPlayersUpdate);

      socket.on('disconnect', () => {
        eventEmitter.removeListener(seatsRef(draftId), onSeatsUpdate);
        eventEmitter.removeListener(draftRef(draftId), onDraftUpdate);
        eventEmitter.removeListener(draftPlayersRef(draftId), onPlayersUpdate);
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
