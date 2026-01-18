export class AudioContextManager {
    private static instance: AudioContextManager;
    public context: AudioContext;

    private constructor() {
        this.context = new AudioContext();
        // Default listener is at (0, 0, 0) facing forward (-Z) and up (+Y)
        const listener = this.context.listener;

        // Ensure listener orientation is standard
        if (listener.forwardX) {
            listener.forwardX.value = 0;
            listener.forwardY.value = 0;
            listener.forwardZ.value = -1;
            listener.upX.value = 0;
            listener.upY.value = 1;
            listener.upZ.value = 0;
        } else {
            listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
    }

    public static getInstance(): AudioContextManager {
        if (!AudioContextManager.instance) {
            AudioContextManager.instance = new AudioContextManager();
        }
        return AudioContextManager.instance;
    }

    public async resume(): Promise<void> {
        if (this.context.state === 'suspended') {
            await this.context.resume();
            console.log('AudioContext resumed');
        }
    }
}
