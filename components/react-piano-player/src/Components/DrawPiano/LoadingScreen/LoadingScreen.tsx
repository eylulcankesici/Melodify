import React, { ReactElement, useState, useEffect } from 'react';
import './LoadingScreen.scss';

interface LoadingScreenProps {
  width: number;
  height: number;
  onLoaded: Function;
  Finished: boolean;
}

export default function LoadingScreen({
  width,
  height,
  onLoaded,
  Finished,
}: LoadingScreenProps): ReactElement | null {
  const [isContentReady, setIsContentReady] = useState(false);
  const [isMinTimePassed, setIsMinTimePassed] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isAnimationDone, setIsAnimationDone] = useState(false);

  // onLoaded() çağrısı ve minimum 3 saniyelik zamanlayıcı.
  useEffect(() => {
    onLoaded();
    const timer = setTimeout(() => {
      setIsMinTimePassed(true);
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // İçeriğin yüklenmesinin bittiğini kontrol et.
  useEffect(() => {
    if (Finished) {
      setIsContentReady(true);
    }
  }, [Finished]);

  // Her iki koşul da sağlandığında gizleme animasyonunu başlat.
  useEffect(() => {
    if (isContentReady && isMinTimePassed) {
      setIsHiding(true);
    }
  }, [isContentReady, isMinTimePassed]);
  
  // CSS animasyonu bittiğinde bileşeni DOM'dan kaldır.
  useEffect(() => {
    if (isHiding) {
        const timer = setTimeout(() => {
            setIsAnimationDone(true);
        }, 500); // SCSS'deki transition süresiyle eşleşmeli
        return () => clearTimeout(timer);
    }
  }, [isHiding]);

  if (isAnimationDone) {
    return null; // Animasyon bitti, şimdi kaldırabiliriz.
  }

  return (
    <div
      className="LoadingScreen"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        opacity: isHiding ? 0 : 1,
      }}
    >
      <div className="notes-container">
        {/* Notaları çeşitlendirdik */}
        <span className="note">♪</span>
        <span className="note">♫</span>
        <span className="note">♩</span>
        <span className="note">♬</span>
        <span className="note">♪</span>
      </div>
      <h2></h2>
    </div>
  );
}