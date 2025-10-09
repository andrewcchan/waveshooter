// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ball
const geometry = new THREE.SphereGeometry(0.5, 32, 32);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const ball = new THREE.Mesh(geometry, material);
scene.add(ball);

// Animation properties
const velocity = new THREE.Vector3(0.05, 0.1, 0); // Initial velocity
const gravity = new THREE.Vector3(0, -0.005, 0); // Gravity force
const damping = 0.95; // Energy loss on bounce

// Boundaries
const ballRadius = geometry.parameters.radius;
let topBoundary, bottomBoundary, leftBoundary, rightBoundary;

function updateBoundaries() {
    const vFOV = camera.fov * Math.PI / 180;
    const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const width = height * camera.aspect;
    topBoundary = height / 2 - ballRadius;
    bottomBoundary = -height / 2 + ballRadius;
    leftBoundary = -width / 2 + ballRadius;
    rightBoundary = width / 2 + ballRadius;
}

updateBoundaries();

function animate() {
    requestAnimationFrame(animate);

    // Apply gravity
    velocity.add(gravity);

    // Update position
    ball.position.add(velocity);

    // Check for collisions with boundaries
    if (ball.position.x < leftBoundary || ball.position.x > rightBoundary) {
        velocity.x = -velocity.x * damping;
        // Clamp position to stay within bounds
        ball.position.x = Math.max(leftBoundary, Math.min(rightBoundary, ball.position.x));
    }

    if (ball.position.y < bottomBoundary || ball.position.y > topBoundary) {
        velocity.y = -velocity.y * damping;
        // Clamp position to stay within bounds
        ball.position.y = Math.max(bottomBoundary, Math.min(topBoundary, ball.position.y));
    }

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateBoundaries();
});