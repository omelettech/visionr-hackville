/**
 * SpatialAudioManager
 * Manages 3D spatial audio nodes, motion detection, and contextual beeping logic.
 */
class SpatialAudioManager {
    constructor(options = {}) {
        this.ctx = null;
        this.isAudioInit = false;

        // Settings
        this.MOTION_THRESHOLD = options.motionThreshold || 0.02; // Capped at 0.02 as per user request
        this.IDLE_BEEP_INTERVAL = options.idleBeepInterval || 3000; // 3 seconds as per user request
        this.BEEP_DURATION = options.beepDuration || 100;
        this.BASE_VOLUME = options.baseVolume || 1; // Increased base volume from 0.1 to 0.5

        this.TAG_FREQUENCIES = options.tagFrequencies || {
            0: 261.63, // C4
            1: 293.66, // D4
            2: 329.63, // E4
            3: 349.23, // F4
            4: 392.00, // G4
            5: 440.00, // A4
            "default": 100.00
        };

        // { id: { osc, panner, gain, lastX, lastY, lastZ, lastBeepTime, isMoving, isBeeping } }
        this.activeSounds = {};
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.isAudioInit = true;
        console.log("Spatial Audio Manager Started");
        this._startLoop();
    }

    createSound(id, x, y, z) {
        if (!this.isAudioInit) return;
        const freq = this.TAG_FREQUENCIES[id] || this.TAG_FREQUENCIES["default"];

        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.value = 1;

        const panner = new PannerNode(this.ctx, {
            panningModel: "HRTF",
            distanceModel: "inverse",
            positionX: x,
            positionY: y,
            positionZ: z,
            refDistance: 1,
            maxDistance: 100,
            rolloffFactor: 1,
        });

        osc.connect(gain).connect(panner).connect(this.ctx.destination);
        osc.start();

        this.activeSounds[id] = {
            osc, panner, gain,
            lastX: x, lastY: y, lastZ: z,
            lastBeepTime: 0,
            isMoving: false,
            isBeeping: false
        };
    }

    updateSoundPosition(id, x, y, z) {
        const sound = this.activeSounds[id];
        if (!sound) return;

        // Calculate distance moved
        const dx = x - sound.lastX;
        const dy = y - sound.lastY;
        const dz = z - sound.lastZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Instant state switch
        sound.isMoving = dist > this.MOTION_THRESHOLD;

        sound.lastX = x;
        sound.lastY = y;
        sound.lastZ = z;

        // Highly responsive tracking
        const timeConstant = 0.03;
        sound.panner.positionX.setTargetAtTime(x, this.ctx.currentTime, timeConstant);
        sound.panner.positionY.setTargetAtTime(y, this.ctx.currentTime, timeConstant);
        sound.panner.positionZ.setTargetAtTime(z, this.ctx.currentTime, timeConstant);
    }

    removeSound(id) {
        const sound = this.activeSounds[id];
        if (!sound) return;

        // Instant cleanup for removed tags
        sound.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        sound.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);

        setTimeout(() => {
            sound.osc.stop();
            sound.osc.disconnect();
            sound.panner.disconnect();
            sound.gain.disconnect();
        }, 50);

        delete this.activeSounds[id];
    }

    _startLoop() {
        const loop = () => {
            const now = Date.now();
            for (const id in this.activeSounds) {
                const sound = this.activeSounds[id];

                if (sound.isMoving) {
                    // Continuous sound (Immediate ramp up to base volume)
                    sound.gain.gain.setTargetAtTime(this.BASE_VOLUME, this.ctx.currentTime, 0.02);
                } else {
                    // Stationary logic
                    if (!sound.isBeeping) {
                        sound.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
                    }

                    // Periodic Beep
                    if (now - sound.lastBeepTime > this.IDLE_BEEP_INTERVAL) {
                        this.triggerBeep(sound);
                        sound.lastBeepTime = now;
                    }
                }
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    triggerBeep(sound) {
        const now = this.ctx.currentTime;
        sound.isBeeping = true;
        sound.gain.gain.cancelScheduledValues(now);
        sound.gain.gain.setValueAtTime(sound.gain.gain.value, now);
        sound.gain.gain.linearRampToValueAtTime(this.BASE_VOLUME, now + 0.01);
        sound.gain.gain.linearRampToValueAtTime(this.BASE_VOLUME, now + this.BEEP_DURATION / 1000);
        sound.gain.gain.linearRampToValueAtTime(0, now + (this.BEEP_DURATION + 10) / 1000);

        setTimeout(() => {
            sound.isBeeping = false;
        }, this.BEEP_DURATION + 20);
    }

    // Settings Updates
    updateThreshold(val) {
        this.MOTION_THRESHOLD = parseFloat(val);
    }
    updateBeepInterval(val) {
        this.IDLE_BEEP_INTERVAL = parseInt(val);
    }
    updateBeepDuration(val) {
        this.BEEP_DURATION = parseInt(val);
    }
}
