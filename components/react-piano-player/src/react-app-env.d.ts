/// <reference types="react-scripts" />
declare module '*.mp4';
declare module '*.MID';
declare module '*.ogg';
declare module '*.png';
declare module '*.jpeg';
declare module 'hex2dec' {
  export function decToHex(dec: number): string;
  export function hexToDec(hex: string): number;
}
declare module 'hex-rgba' {
  function hexToRgba(hex: string, alpha: number): string;
  export default hexToRgba;
}