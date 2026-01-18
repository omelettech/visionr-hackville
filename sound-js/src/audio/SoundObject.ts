import { AudioContextManager } from './AudioContextManager';

export class SoundObject {
    private context: AudioContext;
    private oscillator: OscillatorNode;
    private panner: PannerNode;
    private gain: GainNode;
    // @ts-ignore
    private isPlaying: boolean = false;

    constructor(initialX: number = 0, initialY: number = 0, initialZ: number = 0) {
        this.context = AudioContextManager.getInstance().context;

        // Create nodes
        this.oscillator = this.context.createOscillator();
        this.panner = this.context.createPanner();
        this.gain = this.context.createGain();

        // Configure Panner for HRTF (High quality 3D spatialization)
        this.panner.panningModel = 'HRTF';

        // --- Distance Attenuation Parameters ---
        // 'exponential': Volume drops quickly as you move away. More realistic/dramatic than 'linear'.
        this.panner.distanceModel = 'inverse';

        // refDistance: The distance at which the sound is at its "natural" volume (100%).
        // Any closer than this, the volume doesn't get louder to prevent clipping.
        // Any further, it starts dropping off.
        this.panner.refDistance = 1;

        // maxDistance: The distance where the volume acts as if it's the furthest away point in the calculation.
        // It doesn't silence the sound, but stops the attenuation curve calculation.
        this.panner.maxDistance = 10000;

        // rolloffFactor: How fast the sound fades. 
        // 1.0 is "real world" physics. Higher values (e.g., 2.5) make the drop-off more extreme/intense.
        this.panner.rolloffFactor = 1;

        // Set initial position
        this.updatePosition(initialX, initialY, initialZ);

        // Chain: Oscillator -> Gain -> Panner -> Destination
        this.oscillator.connect(this.gain);
        this.gain.connect(this.panner);
        this.panner.connect(this.context.destination);

        // Default sound
        this.oscillator.type = 'sine';
        this.oscillator.frequency.value = 440; // A4
        this.gain.gain.value = 0.5;

        this.oscillator.start();

        // Mute initially if not "playing"
        this.gain.gain.value = 0;
    }

    public play() {
        this.isPlaying = true;
        // Ramp up gain to avoid popping
        this.gain.gain.setTargetAtTime(0.5, this.context.currentTime, 0.05);
    }

    public stop() {
        this.isPlaying = false;
        this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
    }

    public updatePosition(x: number, y: number, z: number) {
        // Web Audio API uses a right-handed coordinate system.
        // +X is right, -X is left
        // +Y is up, -Y is down
        // +Z is OUT of the screen (towards listener), -Z is INTO the screen

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            console.warn('Invalid position:', x, y, z);
            return;
        }

        // --- MUTE SOUNDS BEHIND LISTENER ---
        // If Z < 0, the sound is behind the listener, mute it
        const isBehind = z < 0;

        // --- 2D SPATIAL POSITIONING (X/Y only) ---
        // Set Z to a fixed position in front of listener (e.g., -1)
        // This ensures all sounds appear at the same depth, only X/Y panning matters
        const fixedZ = -1;

        if (this.panner.positionX) {
            this.panner.positionX.value = x;
            this.panner.positionY.value = y;
            this.panner.positionZ.value = fixedZ;
        } else {
            this.panner.setPosition(x, y, fixedZ);
        }

        // --- VOLUME CONTROL FROM Z DISTANCE ---
        // Use Z distance to control volume (closer = louder)
        // Formula: volume = baseVolume / (1 + distance * rolloff)
        const baseVolume = 0.5;
        const rolloff = 0.2; // Adjust this to control how quickly volume drops with distance
        const distance = Math.abs(z);

        let targetVolume = baseVolume / (1 + distance * rolloff);

        // Mute if behind listener
        if (isBehind) {
            targetVolume = 0;
        }

        // Clamp volume between 0 and 1
        targetVolume = Math.max(0, Math.min(1, targetVolume));

        // Smoothly transition to target volume
        this.gain.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.05);
    }


    public setFrequency(hz: number) {
        this.oscillator.frequency.setTargetAtTime(hz, this.context.currentTime, 0.1);
    }
}
