import type { SpatialData } from "../io/DataReceiver";

export class Visualizer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvasId: string) {
        const el = document.getElementById(canvasId);
        if (!el || !(el instanceof HTMLCanvasElement)) {
            throw new Error(`Canvas with id ${canvasId} not found`);
        }
        this.canvas = el;
        this.ctx = this.canvas.getContext('2d')!;

        // Handle resize
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight || 400;
        }
    }

    public draw(objects: SpatialData[]) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Clear background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, w, h);

        // Draw Grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        // Crosshair
        this.ctx.moveTo(cx, 0); this.ctx.lineTo(cx, h);
        this.ctx.moveTo(0, cy); this.ctx.lineTo(w, cy);
        this.ctx.stroke();

        objects.forEach(obj => {
            // Front-facing mapping
            // X: -5 (Left) to +5 (Right) maps to 0 to Width
            // Y: -5 (Down) to +5 (Up) maps to Height to 0 (Canvas Y is down)

            // Assume "Field of View" is roughly 10 units wide
            const scale = w / 12;

            const screenX = cx + (obj.x * scale);
            const screenY = cy - (obj.y * scale); // Invert Y because canvas Y+ is down

            // Z determines size (Closer = Bigger)
            // Z is typically negative in front of camera (e.g. -1 to -10)
            // Map -1 (Close) to large radius, -10 (Far) to small radius
            const dist = Math.abs(obj.z);
            const radius = Math.max(5, 60 / Math.max(0.5, dist / 2));

            // Draw Object
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsl(${Math.abs(obj.id.hashCode() % 360)}, 70%, 50%)`;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${obj.id}`, screenX, screenY + radius + 15);
            this.ctx.fillText(`(${obj.x.toFixed(1)}, ${obj.y.toFixed(1)}, ${obj.z.toFixed(1)})`, screenX, screenY + radius + 28);
        });
    }
}

// Helper for consistent colors
declare global {
    interface String {
        hashCode(): number;
    }
}

String.prototype.hashCode = function () {
    let hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}
