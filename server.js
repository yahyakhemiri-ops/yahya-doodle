const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

console.log("=== DIAGNOSTIC CHECK ===");
console.log("Server is running from:", __dirname);
console.log("Files the server can see:", fs.readdirSync(__dirname));
console.log("========================");

// Serve index.html directly from the same folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    socket.on('draw', (data) => socket.broadcast.emit('draw', data));
    socket.on('clear', () => socket.broadcast.emit('clear'));
    socket.on('chat', (message) => socket.broadcast.emit('chat', message));
});

http.listen(3000, () => {
    console.log('Server is online at http://localhost:3000');
});