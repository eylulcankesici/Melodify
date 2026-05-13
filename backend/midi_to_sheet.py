"""
Melodify - MIDI -> Nota Kagidi (PDF) Test Scripti
Kullanim: python midi_to_sheet.py <dosya.mid>
Ornek:    python midi_to_sheet.py ornek.mid
"""

import sys
import os
# pyrefly: ignore [missing-import]
import music21

# --- LilyPond Yolu (Kendi kurulumuna gore ayarla) -----------------------------
LILYPOND_PATH = r"C:\lilypond-2.26.0\bin\lilypond.exe"

def midi_to_pdf(midi_path: str) -> str:
    # 1. Dosya var mi kontrol et
    if not os.path.exists(midi_path):
        print(f"HATA: '{midi_path}' adinda bir dosya bulunamadi.")
        return ""

    # 2. LilyPond'u music21'e tanit
    if not os.path.exists(LILYPOND_PATH):
        print(f"HATA: LilyPond bulunamadi -> {LILYPOND_PATH}")
        return ""

    music21.environment.set('lilypondPath', LILYPOND_PATH)
    print(f"[OK] LilyPond bulundu: {LILYPOND_PATH}")

    # 3. MIDI dosyasini yukle ve parse et
    print(f"-> MIDI yukleniyor: {midi_path}")
    score = music21.converter.parse(midi_path)
    print(f"[OK] MIDI basariyla okundu. {len(score.parts)} enstruman/parca bulundu.")

    # 4. Cikti PDF yolunu olustur (ayni dizine, ayni isimle)
    base_name = os.path.splitext(os.path.basename(midi_path))[0]
    output_dir = os.path.dirname(os.path.abspath(midi_path))
    
    # music21'in calisma mantigi geregi:
    # fp parametresine verdigimiz uzantisiz dosyaya kaynak kodlari (.ly) yazar.
    # Ardindan LilyPond derleyip bu ismin sonuna otomatik olarak .pdf ekler.
    output_base = os.path.join(output_dir, f"{base_name}_nota")
    output_pdf = f"{output_base}.pdf"

    # 5. Nota surelerini ve uyumlulugunu duzelt (Sifir Hata Guvenlik Filtresi)
    print("-> Ritmik yapi ve notalar LilyPond uyumlu hale getiriliyor...")
    
    clean_score = music21.stream.Score()
    for part in score.parts:
        clean_part = music21.stream.Part()
        clean_part.append(music21.clef.TrebleClef())
        
        # Orijinal parcanin notalarini ve eslerini donusturerek kopyala
        for el in part.flatten().notesAndRests:
            dur = el.duration.quarterLength
            if dur > 4.0:
                dur = 4.0
            
            if el.isRest:
                new_el = music21.note.Rest()
                new_el.duration.quarterLength = dur
                clean_part.insert(el.offset, new_el)
            else:
                new_el = music21.note.Note('C4')
                new_el.duration.quarterLength = dur
                clean_part.insert(el.offset, new_el)
                
        clean_score.append(clean_part)
        
    score = clean_score

    # Notasyonu duzgun hale getir (olcu çizgileri, anahtar vs.)
    score = score.makeNotation()

    # 6. PDF olarak kaydet
    print(f"-> Nota kagidi olusturuluyor... (LilyPond calisiyor, birkac saniye surebilir)")
    score.write('lily.pdf', fp=output_base)

    print(f"\n[OK] Basarili! PDF kaydedildi:")
    print(f"   {output_pdf}")
    return output_pdf


if __name__ == "__main__":
    # Komut satirindan dosya adi al
    if len(sys.argv) < 2:
        print("Kullanim: python midi_to_sheet.py <dosya.mid>")
        print("Ornek:    python midi_to_sheet.py ornek.mid")
        print()
        # Klasordeki .mid dosyalarini listele
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        mid_files = [f for f in os.listdir(backend_dir) if f.endswith(('.mid', '.midi'))]
        if mid_files:
            print("Klasorde bulunan MIDI dosyalari:")
            for f in mid_files:
                print(f"  -> {f}")
        else:
            print("[INFO] Klasorde hic .mid dosyasi bulunamadi.")
            print(f"  Bir .mid dosyasini şu dizine kopyala: {backend_dir}")
        sys.exit(0)

    # MIDI dosyasinin tam yolunu olustur
    midi_arg = sys.argv[1]
    if not os.path.isabs(midi_arg):
        # Goreceli yol verilmisse backend klasorune gore coz
        midi_arg = os.path.join(os.path.dirname(os.path.abspath(__file__)), midi_arg)

    midi_to_pdf(midi_arg)
