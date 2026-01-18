import './style.css'
import { AudioContextManager } from './audio/AudioContextManager';
import { SoundObject } from './audio/SoundObject';

// Application state
import { SimulatedReceiver, type DataReceiver } from './io/DataReceiver';
import { WebSocketReceiver } from './io/WebSocketReceiver';
import { Visualizer } from './ui/Visualizer';

// Application state
class App {
  private sounds: Map<string, SoundObject> = new Map();
  private receiver: DataReceiver;
  private visualizer: Visualizer | null = null;
  private isWebSocketMode: boolean = false;

  constructor() {
    this.receiver = new SimulatedReceiver();
    this.initUI();
  }

  private initUI() {
    // Wait for DOM
    setTimeout(() => {
      const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
      const statusDiv = document.getElementById('status') as HTMLDivElement;
      const websocketToggle = document.getElementById('websocket-toggle') as HTMLInputElement;
      const websocketStatus = document.getElementById('websocket-status') as HTMLDivElement;
      const tagInfo = document.getElementById('tag-info') as HTMLDivElement;

      // Init Visualizer
      try {
        this.visualizer = new Visualizer('vis-canvas');
      } catch (e) {
        console.error("Could not init visualizer", e);
      }

      // WebSocket status listener
      window.addEventListener('websocket-status', ((event: CustomEvent) => {
        const { status } = event.detail;
        if (websocketStatus) {
          websocketStatus.style.display = 'block';
          switch (status) {
            case 'connected':
              websocketStatus.textContent = 'WebSocket: Connected ✓';
              websocketStatus.style.background = 'rgba(100, 255, 100, 0.1)';
              break;
            case 'disconnected':
              websocketStatus.textContent = 'WebSocket: Disconnected';
              websocketStatus.style.background = 'rgba(255, 100, 100, 0.1)';
              break;
            case 'error':
              websocketStatus.textContent = 'WebSocket: Error';
              websocketStatus.style.background = 'rgba(255, 100, 100, 0.2)';
              break;
          }
        }
      }) as EventListener);

      // WebSocket toggle
      if (websocketToggle) {
        websocketToggle.addEventListener('change', () => {
          this.isWebSocketMode = websocketToggle.checked;

          // Stop current receiver
          this.receiver.stop();

          // Switch receiver
          if (this.isWebSocketMode) {
            this.receiver = new WebSocketReceiver();
            if (websocketStatus) websocketStatus.style.display = 'block';
            if (tagInfo) tagInfo.style.display = 'block';
          } else {
            this.receiver = new SimulatedReceiver();
            if (websocketStatus) websocketStatus.style.display = 'none';
            if (tagInfo) tagInfo.style.display = 'none';
          }

          // Restart if already running
          if (startBtn.disabled) {
            this.startLoop();
          }
        });
      }

      if (startBtn) {
        startBtn.addEventListener('click', async () => {
          const manager = AudioContextManager.getInstance();
          await manager.resume();

          startBtn.disabled = true;
          const mode = this.isWebSocketMode ? 'WebSocket' : 'Simulation';
          if (statusDiv) statusDiv.textContent = `Status: Running (${mode})`;
          startBtn.textContent = "Active";

          // Start Simulation Loop
          this.startLoop();
        });
      }
    }, 0);
  }


  private startLoop() {
    // Handle incoming data
    this.receiver.onData((data) => {
      // Track which IDs are currently detected
      const activeIds = new Set(data.map(item => item.id));

      // 1. Update Audio
      data.forEach(item => {
        let sound = this.sounds.get(item.id);
        if (!sound) {
          // Create new if doesn't exist
          sound = this.createSound(item.id, item.x, item.y, item.z);
          // Differentiate sounds slightly based on ID hash or random
          const freq = 200 + (item.id.hashCode() % 600);
          sound.setFrequency(Math.abs(freq));
        } else {
          sound.updatePosition(item.x, item.y, item.z);
        }

        // Update UI if in WebSocket mode
        if (this.isWebSocketMode && data.length > 0) {
          const tag = data[0]; // Show first tag
          const tagIdEl = document.getElementById('tag-id');
          const valXEl = document.getElementById('val-x');
          const valYEl = document.getElementById('val-y');
          const valZEl = document.getElementById('val-z');

          if (tagIdEl) tagIdEl.textContent = tag.id;
          if (valXEl) valXEl.textContent = tag.x.toFixed(2);
          if (valYEl) valYEl.textContent = tag.y.toFixed(2);
          if (valZEl) valZEl.textContent = tag.z.toFixed(2);
        }
      });

      // 2. Remove sounds that are no longer detected (only in WebSocket mode)
      if (this.isWebSocketMode) {
        for (const [id] of this.sounds.entries()) {
          if (!activeIds.has(id)) {
            console.log(`[Main] Tag ${id} no longer detected, removing sound`);
            this.removeSound(id);
          }
        }
      }

      // 3. Draw Visualizer
      if (this.visualizer) {
        this.visualizer.draw(data);
      }
    });

    this.receiver.start();
  }

  // Global API exposed to window
  public createSound(id: string, x: number = 0, y: number = 0, z: number = -5): SoundObject {
    if (this.sounds.has(id)) {
      console.warn(`Sound with ID '${id}' already exists.`);
      return this.sounds.get(id)!;
    }

    const sound = new SoundObject(x, y, z);
    this.sounds.set(id, sound);
    // Auto-play for immediate feedback
    sound.play();

    console.log(`Created sound '${id}' at (${x}, ${y}, ${z})`);
    return sound;
  }

  public getSound(id: string): SoundObject | undefined {
    return this.sounds.get(id);
  }

  public removeSound(id: string) {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.stop();
      this.sounds.delete(id);
    }
  }

  public listSounds() {
    return Array.from(this.sounds.keys());
  }
}

// Expose to window for console testing
const app = new App();
(window as any).App = app;
(window as any).app = app;

console.log("VisionR Spatial Audio Ready.");
console.log("Usage in Console:");
console.log("  app.createSound('obj1', 0, 0, -5)");
console.log("  const s1 = app.getSound('obj1')");
console.log("  s1.updatePosition(2, 0, -5)");
console.log("  s1.setFrequency(600)");
