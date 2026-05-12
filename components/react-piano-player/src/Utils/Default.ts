import { Options } from "./TypesForOptions";

const data: Options = {
    Color: '#957DAD', // Akan notaların rengi
    OctaveLines: true,
    KeyPressColor: '#84E3F0', // Basılan tuşların ve notaların rengi
    RandomColors: false,
    IsEffects: false,
    backgroundImage: '',
    speed: 35,
    playSpeed: 5,
    watermark: false,
    soundOn: true,
    renderMethod: 'animationFrame',
    Effect: 'fountain',
    blockRadius: 10,
    ShadowColor: '#000',
    blockShadowRadius: 6,
    EffectsBlockColor: false,
    randomEffectColors: false,
    EffectsKeyColor: false,
    EffectsColor: '#ffffff',
    GameMode: false,
    ThinerBlockColor: '#FEC8D8', // İnce notaların rengi (tutarlılık için)
    GradientColor: '#128282',
    GradientBlocks: false,
    GradientBlocksColor: ['#224455', '#aa2244']
};

let DefaultOptions: Options = data;

/*
// Tarayıcının yerel deposundan ayarları okuyan ve kaydeden kısım,
// koddan yapılan değişikliklerin geçerli olması için devre dışı bırakıldı.
if (typeof window !== 'undefined') {
    let storedOptions: Options | null = null;
    try {
        const item = localStorage.getItem('options');
        if (item) {
            storedOptions = JSON.parse(item);
        }
    } catch (e) {
        console.error("Failed to parse options from localStorage", e);
    }
    
    if (storedOptions) {
        DefaultOptions = { ...data, ...storedOptions };
    }

    localStorage.setItem('options', JSON.stringify(DefaultOptions));
}
*/

export { DefaultOptions };
export { data };