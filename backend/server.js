const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

// Хелфчек для Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // В проде можно ограничить URL вашего фронтенда на Render
    methods: ["GET", "POST"]
  }
});

// Хранилище состояния в памяти (для демонстрации)
const activeUsers = new Map(); // socket.id -> { userId, avatarColor }
const userIdToSocket = new Map(); // userId -> socket.id
const groups = new Map(); // groupId -> { id, name, members: Set }

const AVATAR_COLORS = [
  'bg-red-500', 'bg-green-500', 'bg-blue-500', 
  'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'
];

io.on('connection', (socket) => {
  // 1. Генерация уникального ID вида user-xxxxx
  const uniqueHash = crypto.randomBytes(3).toString('hex');
  const userId = `user-${uniqueHash}`;
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const userData = { userId, avatarColor };
  activeUsers.set(socket.id, userData);
  userIdToSocket.set(userId, socket.id);

  // Отправляем пользователю его данные
  socket.emit('session-init', userData);

  // 2. Обработка создания/подключения к приватному чату (DM)
  socket.on('start-dm', ({ targetUserId }, callback) => {
    if (!userIdToSocket.has(targetUserId)) {
      return callback({ error: 'Пользователь не найден' });
    }
    
    // Создаем уникальную комнату для двух пользователей (сортируем ID для стабильности)
    const roomId = [userId, targetUserId].sort().join('--dm--');
    socket.join(roomId);
    
    // Подключаем второго пользователя к этой же комнате, если он онлайн
    const targetSocketId = userIdToSocket.get(targetUserId);
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.join(roomId);
    }

    callback({ roomId, targetUserId });
  });

  // 3. Обработка создания группового чата
  socket.on('create-group', ({ groupName }, callback) => {
    const groupId = `group-${crypto.randomBytes(4).toString('hex')}`;
    const groupColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    
    groups.set(groupId, {
      id: groupId,
      name: groupName,
      color: groupColor,
      members: new Set([userId])
    });

    socket.join(groupId);
    callback({ groupId, groupName, color: groupColor });
  });

  // 4. Отправка сообщений (как в DM, так и в группы)
  socket.on('send-message', ({ roomId, text }) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const messagePayload = {
      id: crypto.randomBytes(8).toString('hex'),
      roomId: roomId,
      senderId: user.userId,
      senderColor: user.avatarColor,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Транслируем сообщение всем участникам комнаты/группы
    io.to(roomId).emit('receive-message', messagePayload);
  });

  // 5. Отключение пользователя
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      userIdToSocket.delete(user.userId);
      activeUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Backend server routing grid traffic on port ${PORT}`);
});
