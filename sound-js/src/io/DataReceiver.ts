export interface SpatialData {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface DataReceiver {
    start(): void;
    stop(): void;
    onData(callback: (data: SpatialData[]) => void): void;
}

export class SimulatedReceiver implements DataReceiver {
    private isRunning: boolean = false;
    private callback: ((data: SpatialData[]) => void) | null = null;
    private objects: { id: string, x: number, y: number, z: number, phase: number, speed: number }[] = [];

    // scaleFactor: SCALING parameter.
    // Maps your input units (from camera/simulation) to Web Audio meters.
    // e.g. If scaleFactor = 5, then a movement of 1 "unit" in simulation becomes 5 meters in the audio engine.
    // Use this to calibrate the physical feeling of distance.
    private scaleFactor: number = 1;

    constructor() {
        // Initialize dummy objects
        this.objects.push({ id: 'obj1', x: 0, y: -2, z: 5, phase: 0, speed: 0.02 });
        // this.objects.push({ id: 'obj2', x: -2, y: 1, z: -8, phase: 2, speed: 0.03 });
    }

    public start() {
        this.isRunning = true;
        this.loop();
    }

    public stop() {
        this.isRunning = false;
    }

    public onData(callback: (data: SpatialData[]) => void) {
        this.callback = callback;
    }

    private loop = () => {
        if (!this.isRunning) return;

        // Update positions (Simulation Logic)
        this.objects.forEach(obj => {
            obj.phase += obj.speed;

            // Lock X and Z to fixed positions
            obj.x = Math.sin(obj.phase) * 3;
            obj.z = Math.cos(obj.phase) * 3; // 2 meters in front (-Z is into screen)

            // Animate Y (Up/Down) only
            // Oscillate between -3 and +3
            // Note: On stereo speakers, height is hard to hear. Use headphones.
            obj.y = Math.sin(obj.phase) * 3;
        });

        // Emit data
        if (this.callback) {
            this.callback(this.objects.map(o => ({
                id: o.id,
                x: o.x * this.scaleFactor,
                y: o.y * this.scaleFactor,
                z: o.z * this.scaleFactor
            })));
        }

        requestAnimationFrame(this.loop);
    }
}
