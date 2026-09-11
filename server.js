const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
    cors: { origin: "*" },
    transports: ['websocket'] 
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 200 Simple English Words
const words = [
    "apple","car","sun","moon","tree","book","pen","cat","dog","plane",
    "train","ship","sea","mountain","river","flower","door","window","chair","table",
    "bed","lamp","clock","glasses","shoes","shirt","pants","bag","hat","key",
    "phone","computer","tv","camera","picture","letter","envelope","paper","scissors","ruler",
    "eraser","notebook","school","university","hospital","doctor","nurse","police","soldier",
    "teacher","student","engineer","worker","farmer","baker","chef","restaurant","cafe","food",
    "water","milk","juice","tea","coffee","bread","cheese","egg","meat","chicken",
    "fish","rice","pasta","vegetables","fruit","banana","orange","grape","watermelon","strawberry",
    "sky","earth","star","cloud","rain","snow","wind","fire","smoke","wood",
    "iron","gold","silver","copper","glass","stone","sand","clay","forest","desert",
    "garden","road","bridge","tunnel","city","village","market","shop","money","coin",
    "bank","mosque","castle","palace","tent","wall","roof","floor","carpet","curtain",
    "mirror","painting","brush","soap","towel","comb","toothbrush","toothpaste","perfume","makeup",
    "medicine","pill","syringe","wound","blood","heart","mind","eye","ear","nose",
    "mouth","teeth","tongue","hair","face","hand","leg","foot","finger","nail",
    "bone","skin","smile","tear","laugh","scream","whisper","sound","color","red",
    "blue","green","yellow","black","white","brown","pink","purple","circle","square",
    "triangle","rectangle","line","dot","angle","shape","size","weight","height","width",
    "depth","distance","speed","time","second","minute","hour","day","week","month",
    "year","century","past","present","future","start","end", "mouse", "keyboard", "screen"
];

let players = {};
let currentWord = "";
let artistId = null;
let timer = 60;
let interval = null;
let gameState = "idle"; 

// Makes guessing case-insensitive
function cleanEnglish(text) {
    if (!text) return "";
    return text.toLowerCase().trim();
}

function updateLobby() {
    if (Object.keys(players).length < 2 && gameState !== "idle") {
        resetRound();
    }
    io.emit('lobbyState', { 
        playerCount: Object.keys(players).length, 
        gameState: gameState 
    });
}

function resetRound() {
    gameState = "idle";
    artistId = null;
    clearInterval(interval);
    io.emit('clear');
    updateLobby();
}

io.on('connection', (socket) => {
    players[socket.id] = { score: 0 };
    updateLobby();
    
    socket.on('requestStart', () => {
        if (gameState === "idle" && Object.keys(players).length >= 2) {
            gameState = "choosing";
            artistId = socket.id;
            updateLobby(); 
            
            for (let id in players) {
                io.to(id).emit('roleInfo', { role: (id === artistId) ? 'artist' : 'guesser' });
            }
            
            let choices = [];
            for(let i=0; i<3; i++) choices.push(words[Math.floor(Math.random() * words.length)]);
            
            io.to(artistId).emit('showWordChoices', choices);
            socket.broadcast.emit('systemMessage', "The Artist is choosing a word...");
            io.emit('clear');
        }
    });

    socket.on('wordChosen', (word) => {
        if (socket.id === artistId && gameState === "choosing") {
            currentWord = word;
            gameState = "playing";
            timer = 60;
            
            io.to(artistId).emit('wordToDraw', currentWord);
            socket.broadcast.emit('wordToDraw', "???");
            socket.broadcast.emit('systemMessage', "Time started! Guess the word now.");

            clearInterval(interval);
            interval = setInterval(() => {
                timer--;
                io.emit('timerUpdate', timer);
                if (timer <= 0) {
                    io.emit('systemMessage', `Time's up! The word was: ${currentWord}`);
                    setTimeout(resetRound, 4000);
                }
            }, 1000);
        }
    });
    
    socket.on('chat', (msg) => {
        const isArtist = (socket.id === artistId);
        const senderName = isArtist ? "Artist" : "Player";
        io.emit('chatMessage', { sender: senderName, text: msg });
        
        // Winning Condition
        if (!isArtist && gameState === "playing" && cleanEnglish(msg) === cleanEnglish(currentWord)) {
            io.emit('systemMessage', `🎉 Winner! They guessed the correct word: ${currentWord}`);
            setTimeout(resetRound, 4000);
        }
    });

    socket.on('draw', (data) => {
        if (socket.id === artistId && gameState === "playing") socket.broadcast.emit('draw', data);
    });

    socket.on('clear', () => {
        if (socket.id === artistId) socket.broadcast.emit('clear');
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (socket.id === artistId) {
            io.emit('systemMessage', "The Artist left! Stopping the round...");
            resetRound();
        } else {
            updateLobby();
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server online on port ${PORT}`));
