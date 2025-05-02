// 遊戲配置
const CONFIG = {
    COLORS: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'], // 隊伍顏色：紅、綠、藍、黃
    GAME_TIME: 60, // 遊戲時間（秒）
    PAINT_SIZE: 30, // 油漆基本大小
    SPLATTER_COUNT: 8, // 每次噴濺的油漆點數量
};

// 初始化 GUN.js
const gun = Gun({
    peers: ['https://gun-manhattan.herokuapp.com/gun']
});

// 玩家狀態
const playerState = {
    id: `player-${Math.random().toString(36).substr(2, 9)}`,
    nickname: '',
    roomCode: null,
    isHost: false,
    team: null
};

// 房間狀態
let currentRoom = null;
let gameActive = false;
let timeLeft = CONFIG.GAME_TIME;
let playerStats = {};
let mousePos = { x: 0, y: 0 };

// DOM 元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 生成房間代碼
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// 創建房間
document.getElementById('createRoomBtn').addEventListener('click', () => {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) {
        alert('請輸入暱稱！');
        return;
    }

    playerState.nickname = nickname;
    playerState.isHost = true;
    playerState.roomCode = generateRoomCode();

    // 初始化房間資料
    const roomRef = gun.get(`rooms/${playerState.roomCode}`);
    roomRef.put({
        host: playerState.id,
        status: 'waiting',
        createdAt: Date.now()
    });

    // 加入玩家列表
    const playersRef = roomRef.get('players');
    playersRef.get(playerState.id).put({
        id: playerState.id,
        nickname: playerState.nickname,
        isHost: true,
        lastSeen: Date.now()
    });

    currentRoom = roomRef;
    showWaitingRoom();
});

// 加入房間
document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) {
        alert('請輸入暱稱！');
        return;
    }
    playerState.nickname = nickname;
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.remove('hidden');
});

// 確認加入房間
document.getElementById('confirmJoinBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!roomCode) {
        alert('請輸入房間代碼！');
        return;
    }

    const roomRef = gun.get(`rooms/${roomCode}`);
    roomRef.once((room) => {
        if (!room) {
            alert('找不到該房間！');
            return;
        }
        if (room.status === 'playing') {
            alert('遊戲已經開始！');
            return;
        }

        playerState.roomCode = roomCode;
        currentRoom = roomRef;

        // 加入玩家列表
        const playersRef = roomRef.get('players');
        playersRef.get(playerState.id).put({
            id: playerState.id,
            nickname: playerState.nickname,
            isHost: false,
            lastSeen: Date.now()
        });

        showWaitingRoom();
    });
});

// 顯示等待房間
function showWaitingRoom() {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    document.getElementById('waitingScreen').classList.remove('hidden');
    
    document.getElementById('roomCode').textContent = playerState.roomCode;
    
    if (playerState.isHost) {
        document.getElementById('hostControls').classList.remove('hidden');
    }

    // 監聽玩家列表變化
    currentRoom.get('players').map().on((player, id) => {
        if (player && Date.now() - player.lastSeen < 10000) {
            updatePlayerList();
        }
    });
}

// 更新玩家列表
function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    
    currentRoom.get('players').once((players) => {
        if (!players) return;
        
        const activePlayers = Object.entries(players)
            .filter(([_, player]) => player && Date.now() - player.lastSeen < 10000)
            .map(([id, player]) => player);

        document.getElementById('playerCount').textContent = activePlayers.length;
        
        activePlayers.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                ${player.nickname}
                ${player.isHost ? '<span class="host-badge">房主</span>' : ''}
            `;
            playerList.appendChild(playerDiv);
        });
    });
}

// 開始遊戲按鈕
document.getElementById('startGameBtn').addEventListener('click', () => {
    if (!playerState.isHost) return;
    
    currentRoom.get('players').once((players) => {
        const activePlayers = Object.entries(players)
            .filter(([_, player]) => player && Date.now() - player.lastSeen < 10000);
            
        if (activePlayers.length < 2) {
            alert('至少需要 2 名玩家才能開始遊戲！');
            return;
        }

        currentRoom.put({ status: 'playing' });
        startGame();
    });
});

// 監聽房間狀態
function listenToRoomStatus() {
    currentRoom.on((room) => {
        if (room.status === 'playing' && !gameActive) {
            startGame();
        }
    });
}

// 離開房間按鈕
document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    if (currentRoom) {
        currentRoom.get('players').get(playerState.id).put(null);
        if (playerState.isHost) {
            currentRoom.put(null);
        }
    }
    resetGameState();
    showHomeScreen();
});

// 返回首頁按鈕
document.getElementById('backToHomeBtn').addEventListener('click', showHomeScreen);

// 顯示首頁
function showHomeScreen() {
    document.getElementById('homeScreen').classList.remove('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    document.getElementById('waitingScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
}

// 重置遊戲狀態
function resetGameState() {
    playerState.roomCode = null;
    playerState.isHost = false;
    playerState.team = null;
    currentRoom = null;
    gameActive = false;
    playerStats = {};
}

// 創建不規則油漆效果
function createPaintSplatter(x, y, color) {
    const points = [];
    for (let i = 0; i < CONFIG.SPLATTER_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / CONFIG.SPLATTER_COUNT;
        const distance = Math.random() * CONFIG.PAINT_SIZE;
        points.push({
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            size: Math.random() * CONFIG.PAINT_SIZE * 0.5 + CONFIG.PAINT_SIZE * 0.5
        });
    }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const xc = (p1.x + p2.x) / 2;
        const yc = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
    }
    
    ctx.fill();
    return points;
}

// 計算得分區域
function calculateScores() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const scores = new Array(CONFIG.COLORS.length).fill(0);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 0) { // 如果像素不是透明的
            const color = `#${imageData.data[i].toString(16).padStart(2, '0')}${imageData.data[i + 1].toString(16).padStart(2, '0')}${imageData.data[i + 2].toString(16).padStart(2, '0')}`;
            const teamIndex = CONFIG.COLORS.indexOf(color);
            if (teamIndex !== -1) {
                scores[teamIndex]++;
            }
        }
    }
    
    return scores;
}

// 遊戲控制
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
});

// 監聽空白鍵
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameActive && playerState.team !== null) {
        e.preventDefault();
        const splatter = {
            x: mousePos.x,
            y: mousePos.y,
            team: playerState.team,
            color: CONFIG.COLORS[playerState.team],
            playerId: playerState.id,
            timestamp: Date.now()
        };
        
        // 更新玩家統計
        playerStats[playerState.id] = playerStats[playerState.id] || { points: 0, paints: 0 };
        playerStats[playerState.id].paints++;
        
        // 同步到房間
        currentRoom.get('splatters').set(splatter);
    }
});

// 開始遊戲
function startGame() {
    document.getElementById('waitingScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    gameActive = true;
    timeLeft = CONFIG.GAME_TIME;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    playerStats = {};

    // 分配隊伍
    currentRoom.get('players').once((players) => {
        if (!players) return;
        
        const activePlayers = Object.entries(players)
            .filter(([_, player]) => player && Date.now() - player.lastSeen < 10000)
            .map(([id, player]) => ({...player, id}))
            .sort((a, b) => a.id.localeCompare(b.id));

        playerState.team = activePlayers.findIndex(p => p.id === playerState.id) % CONFIG.COLORS.length;
        document.getElementById('team-info').innerHTML = 
            `你的隊伍：<span style="color:${CONFIG.COLORS[playerState.team]}">第 ${playerState.team + 1} 隊</span>`;
    });

    // 開始計時
    const timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerHTML = `剩餘時間: ${timeLeft} 秒`;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            gameActive = false;
            endGame();
        }
    }, 1000);

    // 監聽油漆效果
    currentRoom.get('splatters').map().on((splatter, key) => {
        if (splatter && splatter.timestamp > Date.now() - 1000) {
            createPaintSplatter(splatter.x, splatter.y, splatter.color);
            
            // 更新統計
            if (!playerStats[splatter.playerId]) {
                playerStats[splatter.playerId] = { points: 0, paints: 0 };
            }
            playerStats[splatter.playerId].paints++;
        }
    });
}

// 結束遊戲
function endGame() {
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    
    const scores = calculateScores();
    const teamResults = scores.map((score, index) => ({
        team: index,
        score: score,
        color: CONFIG.COLORS[index]
    })).sort((a, b) => b.score - a.score);
    
    // 計算 MVP
    const mvpList = Object.entries(playerStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.paints - a.paints);
    
    // 顯示團隊排名
    const teamRankingHtml = teamResults.map((team, index) => `
        <div class="team-rank" style="background-color: ${team.color}20">
            <span style="color: ${team.color}">第 ${team.team + 1} 隊</span>
            <span>第 ${index + 1} 名 (${team.score} 點)</span>
        </div>
    `).join('');
    
    // 顯示 MVP
    const mvpHtml = mvpList.slice(0, 3).map((player, index) => `
        <div class="mvp-player">
            第 ${index + 1} 名：玩家 ${player.id.slice(0, 6)} (${player.paints} 次塗色)
        </div>
    `).join('');
    
    document.getElementById('teamRanking').innerHTML = `
        <h3>團隊排名</h3>
        ${teamRankingHtml}
    `;
    
    document.getElementById('mvpStats').innerHTML = `
        <h3>MVP 排行</h3>
        ${mvpHtml}
    `;
}

// 返回房間按鈕
document.getElementById('backToRoomBtn').addEventListener('click', () => {
    document.getElementById('resultScreen').classList.add('hidden');
    showWaitingRoom();
});

// 保持在線狀態
setInterval(() => {
    if (currentRoom && playerState.id) {
        currentRoom.get('players').get(playerState.id).get('lastSeen').put(Date.now());
    }
}, 3000);

// 啟動監聽
listenToRoomStatus();
showHomeScreen();