import React,{useEffect,useState, useMemo} from 'react';

import DrawPiano from '../../Components/DrawPiano/DrawPiano';
import PlayingManagement from '../../Components/PlayingManagement/PlayingManagement';
import MidiPlayer from '../../Helpers/MidiPlayer';
import { DefaultOptions } from '../../Utils/Default';
import { Options as OptionsType } from '../../Utils/TypesForOptions';
import { noteEvent } from "../../Utils/TypesForMidi";
import soundManager from '../../Helpers/soundManager';

export default function PlayRecorded() {

    const [options,setOptions] = useState<OptionsType>(DefaultOptions);
    const [Player,setPlayer] = useState<MidiPlayer>();
    const [Events,setEvents] = useState<Array<noteEvent>>();

    const sound = useMemo(() => {
        if (typeof window !== 'undefined') {
            return new soundManager();
        }
        return undefined;
    }, []);

    useEffect(() => {
        const options = JSON.parse(localStorage.getItem('options')!);
        const file = JSON.parse(localStorage.getItem('fileJson')!);
        setOptions(options);
        setPlayer(new MidiPlayer(file,handleMidiEvent,25));
    }, []);

    const handleMidiEvent = (Events:Array<noteEvent>) =>{
        Events.length > 0 && setEvents(Events);
    }

    return (
        <div style={{overflow:'hidden'}}>
            {Player &&<DrawPiano drawSpeed={options.playSpeed} Player={Player} Data={Events} Speed={options.speed} options={options} sound={sound}/>}
            {Player && <PlayingManagement Player={Player} onStart={()=>{}} />}
        </div>
    )
}