const Match3D = (function() {
    let scene, camera, renderer, ball, pitch;
    let clock, timerInterval;
    let score = { home: 0, away: 0 };
    let gameActive = false;
    let matchDuration = 180; // 3 dakika
    let currentTime = 0;
    let onMatchComplete = null;

    let homeTeam = [];
    let awayTeam = [];
    let currentPlayer = null;

    const PITCH_WIDTH = 70;
    const PITCH_HEIGHT = 110;
    const GOAL_WIDTH = 18;

    const keys = { w: false, a: false, s: false, d: false, space: false, k: false, shift: false };

    function init(containerId, callback) {
        onMatchComplete = callback;
        const container = document.getElementById(containerId);
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Gök mavisi

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 50, 80);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Işıklandırma
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        scene.add(sun);

        createEnvironment();
        createBall();
        createTeams();

        setupControls();

        clock = new THREE.Clock();
        gameActive = true;
        currentTime = 0;
        score = { home: 0, away: 0 };
        updateUI();

        timerInterval = setInterval(() => {
            if(!gameActive) return;
            currentTime++;
            updateUI();
            if(currentTime >= matchDuration) endMatch();
        }, 1000);

        animate();
    }

    function createEnvironment() {
        // Saha
        const pitchGeo = new THREE.PlaneGeometry(PITCH_WIDTH + 10, PITCH_HEIGHT + 10);
        const pitchMat = new THREE.MeshPhongMaterial({ color: 0x2e7d32 });
        pitch = new THREE.Mesh(pitchGeo, pitchMat);
        pitch.rotation.x = -Math.PI / 2;
        pitch.receiveShadow = true;
        scene.add(pitch);

        // Çizgiler
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const createLine = (p1, p2) => {
            const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const line = new THREE.Line(geom, lineMat);
            line.position.y = 0.05;
            scene.add(line);
        };

        // Kenar Çizgileri
        createLine(new THREE.Vector3(-PITCH_WIDTH/2, 0, -PITCH_HEIGHT/2), new THREE.Vector3(PITCH_WIDTH/2, 0, -PITCH_HEIGHT/2));
        createLine(new THREE.Vector3(-PITCH_WIDTH/2, 0, PITCH_HEIGHT/2), new THREE.Vector3(PITCH_WIDTH/2, 0, PITCH_HEIGHT/2));
        createLine(new THREE.Vector3(-PITCH_WIDTH/2, 0, -PITCH_HEIGHT/2), new THREE.Vector3(-PITCH_WIDTH/2, 0, PITCH_HEIGHT/2));
        createLine(new THREE.Vector3(PITCH_WIDTH/2, 0, -PITCH_HEIGHT/2), new THREE.Vector3(PITCH_WIDTH/2, 0, PITCH_HEIGHT/2));
        createLine(new THREE.Vector3(-PITCH_WIDTH/2, 0, 0), new THREE.Vector3(PITCH_WIDTH/2, 0, 0)); // Orta çizgi

        // Kaleler
        createGoal(PITCH_HEIGHT/2, 0x3b82f6); // Home
        createGoal(-PITCH_HEIGHT/2, 0xda3633); // Away
    }

    function createGoal(zPos, color) {
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const postG = new THREE.CylinderGeometry(0.5, 0.5, 6);
        const crossG = new THREE.CylinderGeometry(0.4, 0.4, GOAL_WIDTH);

        const leftPost = new THREE.Mesh(postG, mat);
        leftPost.position.set(-GOAL_WIDTH/2, 3, zPos);
        scene.add(leftPost);

        const rightPost = new THREE.Mesh(postG, mat);
        rightPost.position.set(GOAL_WIDTH/2, 3, zPos);
        scene.add(rightPost);

        const crossbar = new THREE.Mesh(crossG, mat);
        crossbar.position.set(0, 6, zPos);
        crossbar.rotation.z = Math.PI / 2;
        scene.add(crossbar);
    }

    function createBall() {
        const geo = new THREE.SphereGeometry(0.8, 32, 32);
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        ball = new THREE.Mesh(geo, mat);
        ball.position.set(0, 0.8, 0);
        ball.castShadow = true;
        ball.velocity = new THREE.Vector3(0, 0, 0);
        scene.add(ball);
    }

    function createTeams() {
        homeTeam = [];
        awayTeam = [];

        // 5 vs 5
        const positions = [
            { x: 0, z: 40 }, // Kaleci
            { x: -15, z: 20 }, { x: 15, z: 20 }, // Defans
            { x: -10, z: 5 }, { x: 10, z: 5 }   // Forvet
        ];

        positions.forEach((pos, i) => {
            const h = createPlayer(0x3b82f6, i === 0);
            h.position.set(pos.x, 2, pos.z);
            h.team = 'home';
            h.isGK = i === 0;
            homeTeam.push(h);
            scene.add(h);

            const a = createPlayer(0xda3633, i === 0);
            a.position.set(-pos.x, 2, -pos.z);
            a.team = 'away';
            a.isGK = i === 0;
            awayTeam.push(a);
            scene.add(a);
        });

        currentPlayer = homeTeam[4]; // Kontrol edilen oyuncu
    }

    function createPlayer(color, isGK) {
        const group = new THREE.Group();
        
        // Gövde
        const bodyGeo = new THREE.CapsuleGeometry(1.2, 2.5, 4, 8);
        const bodyMat = new THREE.MeshPhongMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // Kafa
        const headGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const headMat = new THREE.MeshPhongMaterial({ color: 0xffdbac });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 3;
        group.add(head);

        group.velocity = new THREE.Vector3();
        return group;
    }

    function animate() {
        if(!gameActive) return;
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        updateUserPlayer();
        updateAI();
        updatePhysics();
        updateCamera();

        renderer.render(scene, camera);
    }

    function updateUserPlayer() {
        const speed = keys.shift ? 0.8 : 0.4;
        let moveX = 0, moveZ = 0;

        if(keys.w) moveZ -= 1;
        if(keys.s) moveZ += 1;
        if(keys.a) moveX -= 1;
        if(keys.d) moveX += 1;

        if(moveX !== 0 || moveZ !== 0) {
            const dir = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(speed);
            currentPlayer.position.add(dir);
            currentPlayer.rotation.y = Math.atan2(moveX, moveZ);
        }

        // Topa müdahale
        const dist = currentPlayer.position.distanceTo(ball.position);
        if(dist < 3) {
            handleBallInteraction(currentPlayer);
        }
    }

    function handleBallInteraction(player) {
        const dir = ball.position.clone().sub(player.position).normalize();
        dir.y = 0;

        if(player === currentPlayer) {
            if(keys.space) { // Şut
                ball.velocity.copy(dir.multiplyScalar(2.2));
                ball.velocity.y = 0.3;
            } else if(keys.k) { // Pas
                const teammate = findNearestTeammate(player);
                if(teammate) {
                    const passDir = teammate.position.clone().sub(ball.position).normalize();
                    ball.velocity.copy(passDir.multiplyScalar(1.2));
                }
            } else { // Top sürme
                ball.velocity.copy(dir.multiplyScalar(0.4));
            }
        } else {
            // AI etkileşimi
            ball.velocity.copy(dir.multiplyScalar(0.3));
        }
    }

    function findNearestTeammate(player) {
        const team = player.team === 'home' ? homeTeam : awayTeam;
        let nearest = null;
        let minDist = Infinity;
        team.forEach(t => {
            if(t === player) return;
            const d = t.position.distanceTo(player.position);
            if(d < minDist) { minDist = d; nearest = t; }
        });
        return nearest;
    }

    function updateAI() {
        const allAI = [...homeTeam, ...awayTeam].filter(p => p !== currentPlayer);
        allAI.forEach(p => {
            const distToBall = p.position.distanceTo(ball.position);
            
            if(p.team === 'away' || distToBall < 15) { // Sadece rakip veya yakınındaki oyuncular hareket eder
                const dir = ball.position.clone().sub(p.position).normalize();
                p.position.x += dir.x * 0.15;
                p.position.z += dir.z * 0.15;
                p.rotation.y = Math.atan2(dir.x, dir.z);

                if(distToBall < 3) handleBallInteraction(p);
            }
        });
    }

    function updatePhysics() {
        ball.position.add(ball.velocity);
        ball.velocity.multiplyScalar(0.985); // Sürtünme
        
        // Yer çekimi
        if(ball.position.y > 0.8) {
            ball.velocity.y -= 0.01;
        } else {
            ball.position.y = 0.8;
            ball.velocity.y *= -0.4; // Zıplama kaybı
        }

        // Sınırlar
        if(Math.abs(ball.position.x) > PITCH_WIDTH/2) ball.velocity.x *= -0.6;
        if(Math.abs(ball.position.z) > PITCH_HEIGHT/2) {
            if(Math.abs(ball.position.x) < GOAL_WIDTH/2) {
                if(ball.position.z > 0) goalScored('away'); else goalScored('home');
            } else {
                ball.velocity.z *= -0.6;
            }
        }
    }

    function updateCamera() {
        const target = currentPlayer.position.clone();
        const camPos = new THREE.Vector3(target.x, 40, target.z + 60);
        camera.position.lerp(camPos, 0.1);
        camera.lookAt(target.x, 0, target.z - 20);
    }

    function goalScored(who) {
        if(who === 'home') score.home++; else score.away++;
        updateUI();
        resetPositions();
    }

    function resetPositions() {
        ball.position.set(0, 0.8, 0);
        ball.velocity.set(0, 0, 0);
        // Takımları başlangıca çek (basitleştirildi)
        createTeams(); 
    }

    function updateUI() {
        const scoreText = document.getElementById('m3d-score-text');
        if(scoreText) scoreText.innerText = `${score.home} - ${score.away}`;
        const timer = document.getElementById('m3d-timer');
        if(timer) {
            const m = Math.floor(currentTime / 60);
            const s = currentTime % 60;
            timer.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }

    function setupControls() {
        window.addEventListener('keydown', e => { 
            const k = e.key.toLowerCase();
            if(keys.hasOwnProperty(k)) keys[k] = true;
            if(e.key === 'Shift') keys.shift = true;
        });
        window.addEventListener('keyup', e => { 
            const k = e.key.toLowerCase();
            if(keys.hasOwnProperty(k)) keys[k] = false;
            if(e.key === 'Shift') keys.shift = false;
        });
    }

    function endMatch() {
        gameActive = false;
        clearInterval(timerInterval);
        setTimeout(() => {
            if(onMatchComplete) onMatchComplete(score);
            document.getElementById('match-3d-overlay').classList.add('hidden');
        }, 2000);
    }

    return { start: init };
})();
