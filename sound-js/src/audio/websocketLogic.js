let ctx, panner, oscillator;
// Default position
let currentPos = { x: 0, y: 0, z: 1 };

// Connect to the Python Server
const socket = new WebSocket('ws://localhost:8765');
const statusDiv = document.getElementById('connection-status');

// --- WEBSOCKET LOGIC ---

socket.addEventListener('open', () => {
    statusDiv.innerText = "Connected to Python Server";
    statusDiv.style.color = "#0f0";
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    // If we detect at least one tag
    if (data.length > 0) {
        const tag = data[0]; // Track the first tag found

        // AprilTag Coordinates:
        // X = Left/Right (Meters)
        // Y = Up/Down (Meters) (Note: In Computer Vision, Y is often Down. In Web Audio, Y is Up)
        // Z = Depth (Meters)

        // We map them to the Panner
        // We flip Y so that lifting the tag up sounds "up"
        const x = tag.pose[0] * 5; // Multiplied by 5 to exaggerate the effect
        const y = -tag.pose[1] * 5;
        const z = Math.abs(tag.pose[2]);

        // Update UI
        document.getElementById('tag-id').innerText = tag.id;
        document.getElementById('val-x').innerText = x.toFixed(2);
        document.getElementById('val-y').innerText = y.toFixed(2);
        document.getElementById('val-z').innerText = z.toFixed(2);

        // Update Audio Engine
        updateAudioPosition(x, y, z);
    }
});

socket.addEventListener('close', () => {
    statusDiv.innerText = "Disconnected from Server";
    statusDiv.style.color = "#f00";
});