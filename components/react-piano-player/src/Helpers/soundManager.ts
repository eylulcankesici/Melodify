import Soundfont, { Player, InstrumentName } from 'soundfont-player';

class soundManager {
    private ac: AudioContext | null = null;
    private piano: Player | null = null;
    
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;

    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.initPromise = this.init();
    }

    private async init(): Promise<void> {
        if (this.isInitialized || typeof window === 'undefined') {
            return;
        }
        
        try {
            this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            this.compressor = this.ac.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-50, this.ac.currentTime);
            this.compressor.knee.setValueAtTime(40, this.ac.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ac.currentTime);
            this.compressor.attack.setValueAtTime(0, this.ac.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.ac.currentTime);

            this.masterGain = this.ac.createGain();
            this.masterGain.gain.setValueAtTime(0.9, this.ac.currentTime);

            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.ac.destination);

            this.piano = await Soundfont.instrument(this.ac, 'acoustic_grand_piano' as InstrumentName, {
                destination: this.masterGain,
                gain: 2 
            });

            this.isInitialized = true;
            console.log("Profesyonel ses zinciri ile Soundfont player başlatıldı.");

        } catch (e) {
            console.error("Soundfont player başlatılamadı:", e);
            this.initPromise = null;
        }
    }

    // MIDI numarasını (21-108) nota ismine çevirir (C4, F#5 vb.).
    private midiToNoteName(midi: number): string {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return notes[noteIndex] + octave;
    }

    public async play_key(key: number, time: number, velocity: number) {
        // key: MIDI nota numarası (21-108)
        // time: Mikrosaniye cinsinden SoundDuration
        // velocity: Tuşa basma hızı (0-127)

        if (!this.isInitialized) {
            if (this.initPromise) await this.initPromise;
            if (!this.isInitialized) {
                console.error("Ses sistemi hazır değil, nota çalınamıyor.");
                return;
            }
        }

        if (!this.piano || !this.ac) return;
        
        // --- DÜZELTME: Artık gelen 'key' zaten doğru MIDI numarası olduğu için 21 çıkarmıyoruz.
        const noteName = this.midiToNoteName(key);
        const gain = (velocity / 127) ** 2;

        this.piano.play(noteName, this.ac.currentTime, {
            // Süreyi mikrosaniyeden saniyeye çeviriyoruz.
            duration: time / 1000000, 
            gain: gain, 
        });
    }
}

export default soundManager;