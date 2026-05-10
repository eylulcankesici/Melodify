"""
Melodify - MIDI → Nota Kağıdı (PDF) Test Scripti
Kullanım: python midi_to_sheet.py <dosya.mid>
Örnek:    python midi_to_sheet.py ornek.mid
"""

import sys
import os
# pyrefly: ignore [missing-import]
import music21

# ─── LilyPond Yolu (Kendi kurulumuna göre ayarla) ─────────────────────────────
LILYPOND_PATH = r"C:\lilypond-2.26.0\bin\lilypond.exe"

def midi_to_pdf(midi_path: str) -> str:
    # 1. Dosya var mı kontrol et
    if not os.path.exists(midi_path):
        print(f"HATA: '{midi_path}' adında bir dosya bulunamadı.")
        print("Lütfen bir .mid dosyasını C:\\melodify2.0\\backend klasörüne kopyalayıp tekrar dene.")
        sys.exit(1)

    # 2. LilyPond'u music21'e tanıt
    if not os.path.exists(LILYPOND_PATH):
        print(f"HATA: LilyPond bulunamadı → {LILYPOND_PATH}")
        print("LilyPond'un doğru klasöre kurulduğundan emin ol.")
        sys.exit(1)

    music21.environment.set('lilypondPath', LILYPOND_PATH)
    print(f"✓ LilyPond bulundu: {LILYPOND_PATH}")

    # 3. MIDI dosyasını yükle ve parse et
    print(f"→ MIDI yükleniyor: {midi_path}")
    score = music21.converter.parse(midi_path)
    print(f"✓ MIDI başarıyla okundu. {len(score.parts)} enstrüman/parça bulundu.")

    # 4. Çıktı PDF yolunu oluştur (aynı dizine, aynı isimle)
    base_name = os.path.splitext(os.path.basename(midi_path))[0]
    output_dir = os.path.dirname(os.path.abspath(midi_path))
    output_pdf = os.path.join(output_dir, f"{base_name}_nota.pdf")

    # 5. Nota sürelerini LilyPond'un anlayabileceği şekilde düzelt (Quantize)
    print("→ Nota süreleri düzeltiliyor (quantize)...")
    
    for part in score.parts:
        for note in part.flatten().notesAndRests:
            # LilyPond maksimum 'longa' = 16 quarter note destekler.
            # Daha uzun notaları 4 quarter note (whole note) ile sınırla
            if note.duration.quarterLength > 4.0:
                note.duration.quarterLength = 4.0
    
    # Notasyonu düzgün hale getir (ölçü çizgileri, anahtar vs.)
    score = score.makeNotation()

    # 6. PDF olarak kaydet
    print(f"→ Nota kağıdı oluşturuluyor... (LilyPond çalışıyor, birkaç saniye sürebilir)")
    score.write('lily.pdf', fp=output_pdf)

    print(f"\n✅ Başarılı! PDF kaydedildi:")
    print(f"   {output_pdf}")
    return output_pdf


if __name__ == "__main__":
    # Komut satırından dosya adı al
    if len(sys.argv) < 2:
        print("Kullanım: python midi_to_sheet.py <dosya.mid>")
        print("Örnek:    python midi_to_sheet.py ornek.mid")
        print()
        # Klasördeki .mid dosyalarını listele
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        mid_files = [f for f in os.listdir(backend_dir) if f.endswith(('.mid', '.midi'))]
        if mid_files:
            print("Klasörde bulunan MIDI dosyaları:")
            for f in mid_files:
                print(f"  → {f}")
        else:
            print("⚠ Klasörde hiç .mid dosyası bulunamadı.")
            print(f"  Bir .mid dosyasını şu dizine kopyala: {backend_dir}")
        sys.exit(0)

    # MIDI dosyasının tam yolunu oluştur
    midi_arg = sys.argv[1]
    if not os.path.isabs(midi_arg):
        # Göreceli yol verilmişse backend klasörüne göre çöz
        midi_arg = os.path.join(os.path.dirname(os.path.abspath(__file__)), midi_arg)

    midi_to_pdf(midi_arg)
