import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DrawPiano from '../../Components/DrawPiano/DrawPiano';
import PlayingManagement from '../../Components/PlayingManagement/PlayingManagement';
import MidiPlayer from '../../Helpers/MidiPlayer';
import { DefaultOptions } from '../../Utils/Default';
import { Options as OptionsType } from '../../Utils/TypesForOptions';
import { noteEvent, IMidiFile } from "../../Utils/TypesForMidi";
import soundManager from '../../Helpers/soundManager';
import '../../App.css'; 

interface PlayProps {
    midiFile: IMidiFile;
    noteEvents: noteEvent[];
    fileName?: string;
}

export default function Play({ midiFile, noteEvents, fileName }: PlayProps) {

    const [options, setOptions] = useState<OptionsType>(DefaultOptions);
    const [activeNotes, setActiveNotes] = useState<noteEvent[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [instrument, setInstrument] = useState<string>('acoustic_grand_piano');

    // URL'deki parametreyi veya dosya ismini dinleyerek enstrümanı otomatik belirle
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const instrParam = params.get('instrument');
        
        if (instrParam) {
            setInstrument(instrParam);
        } else if (fileName) {
            const nameLower = fileName.toLowerCase();
            if (nameLower.includes('drum') || nameLower.includes('bateri') || nameLower.includes('adtof')) {
                setInstrument('synth_drum');
            } else {
                setInstrument('acoustic_grand_piano');
            }
        }
    }, [fileName]);

    const [sound, setSound] = useState<soundManager | undefined>(undefined);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        console.log(`Enstrüman değiştiriliyor: ${instrument}`);
        const manager = new soundManager(instrument);
        setSound(manager);

        return () => {
            console.log(`Önceki enstrüman temizleniyor: ${instrument}`);
            manager.destroy();
        };
    }, [instrument]);

    // MidiPlayer'dan gelen yeni nota olaylarını işleyen callback
    const handleMidiEvent = useCallback((newEvents: noteEvent[]) => {
        if (newEvents.length > 0) {
            setActiveNotes(newEvents);
        }
    }, []);
    
    // MidiPlayer'ı yalnızca bir kez oluştur ve başlangıçta duraklat.
    const Player = useMemo(() => {
        const p = new MidiPlayer(noteEvents, handleMidiEvent, 25);
        p.PausePlay(); // Başlangıçta duraklatılmış başlar
        return p;
    }, [noteEvents, handleMidiEvent]);

    // Oynat/Duraklat butonuna basıldığında çalışır
    const handleTogglePlay = useCallback(() => {
        Player.PausePlay();
        setIsPlaying(currentIsPlaying => !currentIsPlaying);
    }, [Player]);

    // Durdur butonuna basıldığında çalışır
    const handleStop = useCallback(() => {
        Player.Restart();
        setIsPlaying(false);
    }, [Player]);
    
    // İlerleme çubuğuna tıklandığında çalışır
    const handleMove = useCallback((percent: number) => {
        Player.MoveTo(percent);
        if (!Player.isPaused) {
           setIsPlaying(true);
        }
    }, [Player]);

    // Bileşen hazır olduğunda oynatmayı otomatik olarak başlat
    useEffect(() => {
        handleTogglePlay();
    }, [handleTogglePlay]);


    return (
        <div className='Main_container' style={{overflow:'hidden', width: '100%', height: '100%', position: 'relative'}}>

            {Player && (
                <>
                    <DrawPiano 
                        drawSpeed={options.playSpeed} 
                        Player={Player} 
                        Data={activeNotes} 
                        Speed={options.speed} 
                        options={options}
                        sound={sound}
                    />
                    <PlayingManagement 
                        Player={Player} 
                        onTogglePlay={handleTogglePlay}
                        onStop={handleStop}
                        onMove={handleMove}
                        isPlaying={isPlaying}
                    />
                </>
            )}
        </div>
    )
}