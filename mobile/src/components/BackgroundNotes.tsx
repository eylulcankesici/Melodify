import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const notes = [
  { symbol: '♪', color: '#268bd2', size: 64, top: '5%', left: '10%', delay: 0 },
  { symbol: '♫', color: '#b58900', size: 48, top: '15%', left: '25%', delay: 1000 },
  { symbol: '♮', color: '#657b83', size: 56, top: '30%', left: '8%', delay: 2000 },
  { symbol: '♭', color: '#586e75', size: 40, top: '45%', left: '45%', delay: 3000 },
  { symbol: '♩', color: '#b58900', size: 52, top: '55%', left: '85%', delay: 1500 },
  { symbol: '♬', color: '#859900', size: 72, top: '18%', left: '80%', delay: 500 },
  { symbol: '♯', color: '#cb4b16', size: 60, top: '75%', left: '15%', delay: 2500 },
  { symbol: '♫', color: '#d33682', size: 50, top: '85%', left: '75%', delay: 3500 },
  { symbol: '♪', color: '#2aa198', size: 68, top: '65%', left: '60%', delay: 4000 },
  { symbol: '♬', color: '#d33682', size: 90, top: '85%', left: '10%', delay: 200 },
  { symbol: '♮', color: '#859900', size: 80, top: '90%', left: '50%', delay: 1200 },
];

export default function BackgroundNotes() {
  return (
    <View style={StyleSheet.absoluteFillObject} className="opacity-30 -z-10" pointerEvents="none">
      {notes.map((note, index) => (
        <FloatingNote key={index} note={note} />
      ))}
    </View>
  );
}

function FloatingNote({ note }: { note: any }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 3000, useNativeDriver: true })
        ])
      ).start();
    }, note.delay);
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25] // Hafifçe yukarı aşağı süzülme
  });

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          top: note.top as any,
          left: note.left as any,
          color: note.color,
          fontSize: note.size,
          fontWeight: '900',
          transform: [{ translateY }]
        }
      ]}
    >
      {note.symbol}
    </Animated.Text>
  );
}
