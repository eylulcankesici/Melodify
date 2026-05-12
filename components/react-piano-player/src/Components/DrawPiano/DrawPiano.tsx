import React, { ReactElement, useState, useEffect, useRef } from 'react';
import './DrawPiano.styles.css';

import { noteEvent } from "../../Utils/TypesForMidi";
import { Options as OptionsType } from '../../Utils/TypesForOptions';
import MidiPlayer from '../../Helpers/MidiPlayer';
import {TracksInterval, TracksAnimationFrame} from '../Tracks';
import soundManager from '../../Helpers/soundManager';

import Gear from '../../Assets/Rhombus.gif';

interface DrawPianoProps{
    Data: Array<noteEvent> | undefined,
    Speed: number,
    options: OptionsType,
    drawSpeed: number,
    Player: MidiPlayer,
    sound: soundManager | undefined;
}

export default function DrawPiano({Data,Speed,options,drawSpeed,Player, sound}:DrawPianoProps):ReactElement {
    
    const pianoContainerRef = useRef<HTMLDivElement>(null);
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
    const [WhiteKeyWidth, setWhiteKeyWidth] = useState<number>(0);

    useEffect(() => {
        const handleResize = () => {
            if (pianoContainerRef.current) {
                const { width, height } = pianoContainerRef.current.getBoundingClientRect();
                setContainerDimensions({ width, height });
                setWhiteKeyWidth(width / 52); 
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        
        return () => window.removeEventListener('resize', handleResize);
    },[]);


    const KeysPositions = (type:('black' | 'all')):Array<any> =>{
        let Returning:Array<any> = [];
        let counter_ids:number = 21;
        for(let x = 0; x < 52; x++){
            type === 'all' && Returning.push({position: WhiteKeyWidth * x, noteNumber: counter_ids,width:WhiteKeyWidth});
            const num = counter_ids % 12;
            if(num  === 1 - 1 || num === 3 - 1 || num === 6 - 1 || num ===8 - 1 || num ===10 - 1  ){
                counter_ids++;
                if(counter_ids < 109){
                type ==='all' && Returning.push({position : WhiteKeyWidth * x + WhiteKeyWidth / 1.4, notenumber: counter_ids,width:WhiteKeyWidth/1.8});
                type === 'black' && Returning.push(counter_ids);
                }
            }
            counter_ids++;
        }
        return Returning;
    }

    const RenderTracks = ():ReactElement =>{
        if(options.renderMethod === 'Interval'){
            return <TracksInterval
             Speed={drawSpeed} Data={Data!} 
             BlackNumbers={KeysPositions('black')} 
             KeysPositions={KeysPositions('all')} 
             intervalSpeed={Speed} 
             options={options} 
             Player={Player}
             sound={sound}/>
        }else{
            return <TracksAnimationFrame
             Speed={drawSpeed} Data={Data!}
             Width={containerDimensions.width}
             Height={containerDimensions.height}
             BlackNumbers={KeysPositions('black')} 
             KeysPositions={KeysPositions('all')} 
             intervalSpeed={Speed} 
             options={options} 
             Player={Player}
             sound={sound}/>
        }
    }

    return (
        <div ref={pianoContainerRef} className='Piano' style={{height: '100%', width: '100%'}}>
            {sound && options.soundOn && RenderTracks()}
            <div style={{
                display: !sound && options.soundOn ? 'flex' : 'none',
                width: '100%', 
                height: '100%'
            }} className='loading_sound'>
                <img src={Gear.src} alt='Loading' />
                <h2>Sound Loading</h2>
                <h3>If sound is not loading try clicking anywhere on the screen</h3>
            </div>
            {!options.soundOn && RenderTracks()}
        </div>
    )
}