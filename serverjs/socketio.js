const { eventEmitter } = require('./redis');
const { seatRef, getCurrentPackCards } = require('./multiplayerDrafting');

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

    socket.on('joinDraft', ({ draftId, seat }) => {
      const roomId = `draft${draftId}seat${seat}`;
      socket.join(roomId);

      // display a welcome message to the user who have joined a room
      socket.emit('message', `You joined ${roomId}`);

      // this fires when the seat queue has had changes, like a new pack pushed to it
      const onUpdate = async (data) => {
        if (data.length > 0) {
          const pack = data[data.length - 1];
          socket.emit('pack', await getCurrentPackCards(pack));
        }
      };

      eventEmitter.on(seatRef(draftId, seat), onUpdate);

      socket.on('disconnect', () => {
        eventEmitter.removeListener(seatRef(draftId, seat), onUpdate);
      });
    });
  });
};

module.exports = {
  setup,
};
