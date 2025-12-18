import React from 'react';

export default function MIDIPianoRoll({ midiUrl }: { midiUrl: string }) {
  return (
    <div className="w-full flex flex-col items-center mt-4">
      <div
        className="overflow-x-auto w-full bg-[#232a34] rounded shadow p-2"
        style={{ minHeight: 130 }}
        data-midi-url={midiUrl}
      />
      <div className="text-xs text-gray-400 mt-1">Piyano Roll Görselleştirme (Magenta kaldırıldı)</div>
    </div>
  );
} 