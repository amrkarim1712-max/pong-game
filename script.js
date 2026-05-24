// Game constants
const GAME_BOARD = document.getElementById('gameBoard');
const BALL = document.getElementById('ball');
const PLAYER_PADDLE = document.getElementById('playerPaddle');
const COMPUTER_PADDLE = document.getElementById('computerPaddle');
const PLAYER_SCORE_DISPLAY = document.getElementById('playerScore');
const COMPUTER_SCORE_DISPLAY = document.getElementById('computerScore');

const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 6;
const BALL_SPEED = 4;
const COMPUTER_SPEED = 4.5;

// Game state
let ballX = BOARD_WIDTH / 2 - BALL_SIZE / 2;
let ballY = BOARD_HEIGHT / 2 - BALL_SIZE / 2;
let ballSpeedX = BALL_SPEED;
let ballSpeedY = BALL_SPEED;

let playerY = BOARD_HEIGHT / 2 - PADDLE_HEIGHT / 2;
let computerY = BOARD_HEIGHT / 2 - PADDLE_HEIGHT / 2;

let playerScore = 0;
let computerScore = 0;

// Input handling
const keys = {
    ArrowUp: false,
    ArrowDown: false
};

let mouseY = BOARD_HEIGHT / 2;

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') keys.ArrowUp = true;
    if (e.key === 'ArrowDown') keys.ArrowDown = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') keys.ArrowUp = false;
    if (e.key === 'ArrowDown') keys.ArrowDown = false;
});

GAME_BOARD.addEventListener('mousemove', (e) => {
    const rect = GAME_BOARD.getBoundingClientRect();
    mouseY = e.clientY - rect.top - PADDLE_HEIGHT / 2;
});

// Update player paddle position
function updatePlayerPaddle() {
    if (keys.ArrowUp) {
        playerY -= PADDLE_SPEED;
    }
    if (keys.ArrowDown) {
        playerY += PADDLE_SPEED;
    }

    // Mouse control
    if (mouseY >= 0 && mouseY <= BOARD_HEIGHT - PADDLE_HEIGHT) {
        playerY = mouseY;
    }

    // Boundary check
    playerY = Math.max(0, Math.min(playerY, BOARD_HEIGHT - PADDLE_HEIGHT));

    PLAYER_PADDLE.style.top = playerY + 'px';
}

// Update computer paddle position (AI)
function updateComputerPaddle() {
    const computerCenter = computerY + PADDLE_HEIGHT / 2;
    const ballCenter = ballY + BALL_SIZE / 2;

    if (computerCenter < ballCenter - 35) {
        computerY += COMPUTER_SPEED;
    } else if (computerCenter > ballCenter + 35) {
        computerY -= COMPUTER_SPEED;
    }

    // Boundary check
    computerY = Math.max(0, Math.min(computerY, BOARD_HEIGHT - PADDLE_HEIGHT));

    COMPUTER_PADDLE.style.top = computerY + 'px';
}

// Ball collision detection with paddles
function checkPaddleCollision() {
    // Left paddle collision
    if (
        ballX <= PADDLE_WIDTH + 10 &&
        ballY + BALL_SIZE >= playerY &&
        ballY <= playerY + PADDLE_HEIGHT
    ) {
        ballSpeedX = -ballSpeedX;
        ballSpeedX *= 1.05; // Slight speed increase
        ballX = PADDLE_WIDTH + 10;

        // Add spin based on where ball hits paddle
        const hitPos = (ballY + BALL_SIZE / 2) - (playerY + PADDLE_HEIGHT / 2);
        ballSpeedY += hitPos * 0.1;
    }

    // Right paddle collision
    if (
        ballX + BALL_SIZE >= BOARD_WIDTH - PADDLE_WIDTH - 10 &&
        ballY + BALL_SIZE >= computerY &&
        ballY <= computerY + PADDLE_HEIGHT
    ) {
        ballSpeedX = -ballSpeedX;
        ballSpeedX *= 1.05; // Slight speed increase
        ballX = BOARD_WIDTH - PADDLE_WIDTH - 10 - BALL_SIZE;

        // Add spin based on where ball hits paddle
        const hitPos = (ballY + BALL_SIZE / 2) - (computerY + PADDLE_HEIGHT / 2);
        ballSpeedY += hitPos * 0.1;
    }
}

// Ball collision detection with walls
function checkWallCollision() {
    // Top and bottom wall collisions
    if (ballY <= 0 || ballY + BALL_SIZE >= BOARD_HEIGHT) {
        ballSpeedY = -ballSpeedY;
        ballY = Math.max(0, Math.min(ballY, BOARD_HEIGHT - BALL_SIZE));
    }
}

// Score points
function updateScore() {
    // Ball past right paddle (player scores)
    if (ballX < 0) {
        playerScore++;
        PLAYER_SCORE_DISPLAY.textContent = playerScore;
        resetBall();
    }

    // Ball past left paddle (computer scores)
    if (ballX > BOARD_WIDTH) {
        computerScore++;
        COMPUTER_SCORE_DISPLAY.textContent = computerScore;
        resetBall();
    }
}

// Reset ball to center
function resetBall() {
    ballX = BOARD_WIDTH / 2 - BALL_SIZE / 2;
    ballY = BOARD_HEIGHT / 2 - BALL_SIZE / 2;
    
    // Random direction
    ballSpeedX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = BALL_SPEED * (Math.random() * 2 - 1);
}

// Update ball position
function updateBall() {
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    BALL.style.left = ballX + 'px';
    BALL.style.top = ballY + 'px';
}

// Limit ball speed
function limitBallSpeed() {
    const maxSpeed = BALL_SPEED * 2;
    const speed = Math.sqrt(ballSpeedX ** 2 + ballSpeedY ** 2);
    
    if (speed > maxSpeed) {
        ballSpeedX = (ballSpeedX / speed) * maxSpeed;
        ballSpeedY = (ballSpeedY / speed) * maxSpeed;
    }
}

// Main game loop
function gameLoop() {
    updatePlayerPaddle();
    updateComputerPaddle();
    updateBall();
    checkPaddleCollision();
    checkWallCollision();
    updateScore();
    limitBallSpeed();

    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();