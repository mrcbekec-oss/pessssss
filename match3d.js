const Match3D = (function() {
    let scene, camera, renderer, ball, players = [], pitch;
    let clock, timerInterval;
    let score = { home: 0, away: 0 };
    let gameActive = false;
    let matchDuration = 90; // Saniye (hızlandırılmış 90 dk simülasyonu için)
    let currentTime = 0;
    let onMatchComplete = null;

    const PITCH_WIDTH = 60;
    const PITCH_HEIGHT = 100;
    const GOAL_WIDTH = 15;

    // Kontroller
    const keys = { w: false, a: false, s: false, d: false, space: false };

    function init(containerId, callback) {
        onMatchComplete = callback;
        const container = document.getElementById(containerId);
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 40, 50);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        // Işıklandırma
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 50, 20);
        dirLight.castShadow = true;
        scene.add(dirLight);

        createPitch();
        createGoals();
        createBall();
        createPlayers();

        window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
        window.addEventListener('resize', onWindowResize);

        clock = new THREE.Clock();
        gameActive = true;
        currentTime = 0;
        score = { home: 0, away: 0 };
        updateUI();

        timerInterval = setInterval(() => {
            if(!gameActive) return;
            currentTime++;
            updateUI();
            if(currentTime >= matchDuration) {
                endMatch();
            }
        }, 1000);

        animate();
    }

    function createPitch() {
        const geometry = new THREE.PlaneGeometry(PITCH_WIDTH, PITCH_HEIGHT);
        const material = new THREE.MeshPhongMaterial({ color: 0x2e7d32 });
        pitch = new THREE.Mesh(geometry, material);
        pitch.rotation.x = -Math.PI / 2;
        pitch.receiveShadow = true;
        scene.add(pitch);

        // Çizgiler (basitlik için sadece orta çizgi ve kenarlar)
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const points = [];
        points.push(new THREE.Vector3(-PITCH_WIDTH/2, 0.05, 0));
        points.push(new THREE.Vector3(PITCH_WIDTH/2, 0.05, 0));
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const centerLine = new THREE.Line(lineGeom, lineMat);
        scene.add(centerLine);
    }

    function createGoals() {
        const goalMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const postGeom = new THREE.BoxGeometry(1, 5, 1);
        const crossGeom = new THREE.BoxGeometry(GOAL_WIDTH, 1, 1);

        // Ev sahibi kalesi (Aşağıda)
        const g1L = new THREE.Mesh(postGeom, goalMat);
        g1L.position.set(-GOAL_WIDTH/2, 2.5, PITCH_HEIGHT/2);
        scene.add(g1L);
        const g1R = new THREE.Mesh(postGeom, goalMat);
        g1R.position.set(GOAL_WIDTH/2, 2.5, PITCH_HEIGHT/2);
        scene.add(g1R);
        const g1C = new THREE.Mesh(crossGeom, goalMat);
        g1C.position.set(0, 5, PITCH_HEIGHT/2);
        scene.add(g1C);

        // Deplasman kalesi (Yukarıda)
        const g2L = new THREE.Mesh(postGeom, goalMat);
        g2L.position.set(-GOAL_WIDTH/2, 2.5, -PITCH_HEIGHT/2);
        scene.add(g2L);
        const g2R = new THREE.Mesh(postGeom, goalMat);
        g2R.position.set(GOAL_WIDTH/2, 2.5, -PITCH_HEIGHT/2);
        scene.add(g2R);
        const g2C = new THREE.Mesh(crossGeom, goalMat);
        g2C.position.set(0, 5, -PITCH_HEIGHT/2);
        scene.add(g2C);
    }

    function createBall() {
        const geom = new THREE.SphereGeometry(0.8, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        ball = new THREE.Mesh(geom, mat);
        ball.position.set(0, 0.8, 0);
        ball.castShadow = true;
        ball.velocity = new THREE.Vector3(0, 0, 0);
        scene.add(ball);
    }

    function createPlayers() {
        // User Player
        const userPlayer = createPlayerMesh(0x3b82f6); // Mavi
        userPlayer.position.set(0, 2, 20);
        userPlayer.isUser = true;
        players.push(userPlayer);
        scene.add(userPlayer);

        // AI Players (Rakip)
        for(let i=0; i<3; i++) {
            const ai = createPlayerMesh(0xda3633); // Kırmızı
            ai.position.set((Math.random()-0.5)*PITCH_WIDTH, 2, -10 - Math.random()*20);
            ai.isAI = true;
            ai.speed = 0.1 + Math.random() * 0.05;
            players.push(ai);
            scene.add(ai);
        }
    }

    function createPlayerMesh(color) {
        const group = new THREE.Group();
        const bodyGeom = new THREE.CapsuleGeometry(1, 2, 4, 8);
        const bodyMat = new THREE.MeshPhongMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.castShadow = true;
        group.add(body);
        return group;
    }

    function animate() {
        if(!gameActive) return;
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        updatePhysics(delta);
        updateAI();
        updateCamera();
        
        renderer.render(scene, camera);
    }

    function updatePhysics(delta) {
        // User Movement
        const user = players.find(p => p.isUser);
        const moveSpeed = 0.5;
        if(keys.w) user.position.z -= moveSpeed;
        if(keys.s) user.position.z += moveSpeed;
        if(keys.a) user.position.x -= moveSpeed;
        if(keys.d) user.position.x += moveSpeed;

        // Border constraints
        user.position.x = Math.max(-PITCH_WIDTH/2 + 2, Math.min(PITCH_WIDTH/2 - 2, user.position.x));
        user.position.z = Math.max(-PITCH_HEIGHT/2 + 2, Math.min(PITCH_HEIGHT/2 - 2, user.position.z));

        // Ball Physics
        ball.position.add(ball.velocity);
        ball.velocity.multiplyScalar(0.98); // Sürtünme

        // Player-Ball interaction
        players.forEach(p => {
            const dist = p.position.distanceTo(ball.position);
            if(dist < 3) {
                const dir = ball.position.clone().sub(p.position).normalize();
                dir.y = 0;
                
                if(p.isUser && keys.space) {
                    ball.velocity.copy(dir.multiplyScalar(1.5)); // Sert Şut
                } else {
                    ball.velocity.copy(dir.multiplyScalar(0.3)); // Top sürme/dokunuş
                }
            }
        });

        // Goal detection
        if(Math.abs(ball.position.x) < GOAL_WIDTH/2) {
            if(ball.position.z < -PITCH_HEIGHT/2) {
                goalScored('home');
            } else if(ball.position.z > PITCH_HEIGHT/2) {
                goalScored('away');
            }
        }

        // Pitch borders for ball
        if(Math.abs(ball.position.x) > PITCH_WIDTH/2) ball.velocity.x *= -0.5;
        if(Math.abs(ball.position.z) > PITCH_HEIGHT/2) {
            if(Math.abs(ball.position.x) > GOAL_WIDTH/2) ball.velocity.z *= -0.5;
        }
    }

    function updateAI() {
        players.forEach(p => {
            if(p.isAI) {
                const dir = ball.position.clone().sub(p.position).normalize();
                p.position.x += dir.x * p.speed;
                p.position.z += dir.z * p.speed;
            }
        });
    }

    function updateCamera() {
        const user = players.find(p => p.isUser);
        const targetPos = new THREE.Vector3(user.position.x, 30, user.position.z + 40);
        camera.position.lerp(targetPos, 0.1);
        camera.lookAt(user.position.x, 0, user.position.z - 10);
    }

    function goalScored(who) {
        score[who]++;
        updateUI();
        resetPositions();
    }

    function resetPositions() {
        ball.position.set(0, 0.8, 0);
        ball.velocity.set(0, 0, 0);
        const user = players.find(p => p.isUser);
        user.position.set(0, 2, 20);
    }

    function updateUI() {
        document.getElementById('m3d-score-text').innerText = `${score.home} - ${score.away}`;
        const mins = Math.floor(currentTime / 60);
        const secs = currentTime % 60;
        document.getElementById('m3d-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function endMatch() {
        gameActive = false;
        clearInterval(timerInterval);
        setTimeout(() => {
            if(onMatchComplete) onMatchComplete(score);
            cleanup();
        }, 1000);
    }

    function cleanup() {
        const overlay = document.getElementById('match-3d-overlay');
        overlay.classList.add('hidden');
        const container = document.getElementById('match-3d-canvas-container');
        container.innerHTML = '';
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    return {
        start: init
    };
})();
