const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const statusText = document.getElementById('status-text');
const subText = document.getElementById('sub-text');

const TILE_SIZE = 30;
const OFFSET_X = (canvas.width - (MAZE_MAP[0].length * TILE_SIZE)) / 2;
const OFFSET_Y = (canvas.height - (MAZE_MAP.length * TILE_SIZE)) / 2;

let gameRunning = false;
let score = 0;
let lives = 3;
let powerUpTimer = 0;
let pelletsRemaining = 0;

class Entity {
    constructor(x, y, speed) {
        this.x = x * TILE_SIZE + OFFSET_X + TILE_SIZE / 2;
        this.y = y * TILE_SIZE + OFFSET_Y + TILE_SIZE / 2;
        this.baseSpeed = speed;
        this.speed = speed;
        this.dir = { x: 0, y: 0 };
        this.nextDir = { x: 0, y: 0 };
        this.radius = TILE_SIZE / 2 - 2;
    }

    getMapPos() {
        return {
            x: Math.floor((this.x - OFFSET_X) / TILE_SIZE),
            y: Math.floor((this.y - OFFSET_Y) / TILE_SIZE)
        };
    }

    canMove(dx, dy) {
        const pos = this.getMapPos();
        const nextX = pos.x + dx;
        const nextY = pos.y + dy;
        
        // Wrap around logic
        if (nextX < 0 || nextX >= MAZE_MAP[0].length) return true;
        
        const tile = MAZE_MAP[nextY][nextX];
        return tile !== 1; // 1 is wall
    }

    update() {
        // Handle centering and turning
        const pos = this.getMapPos();
        const centerX = pos.x * TILE_SIZE + OFFSET_X + TILE_SIZE / 2;
        const centerY = pos.y * TILE_SIZE + OFFSET_Y + TILE_SIZE / 2;

        const distToCenter = Math.sqrt(Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2));

        if (distToCenter < this.speed) {
            // Check if we can turn
            if (this.nextDir.x !== 0 || this.nextDir.y !== 0) {
                if (this.canMove(this.nextDir.x, this.nextDir.y)) {
                    this.dir = { ...this.nextDir };
                    this.x = centerX;
                    this.y = centerY;
                }
            }
            
            // Check if we hit a wall
            if (!this.canMove(this.dir.x, this.dir.y)) {
                this.dir = { x: 0, y: 0 };
                this.x = centerX;
                this.y = centerY;
            }
        }

        this.x += this.dir.x * this.speed;
        this.y += this.dir.y * this.speed;

        // Wrap around screen
        if (this.x < OFFSET_X) this.x = OFFSET_X + MAZE_MAP[0].length * TILE_SIZE;
        if (this.x > OFFSET_X + MAZE_MAP[0].length * TILE_SIZE) this.x = OFFSET_X;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 2.5);
    }

    draw() {
        const size = TILE_SIZE - 4;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotate based on direction
        if (this.dir.x === 1) ctx.rotate(Math.PI / 2);
        if (this.dir.x === -1) ctx.rotate(-Math.PI / 2);
        if (this.dir.y === 1) ctx.rotate(Math.PI);
        if (this.dir.y === -1) ctx.rotate(0);

        const pixelSize = size / 8;
        SPRITES.xWing.forEach((row, y) => {
            row.forEach((pixel, x) => {
                if (pixel > 0) {
                    ctx.fillStyle = SPRITES.colors.xWing[pixel];
                    ctx.fillRect(x * pixelSize - size / 2, y * pixelSize - size / 2, pixelSize, pixelSize);
                }
            });
        });
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, color) {
        super(x, y, 2);
        this.color = color;
        this.vulnerable = false;
    }

    update() {
        // Simple AI: Random movement at intersections
        const pos = this.getMapPos();
        const centerX = pos.x * TILE_SIZE + OFFSET_X + TILE_SIZE / 2;
        const centerY = pos.y * TILE_SIZE + OFFSET_Y + TILE_SIZE / 2;

        const distToCenter = Math.sqrt(Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2));

        if (distToCenter < this.speed) {
            const directions = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
            const available = directions.filter(d => 
                this.canMove(d.x, d.y) && (d.x !== -this.dir.x || d.y !== -this.dir.y)
            );

            if (available.length > 0) {
                // If in "scared" mode, pick random. If not, maybe track player slightly?
                // For now, random for that Atari feel
                const pick = available[Math.floor(Math.random() * available.length)];
                this.dir = pick;
                this.x = centerX;
                this.y = centerY;
            } else if (!this.canMove(this.dir.x, this.dir.y)) {
                // Dead end, turn back
                this.dir = { x: -this.dir.x, y: -this.dir.y };
            }
        }

        this.speed = this.vulnerable ? this.baseSpeed * 0.5 : this.baseSpeed;
        super.update();
    }

    draw() {
        const size = TILE_SIZE - 6;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const pixelSize = size / 8;
        const sprite = SPRITES.tieFighter;
        
        sprite.forEach((row, y) => {
            row.forEach((pixel, x) => {
                if (pixel > 0) {
                    ctx.fillStyle = this.vulnerable ? '#4A90E2' : SPRITES.colors.tie[pixel];
                    ctx.fillRect(x * pixelSize - size / 2, y * pixelSize - size / 2, pixelSize, pixelSize);
                }
            });
        });
        ctx.restore();
    }
}

let player;
let enemies = [];
let currentMaze = JSON.parse(JSON.stringify(MAZE_MAP));

function initGame() {
    score = 0;
    lives = 3;
    pelletsRemaining = 0;
    currentMaze = JSON.parse(JSON.stringify(MAZE_MAP));
    
    // Find player and enemies in map
    for (let y = 0; y < currentMaze.length; y++) {
        for (let x = 0; x < currentMaze[y].length; x++) {
            if (currentMaze[y][x] === 0 || currentMaze[y][x] === 2) pelletsRemaining++;
            if (currentMaze[y][x] === 4) player = new Player(x, y);
            if (currentMaze[y][x] === 5) enemies.push(new Enemy(x, y, 'red'));
        }
    }
    
    // Add more enemies
    enemies.push(new Enemy(9, 8, 'blue'));
    enemies.push(new Enemy(10, 8, 'pink'));
    
    livesEl.textContent = lives;
    scoreEl.textContent = '000000';
}

function drawMaze() {
    for (let y = 0; y < currentMaze.length; y++) {
        for (let x = 0; x < currentMaze[y].length; x++) {
            const tx = x * TILE_SIZE + OFFSET_X;
            const ty = y * TILE_SIZE + OFFSET_Y;
            
            if (currentMaze[y][x] === 1) {
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 2;
                ctx.strokeRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#0a0a2a';
                ctx.fillRect(tx + 5, ty + 5, TILE_SIZE - 10, TILE_SIZE - 10);
            } else if (currentMaze[y][x] === 0) {
                // Force Energy (Pellet)
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (currentMaze[y][x] === 2) {
                // Hyperdrive (Power-up)
                ctx.fillStyle = '#ffe81f';
                ctx.beginPath();
                ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 6, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffe81f';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }
}

function update() {
    if (!gameRunning) return;

    player.update();
    
    // Check pellet collision
    const pos = player.getMapPos();
    if (currentMaze[pos.y][pos.x] === 0) {
        currentMaze[pos.y][pos.x] = 3; // empty
        score += 10;
        pelletsRemaining--;
        scoreEl.textContent = score.toString().padStart(6, '0');
    } else if (currentMaze[pos.y][pos.x] === 2) {
        currentMaze[pos.y][pos.x] = 3;
        score += 50;
        powerUpTimer = 600; // 10 seconds at 60fps
        enemies.forEach(e => e.vulnerable = true);
        audio.playPowerUp();
    }

    if (powerUpTimer > 0) {
        powerUpTimer--;
        if (powerUpTimer === 0) {
            enemies.forEach(e => e.vulnerable = false);
        }
    }

    enemies.forEach(enemy => {
        enemy.update();
        
        // Collision with player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < TILE_SIZE * 0.8) {
            if (enemy.vulnerable) {
                score += 200;
                enemy.x = 9 * TILE_SIZE + OFFSET_X + TILE_SIZE / 2;
                enemy.y = 8 * TILE_SIZE + OFFSET_Y + TILE_SIZE / 2;
                enemy.vulnerable = false;
                audio.playLaser();
            } else {
                handleDeath();
            }
        }
    });

    if (pelletsRemaining === 0) {
        statusText.textContent = "LEVEL CLEAR";
        subText.textContent = "FORCE IS STRONG WITH YOU";
        gameRunning = false;
        overlay.classList.remove('hidden');
    }
}

function handleDeath() {
    lives--;
    livesEl.textContent = lives;
    gameRunning = false;
    if (lives <= 0) {
        statusText.textContent = "GAME OVER";
        subText.textContent = "PRESS ANY KEY TO RESTART";
        overlay.classList.remove('hidden');
    } else {
        // Reset positions
        player.x = 9 * TILE_SIZE + OFFSET_X + TILE_SIZE / 2;
        player.y = 15 * TILE_SIZE + OFFSET_Y + TILE_SIZE / 2;
        player.dir = { x: 0, y: 0 };
        player.nextDir = { x: 0, y: 0 };
        setTimeout(() => gameRunning = true, 1000);
    }
}

function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars
    ctx.fillStyle = 'white';
    for(let i=0; i<50; i++) {
        const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 678.90) * 0.5 + 0.5) * canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }

    drawMaze();
    player.draw();
    enemies.forEach(e => e.draw());

    update();
    requestAnimationFrame(draw);
}

window.addEventListener('keydown', (e) => {
    if (!gameRunning && lives <= 0) {
        initGame();
        gameRunning = true;
        overlay.classList.add('hidden');
        audio.playMainTheme();
        return;
    }
    if (!gameRunning && overlay.classList.contains('hidden')) {
        gameRunning = true;
        return;
    }
    if (!gameRunning && !overlay.classList.contains('hidden')) {
        initGame();
        gameRunning = true;
        overlay.classList.add('hidden');
        audio.playMainTheme();
    }

    switch(e.key) {
        case 'ArrowUp': player.nextDir = { x: 0, y: -1 }; break;
        case 'ArrowDown': player.nextDir = { x: 0, y: 1 }; break;
        case 'ArrowLeft': player.nextDir = { x: -1, y: 0 }; break;
        case 'ArrowRight': player.nextDir = { x: 1, y: 0 }; break;
    }
});

initGame();
draw();
