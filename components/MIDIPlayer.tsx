import React from 'react';

export default function MIDIPlayer({ midiUrl }: { midiUrl: string }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = midiUrl;
    link.download = 'melodi.mid';
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <button
        onClick={handleDownload}
        className="px-4 py-2 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600"
      >
        MIDI Dosyasını İndir
      </button>
      <div className="text-xs text-gray-400 mt-2">(Not: Basit MIDI çalma için ek modül eklenebilir)</div>
    </div>
  );
} 