import './style.css'
import { AudioContextManager } from './audio/AudioContextManager';
import { SoundObject } from './audio/SoundObject';

// Application state
import { SimulatedReceiver } from './io/DataReceiver';
import { Visualizer } from './ui/Visualizer';

// Application state
class App {
  private sounds: Map<string, SoundObject> = new Map();
  private receiver = new SimulatedReceiver();
  private visualizer: Visualizer | null = null;

  constructor() {
    this.initUI();
  }

  private initUI() {
    // Wait for DOM
    setTimeout(() => {
      const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
      const statusDiv = document.getElementById('status') as HTMLDivElement;

      // Init Visualizer
      try {
        this.visualizer = new Visualizer('vis-canvas');
      } catch (e) {
        console.error("Could not init visualizer", e);
      }

      if (startBtn) {
        startBtn.addEventListener('click', async () => {
          const manager = AudioContextManager.getInstance();
          await manager.resume();

          startBtn.disabled = true;
          if (statusDiv) statusDiv.textContent = "Status: Running (Simulation)";
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
      });

      // 2. Draw Visualizer
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
