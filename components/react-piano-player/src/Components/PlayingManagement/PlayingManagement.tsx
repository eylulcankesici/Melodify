import React, { MouseEvent, ReactElement, useEffect, useState } from 'react';
import MidiPlayer from '../../Helpers/MidiPlayer';
import LogoPrototype from '../../Assets/piano_icon.png';

interface PlayingManagementProps {
    Player: MidiPlayer,
    onTogglePlay: () => void;
    onStop: () => void;
    onMove: (percent: number) => void;
    isPlaying: boolean;
}

export default function PlayingManagement({ Player, onTogglePlay, onStop, onMove, isPlaying }: PlayingManagementProps): ReactElement {

    const [opacity, setOpacity] = useState<number>(0);
    const [width, setWidth] = useState("0%");
    const [currentTime, setCurrentTime] = useState('00:00');
    const [totalDuration, setTotalDuration] = useState('00:00');

    const formatTime = (ms: number): string => {
        if (isNaN(ms) || ms < 0) {
            return '00:00';
        }
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    useEffect(() => {
        let opacityTimeout: any = 0;
        const move = () => {
            clearTimeout(opacityTimeout);
            setOpacity(1);
            opacityTimeout = setTimeout(() => {
                setOpacity(0);
            }, 2500);
        }
        
        document.body.addEventListener('mousemove', move);

        const handleSpacebar = (event: KeyboardEvent) => {
            if (event.key === ' ') {
                event.preventDefault();
                onTogglePlay();
            }
        }
        document.addEventListener('keyup', handleSpacebar);

        const timeInterval = setInterval(() => {
            if(Player.isReady) {
                const currentMs = Player.get_time();
                const totalMs = Player.MidiLength;
                
                setWidth((currentMs / totalMs * 100).toString() + '%');
                setCurrentTime(formatTime(currentMs));
                
                if (totalDuration === '00:00' && totalMs > 0) {
                    setTotalDuration(formatTime(totalMs));
                }
            }
        }, 100);

        return () => {
            clearTimeout(opacityTimeout);
            clearInterval(timeInterval);
            document.body.removeEventListener('mousemove', move);
            document.removeEventListener('keyup', handleSpacebar);
        }
    }, [Player, totalDuration, onTogglePlay]);


    const onDurClick = (ev: MouseEvent<HTMLDivElement>): void => {
        const target_data = ev.currentTarget.getBoundingClientRect();
        const percent = Math.floor((ev.clientX - target_data.x) * 100 / target_data.width);
        onMove(percent);
    }

    return (
        <>
            <style jsx>{`
                .Playing_main {
                    /* Genişliği artırıp yeniden ortalıyoruz */
                    width: 85%;
                    left: 7.5%;
                    padding: 0 25px;
                    height: 54px;
                    background-color: hsla(324, 40.30%, 35.50%, 0.85);
                    position: absolute;
                    z-index: 200;
                    bottom: 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-sizing: border-box;
                    transition: 0.25s ease;
                    border-top-left-radius: 10px;
                    border-top-right-radius: 10px;
                    box-shadow: 0px -3px 6px rgba(0, 0, 0, 0.5);
                    color: white;
                }
                .controls-left {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0; /* Kontrollerin küçülmesini engelle */
                }
                .icons {
                    display: flex;
                    align-items: center;
                }
                .icons i {
                    font-size: 32px;
                    margin: 0 10px;
                    transition: 0.1s ease;
                    cursor: pointer;
                }
                .icons i:hover {
                    transform: scale(1.2);
                    text-shadow: 0px 0px 8px rgb(170, 40, 209);
                }
                .LogoImg {
                    cursor: pointer;
                    width: 35px;
                    margin-right: 15px;
                }
                /* Zaman göstergeleri ve ilerleme çubuğu için yeni kapsayıcı */
                .playback-bar-container {
                    display: flex;
                    align-items: center;
                    flex-grow: 1; /* Kalan tüm boşluğu doldurur */
                    margin: 0 20px;
                }
                .TimeDisplay {
                    color: white;
                    font-size: 16px;
                    font-weight: bold;
                    font-family: 'Courier New', Courier, monospace;
                    white-space: nowrap; /* Zamanın alt satıra kaymasını engeller */
                }
                .TimeDisplay.current {
                    margin-right: 15px;
                }
                .TimeDisplay.total {
                    margin-left: 15px;
                }
                .Duration {
                    flex-grow: 1; /* Zaman göstergeleri arasındaki boşluğu doldurur */
                    height: 10px; /* Çubuğu biraz daha ince yapalım */
                    border: 1px dotted rgb(255, 255, 255);
                    border-radius: 5px;
                    position: relative;
                    cursor: pointer;
                }
                .Bar {
                    position: absolute;
                    opacity: 0.9;
                    height: 100%;
                    background: linear-gradient(90deg, rgb(20, 151, 147), rgb(2, 56, 64));
                    border-radius: 5px;
                }
            `}</style>

            <div className='Playing_main' style={{ opacity: opacity }}>
                <div className='controls-left'>
                    <div className='icons'>
                        <img src={LogoPrototype.src} alt='Logo' title='Logo' className='LogoImg' />
                        {isPlaying ? (
                            <i className="fa fa-pause" aria-hidden="true" onClick={onTogglePlay} title='Pause'></i>
                        ) : (
                            <i className="fa fa-play" aria-hidden="true" onClick={onTogglePlay} title='Play'></i>
                        )}
                        <i className="fa fa-stop" aria-hidden="true" onClick={onStop} title='Reset'></i>
                    </div>
                </div>
                
                {/* Yeni, daha sağlam çalma çubuğu yapısı */}
                <div className='playback-bar-container'>
                    <div className='TimeDisplay current'>
                        {currentTime}
                    </div>
                    <div className='Duration' onClick={onDurClick}>
                        <div className='Bar' style={{ width: width }} />
                    </div>
                    <div className='TimeDisplay total'>
                        {totalDuration}
                    </div>
                </div>
            </div>
        </>
    )
}