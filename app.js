(function() {
    let userName = localStorage.getItem('activeUser') || "";
    let packPoints = 0;
    let userPlayers = [];
    let starting11 = [];
    let upgradeRights = 0;
    let userAvatar = "👤";

    const PLAYER_LIMIT = 200;

    const pointsCountEl = document.getElementById('points-count');
    const playerCountEl = document.getElementById('player-count');
    const upgradeCountEl = document.getElementById('upgrade-count');
    const teamRatingEl = document.getElementById('team-rating');
    const squadTeamRatingEl = document.getElementById('squad-team-rating');
    const startingCountEl = document.getElementById('starting-count');
    
    const userNameDisplay = document.getElementById('user-name');
    const userAvatarDisplay = document.getElementById('user-avatar');
    const loginModal = document.getElementById('login-modal');
    const profileModal = document.getElementById('profile-modal');
    const packModal = document.getElementById('pack-modal');
    const revealedCardsEl = document.getElementById('revealed-cards');

    function init() {
        if (!userName) {
            loginModal.classList.remove('hidden');
        } else {
            loadUserData(userName);
            loginModal.classList.add('hidden');
            startApp();
        }
    }

    window.handleLogin = function() {
        const nameInput = document.getElementById('initial-username');
        const name = nameInput.value.trim();
        if (!name) {
            alert("Lütfen bir isim girin!");
            return;
        }
        userName = name;
        localStorage.setItem('activeUser', userName);
        loadUserData(userName);
        loginModal.classList.add('hidden');
        startApp();
    };

    function loadUserData(name) {
        const savedData = JSON.parse(localStorage.getItem('save_data_' + name));
        if (savedData) {
            packPoints = savedData.packPoints || 0;
            userPlayers = savedData.userPlayers || [];
            starting11 = savedData.starting11 || [];
            upgradeRights = savedData.upgradeRights || 0;
            userAvatar = savedData.userAvatar || "👤";
        } else {
            // Yeni kullanıcı başlangıç verileri
            packPoints = 100;
            userPlayers = [];
            starting11 = [];
            upgradeRights = 0;
            userAvatar = "👤";
            saveGame();
        }
    }

    function saveGame() {
        if (!userName) return;
        const data = {
            packPoints,
            userPlayers,
            starting11,
            upgradeRights,
            userAvatar
        };
        localStorage.setItem('save_data_' + userName, JSON.stringify(data));
        updateUI();
    }

    function startApp() {
        userNameDisplay.innerText = userName;
        userAvatarDisplay.innerText = userAvatar;
        document.getElementById('display-profile-name').innerText = userName;
        
        updateUI();
        setupNavigation();
        setupMatchLogic();
        checkDailyReward();
        checkPointsEvent();
        
        document.getElementById('btn-close-modal').onclick = () => packModal.classList.add('hidden');
    }

    function updateUI() {
        pointsCountEl.innerText = packPoints;
        playerCountEl.innerText = userPlayers.length;
        upgradeCountEl.innerText = upgradeRights;
        
        const rating = calculateTeamRating();
        teamRatingEl.innerText = `Takım Gücü: ${rating}`;
        if (squadTeamRatingEl) squadTeamRatingEl.innerText = rating;
        if (startingCountEl) startingCountEl.innerText = `${starting11.length}/11`;
    }

    function calculateTeamRating() {
        if (starting11.length === 0) return 0;
        let sum = 0;
        starting11.forEach(instId => {
            const p = userPlayers.find(up => up.instanceId === instId);
            if (p) sum += p.rating;
        });
        return Math.round(sum / 11) || 0;
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => {
                const target = btn.getAttribute('data-target');
                document.querySelectorAll('.main-content').forEach(v => v.classList.add('hidden'));
                document.getElementById(target).classList.remove('hidden');
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (target === 'squad-view') renderSquad();
            };
        });
    }

    window.openStorePack = function(cost, minRating, maxRating) {
        if (userPlayers.length >= PLAYER_LIMIT) {
            alert("Kadro limiti dolu!");
            return;
        }
        if (packPoints < cost) {
            alert("Yetersiz puan!");
            return;
        }

        packPoints -= cost;
        const rewards = [];
        
        for (let i = 0; i < 3; i++) {
            let player;
            // Efsanevi Paket (%20 Ronaldo Şansı)
            if (minRating === 95 && maxRating === 99 && Math.random() < 0.20) {
                player = playersDB.find(p => p.isSpecialRonaldo);
            } else {
                const eligible = playersDB.filter(p => p.rating >= minRating && p.rating <= maxRating && !p.isSpecialTurkey && !p.isSpecialArda);
                player = eligible[Math.floor(Math.random() * eligible.length)];
            }
            
            if (player) {
                const instance = { ...player, instanceId: Date.now() + "_" + Math.random().toString(36).substr(2, 9) };
                userPlayers.push(instance);
                rewards.push(instance);
            }
        }
        
        showPackModal(rewards);
        saveGame();
    };

    window.openEventPack = function() {
        const cost = 250;
        if (packPoints < cost) { alert("Yetersiz puan!"); return; }
        packPoints -= cost;
        const eventPool = playersDB.filter(p => p.isSpecialTurkey || p.isSpecialArda);
        const rewards = [];
        for (let i = 0; i < 3; i++) {
            const p = eventPool[Math.floor(Math.random() * eventPool.length)];
            const instance = { ...p, instanceId: Date.now() + "_" + Math.random().toString(36).substr(2, 9) };
            userPlayers.push(instance);
            rewards.push(instance);
        }
        showPackModal(rewards);
        saveGame();
    };

    function showPackModal(players) {
        revealedCardsEl.innerHTML = '';
        players.forEach(p => {
            const card = document.createElement('div');
            card.className = `player-card ${p.isStar ? 'star-card' : ''}`;
            card.innerHTML = `<div class="rating">${p.rating}</div><img src="${p.image}" class="player-img"><div class="player-name">${p.name}</div><div class="player-pos">${p.pos}</div>`;
            revealedCardsEl.appendChild(card);
        });
        packModal.classList.remove('hidden');
    }

    function renderSquad() {
        const squadGrid = document.getElementById('squad-grid');
        const starting11Grid = document.getElementById('starting-11-grid');
        squadGrid.innerHTML = '';
        starting11Grid.innerHTML = '';

        starting11.forEach(instId => {
            const p = userPlayers.find(up => up.instanceId === instId);
            if (p) starting11Grid.appendChild(createPlayerCard(p, true));
        });

        userPlayers.forEach(p => {
            if (!starting11.includes(p.instanceId)) {
                squadGrid.appendChild(createPlayerCard(p, false));
            }
        });
        updateUI();
    }

    function createPlayerCard(p, isStarting) {
        const div = document.createElement('div');
        div.className = `player-card ${p.isStar ? 'star-card' : ''}`;
        div.innerHTML = `
            <div class="rating">${p.rating}</div>
            <img src="${p.image}" class="player-img">
            <div class="player-name">${p.name}</div>
            <div class="player-pos">${p.pos}</div>
            <div class="card-actions">
                <button class="action-btn" onclick="event.stopPropagation(); upgradePlayer('${p.instanceId}')">🔼</button>
                <button class="action-btn" onclick="event.stopPropagation(); deletePlayer('${p.instanceId}')">🗑️</button>
            </div>
        `;
        div.onclick = () => toggleStarting11(p.instanceId);
        return div;
    }

    window.toggleStarting11 = function(instId) {
        const idx = starting11.indexOf(instId);
        if (idx > -1) {
            starting11.splice(idx, 1);
        } else {
            if (starting11.length >= 11) { alert("İlk 11 dolu!"); return; }
            starting11.push(instId);
        }
        renderSquad();
        saveGame();
    };

    window.autoFillStarting11 = function() {
        const sorted = [...userPlayers].sort((a, b) => b.rating - a.rating);
        starting11 = sorted.slice(0, 11).map(p => p.instanceId);
        renderSquad();
        saveGame();
    };

    window.deletePlayer = function(instId) {
        if (!confirm("Silinsin mi?")) return;
        userPlayers = userPlayers.filter(p => p.instanceId !== instId);
        starting11 = starting11.filter(id => id !== instId);
        renderSquad();
        saveGame();
    };

    window.upgradePlayer = function(instId) {
        if (upgradeRights <= 0) { alert("Hak yok!"); return; }
        const p = userPlayers.find(up => up.instanceId === instId);
        if (p) {
            p.rating += (p.isSpecialRonaldo || p.isSpecialMessi || p.isSpecialIbra || p.isStar) ? 5 : 2;
            upgradeRights--;
            renderSquad();
            saveGame();
        }
    };

    function setupMatchLogic() {
        document.getElementById('btn-search-match').onclick = start3DMatch;
        document.getElementById('btn-auto-match').onclick = toggleAutoMatch;
    }

    function start3DMatch() {
        if (starting11.length < 11) { alert("Maç için en az 11 kişilik bir kadro kurmalısın!"); return; }
        
        const overlay = document.getElementById('match-3d-overlay');
        overlay.classList.remove('hidden');
        
        document.getElementById('m3d-home-name').innerText = userName.toUpperCase();

        Match3D.start('match-3d-canvas-container', (score) => {
            handleMatchResult(score);
        });
    }

    function handleMatchResult(score) {
        let status = "";
        let rewardPoints = 0;
        let earnedUpgrade = false;

        if (score.home > score.away) {
            status = `KAZANDIN! (${score.home}-${score.away}) +15 💰`;
            rewardPoints = 15;
            if (Math.random() < 0.5) earnedUpgrade = true;
        } else if (score.home < score.away) {
            status = `KAYBETTİN... (${score.home}-${score.away}) +5 💰`;
            rewardPoints = 5;
        } else {
            status = `BERABERE! (${score.home}-${score.away}) +10 💰`;
            rewardPoints = 10;
        }

        packPoints += rewardPoints;
        if (earnedUpgrade) {
            upgradeRights++;
            alert("Harika oyun! +1 Geliştirme Hakkı kazandın!");
        }

        const resDisplay = document.getElementById('match-result-display');
        resDisplay.classList.remove('hidden');
        document.getElementById('match-status-text').innerText = status;
        document.getElementById('match-score').innerText = `${score.home} - ${score.away}`;
        
        saveGame();
    }

    let matchInterval = null;
    function simulateMatch() {
        if (starting11.length < 11) { alert("11 kişi lazım!"); return; }
        const myRating = calculateTeamRating();
        const oppRating = Math.max(60, myRating + Math.floor(Math.random() * 11) - 5);
        document.getElementById('match-opp-rating').innerText = oppRating;
        document.getElementById('match-my-rating').innerText = myRating;

        const winChance = myRating / (myRating + oppRating);
        const rand = Math.random();
        let status = "";
        if (rand < winChance - 0.1) {
            status = "KAZANDIN! +6 💰";
            packPoints += 6;
            if (Math.random() < 0.3) upgradeRights++;
        } else if (rand > winChance + 0.1) {
            status = "KAYBETTİN... +2 💰";
            packPoints += 2;
        } else {
            status = "BERABERE! +4 💰";
            packPoints += 4;
        }
        const res = document.getElementById('match-result-display');
        res.classList.remove('hidden');
        document.getElementById('match-status-text').innerText = status;
        document.getElementById('match-score').innerText = `${Math.floor(Math.random()*4)} - ${Math.floor(Math.random()*4)}`;
        saveGame();
    }

    function toggleAutoMatch() {
        const btn = document.getElementById('btn-auto-match');
        if (matchInterval) {
            clearInterval(matchInterval);
            matchInterval = null;
            btn.innerText = "OTOMATİK MAÇ BAŞLAT";
        } else {
            matchInterval = setInterval(simulateMatch, 3000);
            simulateMatch();
            btn.innerText = "DURDUR";
        }
    }

    function checkDailyReward() {
        const key = 'lastDaily_' + userName;
        const last = localStorage.getItem(key);
        const today = new Date().toDateString();
        if (last !== today) {
            packPoints += 50;
            localStorage.setItem(key, today);
            alert("Günlük hediye: 50 Puan!");
            saveGame();
        }
    }

    function checkPointsEvent() {
        const key = 'event10k_' + userName;
        if (!localStorage.getItem(key)) {
            const now = new Date();
            const start = new Date("2026-05-04T00:00:00");
            const end = new Date("2026-05-04T23:59:59");
            if (now >= start && now <= end) {
                packPoints += 10000;
                localStorage.setItem(key, 'true');
                alert("Hoş Geldin Hediyesi: 10.000 Puan!");
                saveGame();
            }
        }
    }

    window.openProfileModal = () => profileModal.classList.remove('hidden');
    window.closeProfileModal = () => profileModal.classList.add('hidden');
    window.selectAvatar = (a) => { userAvatar = a; userAvatarDisplay.innerText = a; saveGame(); };
    window.resetGame = () => { if(confirm("TÜM VERİLERİN SİLİNECEK!")) { localStorage.clear(); location.reload(); } };

    init();
})();