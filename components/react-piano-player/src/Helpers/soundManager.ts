import Soundfont, { Player, InstrumentName } from 'soundfont-player';

// %100 Yerel, Sıfır Gecikmeli ve İnternet Bağımsızlığı olan Akustik Bateri Kiti Örnekleri (Next.js /public Klasöründe Barındırılır)
const DRUM_SAMPLES: Record<number, string> = {
    // Kick Drum (Bas Davul) - MIDI 35, 36 (Organik, tok stüdyo ahşap bas davul vuruşu)
    35: "/sounds/drum-samples/acoustic-kit/kick.wav",
    36: "/sounds/drum-samples/acoustic-kit/kick.wav",
    
    // Snare Drum (Trampet) - MIDI 38, 40 (Sıcak ve şık akustik ahşap trampet)
    38: "/sounds/drum-samples/acoustic-kit/snare.wav",
    40: "/sounds/drum-samples/acoustic-kit/snare.wav",
    
    // Hi-Hats - MIDI 42, 44, 46 (Gerçek pirinç alaşım akustik kapalı ziller)
    42: "/sounds/drum-samples/acoustic-kit/hihat.wav",     
    44: "/sounds/drum-samples/acoustic-kit/hihat.wav",     
    46: "/sounds/drum-samples/acoustic-kit/hihat.wav",     
    
    // Toms (Tom-Tom Davullar) - MIDI 41, 43, 45, 47, 48 (Doğal rezonanslı akustik tom vuruşları)
    41: "/sounds/drum-samples/acoustic-kit/tom1.wav",   // Alçak Tom
    43: "/sounds/drum-samples/acoustic-kit/tom1.wav",
    45: "/sounds/drum-samples/acoustic-kit/tom2.wav",   // Orta Tom
    47: "/sounds/drum-samples/acoustic-kit/tom2.wav",
    48: "/sounds/drum-samples/acoustic-kit/tom3.wav",   // Yüksek Tom   
    
    // Zil Sesi (Crash / Ride Cymbal) - MIDI 49, 51 (Geniş metalik yansımalı akustik zil sesleri)
    49: "/sounds/drum-samples/acoustic-kit/ride.wav",  
    51: "/sounds/drum-samples/acoustic-kit/ride.wav",  
    
    // Diğer Vurmalılar (Clap, Tink)
    39: "/sounds/drum-samples/acoustic-kit/clap.wav",   // Gerçek el çırpma
    56: "/sounds/drum-samples/acoustic-kit/tink.wav",   // Gerçek akustik tink
};

// Gelen MIDI nota değerini en yakın gerçek akustik davul sesine eşler
const getDrumSampleUrl = (note: number): string => {
    if (DRUM_SAMPLES[note]) return DRUM_SAMPLES[note];
    
    // Fallback kuralları
    if (note < 38) return DRUM_SAMPLES[36]; // Kick
    if (note >= 38 && note < 41) return DRUM_SAMPLES[38]; // Snare
    if (note > 40 && note < 49) {
        if (note % 2 === 0) return DRUM_SAMPLES[42]; // Hihat
        return DRUM_SAMPLES[45]; // Tom
    }
    if (note >= 49 && note < 58) return DRUM_SAMPLES[49]; // Zil
    return DRUM_SAMPLES[56]; // Tink
};

class soundManager {
    private ac: AudioContext | null = null;
    private piano: Player | null = null;
    private instrumentName: string = 'acoustic_grand_piano';
    
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    
    // Profesyonel 3D Reverb / Konser Salonu Yankısı (Spatial Reverb)
    private reverbNode: ConvolverNode | null = null;
    private reverbGain: GainNode | null = null;

    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;
    
    // Gerçek akustik bateri ses kütüphanesinin önbelleği (Cache)
    private drumBuffers: Record<string, AudioBuffer> = {};

    constructor(instrumentName: string = 'acoustic_grand_piano') {
        this.instrumentName = instrumentName;
        this.initPromise = this.init();
    }

    // Programatik olarak muazzam bir Stereo Konser Salonu (Concert Hall) Yankısı üretir
    // Sıfır gecikmeli, ağ bağlantısına ihtiyaç duymayan kusursuz algoritmik convolution Reverb
    private createConcertHallReverb(): ConvolverNode {
        const rate = this.ac!.sampleRate;
        const length = rate * 2.8; // 2.8 saniyelik devasa, büyüleyici kuyruklu konser yankısı
        const impulse = this.ac!.createBuffer(2, length, rate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            // Zamana göre üstel (exponential) olarak sönen doğal beyaz gürültü odası yankısı
            const decay = Math.exp(-i / (rate * 0.75));
            left[i] = (Math.random() * 2 - 1) * decay;
            right[i] = (Math.random() * 2 - 1) * decay;
        }

        const convolver = this.ac!.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    private async init(): Promise<void> {
        if (this.isInitialized || typeof window === 'undefined') {
            return;
        }
        
        try {
            this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // --- KOMPRESÖR (MASTERING GLUE COMPRESSOR) ---
            this.compressor = this.ac.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-18, this.ac.currentTime); 
            this.compressor.knee.setValueAtTime(12, this.ac.currentTime);       
            this.compressor.ratio.setValueAtTime(3.5, this.ac.currentTime);        
            this.compressor.attack.setValueAtTime(0.015, this.ac.currentTime);    
            this.compressor.release.setValueAtTime(0.20, this.ac.currentTime);   
 
            // --- MASTER GAIN ---
            this.masterGain = this.ac.createGain();
            this.masterGain.gain.setValueAtTime(1.1, this.ac.currentTime);       
 
            // --- PROGRAMATİK CONCERT HALL REVERB SİNYAL ZİNCİRİ ---
            this.reverbNode = this.createConcertHallReverb();
            this.reverbGain = this.ac.createGain();
            // %20 oranında yankı (Lush, 3D, sinematik uzay hissi)
            this.reverbGain.gain.setValueAtTime(0.20, this.ac.currentTime);

            // Sinyal Bağlantıları (Parallel FX Send):
            // 1. Dry Path (Kuru Sinyal): masterGain -> compressor
            this.masterGain.connect(this.compressor);
            
            // 2. Wet Path (Yankılı Sinyal): masterGain -> reverb -> reverbGain -> compressor
            this.masterGain.connect(this.reverbNode);
            this.reverbNode.connect(this.reverbGain);
            this.reverbGain.connect(this.compressor);

            // 3. Final Output (Ana Çıkış): compressor -> hoparlörler
            this.compressor.connect(this.ac.destination);
 
            if (this.instrumentName === 'synth_drum') {
                // EĞER ENSTRÜMAN BATERİ İSE: Soundfont yerine gerçek akustik WAV dalgalarını indiriyoruz!
                console.log("Gerçek Akustik Bateri Kit örnekleri yükleniyor...");
                const uniqueUrls = Array.from(new Set(Object.values(DRUM_SAMPLES)));
                
                await Promise.all(uniqueUrls.map(async (url) => {
                    try {
                        const response = await fetch(url);
                        const arrayBuffer = await response.arrayBuffer();
                        // Tarayıcı ses motorunun çözebileceği AudioBuffer nesnesine çevirir
                        const audioBuffer = await this.ac!.decodeAudioData(arrayBuffer);
                        this.drumBuffers[url] = audioBuffer;
                    } catch (err) {
                        console.error(`Davul örneği yüklenemedi: ${url}`, err);
                    }
                }));
                console.log("✅ Gerçek Akustik Bateri Kiti başarıyla yüklendi!");
            } else {
                // DİĞER ENSTRÜMANLAR İÇİN: Standart soundfont-player (OGG formatı ile yüksek kalite)
                this.piano = await Soundfont.instrument(this.ac, this.instrumentName as InstrumentName, {
                    destination: this.masterGain,
                    gain: 2.2,
                    soundfont: 'MusyngKite',
                    format: 'ogg'
                });
                console.log(`✅ Profesyonel Soundfont (${this.instrumentName}) başlatıldı.`);
            }

            this.isInitialized = true;

        } catch (e) {
            console.error("Ses sistemi başlatılamadı:", e);
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
        if (!this.isInitialized) {
            if (this.initPromise) await this.initPromise;
            if (!this.isInitialized) {
                console.error("Ses sistemi hazır değil, nota çalınamıyor.");
                return;
            }
        }

        if (!this.ac) return;

        // EĞER AKUSTİK BATERİ MODUNDAYSAK
        if (this.instrumentName === 'synth_drum') {
            const url = getDrumSampleUrl(key);
            const buffer = this.drumBuffers[url];
            if (buffer) {
                const source = this.ac.createBufferSource();
                source.buffer = buffer;
                
                // Dinamik vuruş gücü (velocity) ayarı
                const gainNode = this.ac.createGain();
                const gain = (velocity / 127) ** 1.5; // vuruş hissini daha dinamik yapmak için
                gainNode.gain.setValueAtTime(gain * 1.5, this.ac.currentTime); // Akustik dolgunluğu artırmak için bir miktar güç katıyoruz
                
                source.connect(gainNode);
                gainNode.connect(this.masterGain!);
                source.start(this.ac.currentTime);
            }
            return;
        }

        // STANDART ENSTRÜMAN MODUNDAYSAK (Piyano, Gitar vs.)
        if (!this.piano) return;
        const noteName = this.midiToNoteName(key);
        const gain = (velocity / 127) ** 2;

        this.piano.play(noteName, this.ac.currentTime, {
            duration: time / 1000000, 
            gain: gain, 
        });
    }

    public destroy() {
        if (this.ac) {
            try {
                this.ac.close();
            } catch (e) {
                console.error("AudioContext kapatılırken hata oluştu:", e);
            }
            this.ac = null;
        }
        this.piano = null;
        this.drumBuffers = {};
        this.isInitialized = false;
        console.log(`Soundfont player temizlendi ve kapatıldı (${this.instrumentName}).`);
    }
}

export default soundManager;