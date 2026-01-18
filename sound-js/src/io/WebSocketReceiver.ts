import type { DataReceiver, SpatialData } from './DataReceiver';

interface AprilTagData {
    id: string;
    z_distance: number;
    pose: [number, number, number];
}

export class WebSocketReceiver implements DataReceiver {
    private socket: WebSocket | null = null;
    private isRunning: boolean = false;
    private callback: ((data: SpatialData[]) => void) | null = null;
    private url: string;
    private reconnectInterval: number = 3000; // 3 seconds
    private reconnectTimer: number | null = null;

    // Scaling factor to exaggerate movement
    private scaleFactor: number = 5;

    constructor(url: string = 'ws://localhost:8765') {
        this.url = url;
    }

    public start() {
        console.log('[WebSocketReceiver] Starting...');
        this.isRunning = true;
        this.connect();
    }

    public stop() {
        this.isRunning = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    public onData(callback: (data: SpatialData[]) => void) {
        this.callback = callback;
    }

    private connect() {
        if (!this.isRunning) return;

        console.log('[WebSocket] Attempting to connect to:', this.url);

        try {
            this.socket = new WebSocket(this.url);
            console.log('[WebSocket] WebSocket object created');

            this.socket.addEventListener('open', () => {
                console.log('[WebSocket] ✓ Connected to', this.url);
                this.emitConnectionStatus('connected');
            });

            this.socket.addEventListener('message', (event) => {
                console.log('[WebSocket] Received message:', event.data);
                this.handleMessage(event.data);
            });

            this.socket.addEventListener('close', (event) => {
                console.log('[WebSocket] Connection closed. Code:', event.code, 'Reason:', event.reason);
                this.emitConnectionStatus('disconnected');
                this.socket = null;

                // Attempt to reconnect if still running
                if (this.isRunning) {
                    this.scheduleReconnect();
                }
            });

            this.socket.addEventListener('error', (error) => {
                console.error('[WebSocket] ✗ Error:', error);
                console.error('[WebSocket] Make sure Python server is running on', this.url);
                this.emitConnectionStatus('error');
            });
        } catch (error) {
            console.error('[WebSocket] ✗ Failed to create WebSocket:', error);
            this.emitConnectionStatus('error');
            if (this.isRunning) {
                this.scheduleReconnect();
            }
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;

        console.log(`Reconnecting in ${this.reconnectInterval / 1000}s...`);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectInterval);
    }

    private handleMessage(data: string) {
        try {
            const aprilTags: AprilTagData[] = JSON.parse(data);

            if (!Array.isArray(aprilTags)) {
                console.warn('Expected array of AprilTag data, got:', aprilTags);
                return;
            }

            // Transform AprilTag data to SpatialData
            const spatialData: SpatialData[] = aprilTags.map(tag => {
                // Extract pose coordinates
                const [poseX, poseY] = tag.pose;

                // Transform coordinates:
                // - Multiply by scaleFactor for exaggeration
                // - Flip Y axis (computer vision Y-down -> audio Y-up)
                const x = poseX * this.scaleFactor;
                const y = -poseY * this.scaleFactor;

                // Use z_distance for volume control (not spatial Z)
                const z = tag.z_distance;

                return {
                    id: tag.id.toString(),
                    x,
                    y,
                    z
                };
            });

            // Emit transformed data
            if (this.callback) {
                this.callback(spatialData);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    private emitConnectionStatus(status: 'connected' | 'disconnected' | 'error') {
        // Dispatch custom event for UI to listen to
        const event = new CustomEvent('websocket-status', { detail: { status } });
        window.dispatchEvent(event);
    }
}
