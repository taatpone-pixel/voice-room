const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {}; // roomCode -> { socketId: name }

io.on('connection', (socket) => {
  socket.on('join', ({ room, name }) => {
    socket.join(room);
    socket.data.room = room;
    socket.data.name = name;
    rooms[room] = rooms[room] || {};
    const others = Object.entries(rooms[room]).map(([id, n]) => ({ id, name: n }));
    rooms[room][socket.id] = name;
    socket.emit('existing-users', others);
    socket.to(room).emit('user-joined', { id: socket.id, name });
  });

  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, name: socket.data.name, data });
  });

  const leave = () => {
    const room = socket.data.room;
    if (room && rooms[room]) {
      delete rooms[room][socket.id];
      if (Object.keys(rooms[room]).length === 0) delete rooms[room];
      socket.to(room).emit('user-left', { id: socket.id });
    }
    socket.data.room = null;
  };

  socket.on('leave', leave);
  socket.on('disconnect', leave);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Voice rooms running on port ' + PORT));
