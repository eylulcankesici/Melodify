"use client";

import React, { useState, useEffect } from "react";
import Play from "./Pages/Play/Play";
import ConvertToNoteEventsJSON from "./Helpers/getNoteEventsJSON";
import { parseArrayBuffer } from "midi-json-parser";
import { IMidiFile, noteEvent } from "./Utils/TypesForMidi"; 

interface PianoPlayerProps {
  midiUrl?: string;
}

const PianoPlayer: React.FC<PianoPlayerProps> = ({ midiUrl }) => {
  const [midiFile, setMidiFile] = useState<IMidiFile | null>(null);
  const [noteEvents, setNoteEvents] = useState<noteEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (midiUrl) {
      setIsLoading(true);
      setIsPlaying(false);
      const processMidi = async () => {
        try {
          const response = await fetch(midiUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch MIDI file: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const midiJson: IMidiFile = await parseArrayBuffer(arrayBuffer);
          
          const staticMidiData = {
            division: midiJson.division,
            nominator: midiJson.tracks[0]?.find(event => 'timeSignature' in event)?.timeSignature.numerator ?? 4,
            denominator: midiJson.tracks[0]?.find(event => 'timeSignature' in event)?.timeSignature.denominator ?? 4,
            metronome: midiJson.tracks[0]?.find(event => 'metronome' in event)?.metronome.metronome ?? 24,
            thirtyseconds: midiJson.tracks[0]?.find(event => 'timeSignature' in event)?.timeSignature.thirtyseconds ?? 8
          };

          const processedNoteEvents = ConvertToNoteEventsJSON(
            midiJson,
            midiJson.tracks[0]?.find(event => 'setTempo' in event)?.setTempo.microsecondsPerQuarter ?? 500000,
            staticMidiData
          );
          
          setMidiFile(midiJson);
          setNoteEvents(processedNoteEvents);
        } catch (error) {
          console.error("Error processing MIDI file:", error);
        } finally {
          setIsLoading(false);
        }
      };

      processMidi();
    }
  }, [midiUrl]);

  const handlePlayClick = () => {
    if (!isLoading) {
      setIsPlaying(true);
    }
  };

  if (isPlaying && midiFile && noteEvents) {
    return <Play midiFile={midiFile} noteEvents={noteEvents} />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center" style={{ backgroundColor: '#dcd5c4' }}>
      <div 
        className="absolute inset-0 bg-[#dcd5c4] bg-opacity-50 flex items-center justify-center z-10 cursor-pointer"
        onClick={handlePlayClick}
      >
        <button
          onClick={handlePlayClick}
          disabled={isLoading}
          className="w-24 h-24 rounded-full bg-[#D291BC] text-white flex items-center justify-center text-4xl shadow-lg transition-all hover:bg-[#957DAD] :disabled:bg-[#D291BC] disabled:cursor-not-allowed"
          aria-label="Play"
        >
          {isLoading ? (
            <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            '▶'
          )}
        </button>
      </div>
       {/* Arka planda hafifçe görünecek piyano önizlemesi */}
       <div className="absolute inset-0 z-0 opacity-10">
         {midiFile && noteEvents && <Play midiFile={midiFile} noteEvents={noteEvents} />}
       </div>
    </div>
  );
};

export default PianoPlayer;