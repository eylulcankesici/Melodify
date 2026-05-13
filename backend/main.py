import os
import sys
import json
import subprocess
import urllib.request
import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException, File, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Next.js projesindeki .env.local dosyasındaki Supabase şifrelerini Python'a çekiyoruz
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
load_dotenv(dotenv_path=dotenv_path)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# GÜVENLİK GÜNCELLEMESİ: Service key kesinlikle NEXT_PUBLIC_ ile başlamamalıdır!
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

app = FastAPI(title="Melodify AI Arka Kısım (Mobile & Web)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # HTTP standardı ile 3000 veya mobil emülatör IP'lerini kapsar
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranscribeRequest(BaseModel):
    user_id: str
    original_audio_url: str
    filename: str

def run_demucs_and_upload(req: TranscribeRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Supabase bağlantısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    # Backend 'admin' yetkisiyle (Service Role Key) Supabase'e bağlanıyor: RLS aşılır!
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 1. İşlemin başladığını bildiren ilk metadata kaydını yapalım
    started_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
    initial_metadata = {
        "task_type": "demucs",
        "status": "processing",
        "started_at": started_at_iso,
        "completed_at": None,
        "error": None,
        "outputs": {}
    }
    
    try:
        supabase.table("transcriptions").update({
            "metadata": initial_metadata,
            "ai_model": "demucs"
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] İşlem 'processing' olarak veritabanına işlendi.")
    except Exception as db_err:
        print("Veritabanı ilk durum güncelleme hatası (Yine de devam ediliyor):", str(db_err))

    temp_dir = os.path.abspath("temp_audio")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filepath = os.path.join(temp_dir, req.filename)
    
    try:
        # 1. Müziği Next.js/Mobil üzerinden yüklenen Supabase linkinden direkt Python'a indir
        urllib.request.urlretrieve(req.original_audio_url, temp_filepath)
        
        # 2. Özel Models / Checkpoints ortamını göster
        demucs_models_dir = os.path.abspath(r"..\models\demucs")
        env = os.environ.copy()
        env["TORCH_HOME"] = demucs_models_dir
        
        # 3. Projendeki diğer sanal ortama (dVenv) yönlendirme
        python_exe = os.path.abspath(r"..\models\demucs\dVenv\Scripts\python.exe")
        
        print(f"Demucs htdemucs_ft modeli bizzat '{python_exe}' ana motoruyla başlatılıyor: {req.filename}...")
        
        result = subprocess.run([
            python_exe, "-m", "demucs",
            "-n", "htdemucs_ft", 
            "--out", temp_dir,
            temp_filepath
        ], env=env, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception("Demucs ayrıştırma işlemi başarısız: " + result.stderr)

        # 4. Ayrılan WAV dosyalarını topla
        file_base = os.path.splitext(req.filename)[0]
        output_folder = os.path.join(temp_dir, "htdemucs_ft", file_base)
        
        stems = ["vocals.wav", "drums.wav", "bass.wav", "other.wav"]
        stem_urls = {}

        for stem in stems:
            stem_path = os.path.join(output_folder, stem)
            if os.path.exists(stem_path):
                # 5. Her parçayı kendi Supabase hesabına (Storage) geri yükle
                storage_path = f"{req.user_id}/{file_base}/{stem}"
                with open(stem_path, "rb") as f:
                    supabase.storage.from_("audio-files").upload(
                        storage_path, 
                        f, 
                        file_options={"upsert": "true", "content-type": "audio/wav"}
                    )
                
                # Public URL erişim linkini kaydet
                public_url = supabase.storage.from_("audio-files").get_public_url(storage_path)
                stem_urls[stem] = public_url
                print(f"YÜKLENDİ: {stem} -> {public_url}")

        # 6. İşlem başarıyla bitti! Veritabanını 'completed' durumuna çekip çıktıları yazalım
        completed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        completed_metadata = {
            "task_type": "demucs",
            "status": "completed",
            "started_at": started_at_iso,
            "completed_at": completed_at_iso,
            "error": None,
            "outputs": {
                "vocals_url": stem_urls.get("vocals.wav"),
                "drums_url": stem_urls.get("drums.wav"),
                "bass_url": stem_urls.get("bass.wav"),
                "other_url": stem_urls.get("other.wav")
            }
        }
        
        supabase.table("transcriptions").update({
            "metadata": completed_metadata
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] Demucs işlemi başarıyla tamamlandı ve veritabanına işlendi!")

    except Exception as e:
        print("HATA OLUŞTU:", str(e))
        # İşlem başarısız oldu, veritabanını 'failed' durumuna çekelim
        failed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        failed_metadata = {
            "task_type": "demucs",
            "status": "failed",
            "started_at": started_at_iso,
            "completed_at": failed_at_iso,
            "error": str(e),
            "outputs": {}
        }
        try:
            supabase.table("transcriptions").update({
                "metadata": failed_metadata
            }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
            print(f"[{req.filename}] Hata durumu veritabanına kaydedildi.")
        except Exception as db_err2:
            print("Hata durumu veritabanına kaydedilirken ikinci bir hata oluştu:", str(db_err2))

def run_bytedance_and_upload(req: TranscribeRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Supabase bağlantısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    # Backend 'admin' yetkisiyle (Service Role Key) Supabase'e bağlanıyor: RLS aşılır!
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 1. İşlemin başladığını bildiren ilk metadata kaydını yapalım
    started_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
    initial_metadata = {
        "task_type": "bytedance",
        "status": "processing",
        "started_at": started_at_iso,
        "completed_at": None,
        "error": None,
        "outputs": {}
    }
    
    try:
        supabase.table("transcriptions").update({
            "metadata": initial_metadata,
            "ai_model": "bytedance"
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] ByteDance Piyano işlemi 'processing' olarak veritabanına işlendi.")
    except Exception as db_err:
        print("Veritabanı ilk durum güncelleme hatası (Yine de devam ediliyor):", str(db_err))

    temp_dir = os.path.abspath("temp_audio")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filepath = os.path.join(temp_dir, req.filename)
    
    try:
        # 1. Müziği indir
        urllib.request.urlretrieve(req.original_audio_url, temp_filepath)
        
        # 2. Çıktı MIDI dosyasının adını belirle
        file_base = os.path.splitext(req.filename)[0]
        output_mid_filename = f"{file_base}_piano.mid"
        output_mid_path = os.path.join(temp_dir, output_mid_filename)
        
        # 3. Yolları belirle
        python_exe = os.path.abspath(r"..\models\bytedancePianoTranscription\pianoVenv\Scripts\python.exe")
        script_path = os.path.abspath(r"..\models\bytedancePianoTranscription\transcribe_piano.py")
        
        print(f"ByteDance Piyano Transkripsiyon motoru çalıştırılıyor: {req.filename}...")
        
        # 4. transcribe_piano.py komutunu çalıştır
        result = subprocess.run([
            python_exe,
            script_path,
            "--audio_path", temp_filepath,
            "--output_midi_path", output_mid_path
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception("ByteDance piyano transkripsiyonu başarısız: " + result.stderr)

        # 5. Oluşan .mid dosyasını Supabase Storage'a yükle
        midi_url = ""
        if os.path.exists(output_mid_path):
            storage_path = f"{req.user_id}/{file_base}/piano_bytedance.mid"
            with open(output_mid_path, "rb") as f:
                supabase.storage.from_("audio-files").upload(
                    storage_path, 
                    f, 
                    file_options={"upsert": "true", "content-type": "audio/midi"}
                )
            
            # Public URL'yi al
            midi_url = supabase.storage.from_("audio-files").get_public_url(storage_path)
            print(f"YÜKLENDİ: {output_mid_filename} -> {midi_url}")

        # 6. İşlem tamamlandı! Veritabanını 'completed' durumuna çek
        completed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        completed_metadata = {
            "task_type": "bytedance",
            "status": "completed",
            "started_at": started_at_iso,
            "completed_at": completed_at_iso,
            "error": None,
            "outputs": {
                "midi_url": midi_url
            }
        }
        
        supabase.table("transcriptions").update({
            "metadata": completed_metadata
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] ByteDance Piyano işlemi başarıyla tamamlandı ve veritabanına işlendi!")

    except Exception as e:
        print("ByteDance HATA OLUŞTU:", str(e))
        failed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        failed_metadata = {
            "task_type": "bytedance",
            "status": "failed",
            "started_at": started_at_iso,
            "completed_at": failed_at_iso,
            "error": str(e),
            "outputs": {}
        }
        try:
            supabase.table("transcriptions").update({
                "metadata": failed_metadata
            }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
            print(f"[{req.filename}] Hata durumu veritabanına kaydedildi.")
        except Exception as db_err2:
            print("Hata durumu veritabanına kaydedilirken ikinci bir hata oluştu:", str(db_err2))

def run_adtof_and_upload(req: TranscribeRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Supabase bağlantısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    # Backend 'admin' yetkisiyle (Service Role Key) Supabase'e bağlanıyor: RLS aşılır!
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 1. İşlemin başladığını bildiren ilk metadata kaydını yapalım
    started_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
    initial_metadata = {
        "task_type": "adtof",
        "status": "processing",
        "started_at": started_at_iso,
        "completed_at": None,
        "error": None,
        "outputs": {}
    }
    
    try:
        supabase.table("transcriptions").update({
            "metadata": initial_metadata,
            "ai_model": "adtof"
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] ADTOF Bateri işlemi 'processing' olarak veritabanına işlendi.")
    except Exception as db_err:
        print("Veritabanı ilk durum güncelleme hatası (Yine de devam ediliyor):", str(db_err))

    temp_dir = os.path.abspath("temp_audio")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filepath = os.path.join(temp_dir, req.filename)
    
    try:
        # 1. Müziği indir
        urllib.request.urlretrieve(req.original_audio_url, temp_filepath)
        
        # 2. Çıktı MIDI dosyasının adını belirle
        file_base = os.path.splitext(req.filename)[0]
        output_mid_filename = f"{file_base}_drums.mid"
        output_mid_path = os.path.join(temp_dir, output_mid_filename)
        
        # 3. adtof.exe yolunu al (adtofDrums altındaki sanal ortam)
        adtof_exe = os.path.abspath(r"..\models\adtofDrums\adtofVenv\Scripts\adtof.exe")
        
        print(f"ADTOF Bateri Transkripsiyon motoru çalıştırılıyor: {req.filename}...")
        
        # 4. adtof.exe komutunu çalıştır
        result = subprocess.run([
            adtof_exe,
            "--audio", temp_filepath,
            "--out", output_mid_path
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception("ADTOF bateri transkripsiyonu başarısız: " + result.stderr)

        # 5. Oluşan .mid dosyasını Supabase Storage'a yükle
        midi_url = ""
        if os.path.exists(output_mid_path):
            storage_path = f"{req.user_id}/{file_base}/drums_adtof.mid"
            with open(output_mid_path, "rb") as f:
                supabase.storage.from_("audio-files").upload(
                    storage_path, 
                    f, 
                    file_options={"upsert": "true", "content-type": "audio/midi"}
                )
            
            # Public URL'yi al
            midi_url = supabase.storage.from_("audio-files").get_public_url(storage_path)
            print(f"YÜKLENDİ: {output_mid_filename} -> {midi_url}")

        # 6. İşlem tamamlandı! Veritabanını 'completed' durumuna çek
        completed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        completed_metadata = {
            "task_type": "adtof",
            "status": "completed",
            "started_at": started_at_iso,
            "completed_at": completed_at_iso,
            "error": None,
            "outputs": {
                "midi_url": midi_url
            }
        }
        
        supabase.table("transcriptions").update({
            "metadata": completed_metadata
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] ADTOF Bateri işlemi başarıyla tamamlandı ve veritabanına işlendi!")

    except Exception as e:
        print("ADTOF HATA OLUŞTU:", str(e))
        failed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        failed_metadata = {
            "task_type": "adtof",
            "status": "failed",
            "started_at": started_at_iso,
            "completed_at": failed_at_iso,
            "error": str(e),
            "outputs": {}
        }
        try:
            supabase.table("transcriptions").update({
                "metadata": failed_metadata
            }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
            print(f"[{req.filename}] ADTOF Hata durumu veritabanına kaydedildi.")
        except Exception as db_err2:
            print("Hata durumu veritabanına kaydedilirken ikinci bir hata oluştu:", str(db_err2))

def run_btc_and_upload(req: TranscribeRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Supabase bağlantısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    started_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
    initial_metadata = {
        "task_type": "btc",
        "status": "processing",
        "started_at": started_at_iso,
        "completed_at": None,
        "error": None,
        "outputs": {}
    }
    
    try:
        supabase.table("transcriptions").update({
            "metadata": initial_metadata,
            "ai_model": "btc"
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
    except Exception as db_err:
        print("DB güncelleme hatası (BTC başlangıç):", str(db_err))

    try:
        temp_dir = os.path.abspath("temp_audio")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)

        file_base, file_ext = os.path.splitext(req.filename)
        timestamp = str(int(datetime.datetime.utcnow().timestamp() * 1000))
        input_filename = f"{timestamp}_{req.filename}"
        input_audio_path = os.path.join(temp_dir, input_filename)
        
        print(f"[{req.filename}] Dosya indiriliyor: {req.original_audio_url}")
        urllib.request.urlretrieve(req.original_audio_url, input_audio_path)
        print(f"[{req.filename}] İndirildi -> {input_audio_path}")

        python_exe = r"C:\melodify2.0\models\btc\analysisVenv\Scripts\python.exe"
        script_path = r"C:\melodify2.0\models\btc\BTC-ISMIR19\analyze_btc.py"
        
        print(f"[{req.filename}] BTC Akor & BPM & Ton analizi başlatılıyor...")
        cmd = [python_exe, script_path, input_audio_path, temp_dir]
        subprocess.run(cmd, check=True)
        print(f"[{req.filename}] Analiz scripti başarıyla tamamlandı!")

        output_json_path = os.path.join(temp_dir, f"{timestamp}_{file_base}_analysis.json")
        output_mid_path = os.path.join(temp_dir, f"{timestamp}_{file_base}_chords.mid")
        
        if not os.path.exists(output_json_path) or not os.path.exists(output_mid_path):
            raise Exception("Analiz sonucunda JSON veya MIDI dosyaları üretilemedi!")

        with open(output_json_path, 'r', encoding='utf-8') as f:
            analysis_data = json.load(f)

        midi_storage_path = f"{req.user_id}/{timestamp}/chords.mid"
        with open(output_mid_path, "rb") as f:
            supabase.storage.from_("audio-files").upload(
                midi_storage_path, 
                f, 
                file_options={"upsert": "true", "content-type": "audio/midi"}
            )
        midi_url = supabase.storage.from_("audio-files").get_public_url(midi_storage_path)
        print(f"YÜKLENDİ CHORDS MIDI: {midi_url}")

        pdf_url = ""

        completed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        completed_metadata = {
            "task_type": "btc",
            "status": "completed",
            "started_at": started_at_iso,
            "completed_at": completed_at_iso,
            "error": None,
            "outputs": {
                "midi_url": midi_url,
                "pdf_url": pdf_url,
                "bpm": analysis_data.get("bpm"),
                "key": analysis_data.get("key"),
                "chords": analysis_data.get("chords")
            }
        }
        
        supabase.table("transcriptions").update({
            "metadata": completed_metadata
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] BTC Akor analizi başarıyla tamamlandı ve veritabanına işlendi!")

    except Exception as e:
        print("BTC HATA OLUŞTU:", str(e))
        failed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        failed_metadata = {
            "task_type": "btc",
            "status": "failed",
            "started_at": started_at_iso,
            "completed_at": failed_at_iso,
            "error": str(e),
            "outputs": {}
        }
        try:
            supabase.table("transcriptions").update({
                "metadata": failed_metadata
            }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
            print(f"[{req.filename}] BTC Hata durumu veritabanına kaydedildi.")
        except Exception as db_err2:
            print("Hata durumu kaydedilirken ikinci hata:", str(db_err2))

def run_basic_pitch_and_upload(req: TranscribeRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Supabase bağlantısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    started_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
    initial_metadata = {
        "task_type": "basic_pitch",
        "status": "processing",
        "started_at": started_at_iso,
        "completed_at": None,
        "error": None,
        "outputs": {}
    }
    
    try:
        supabase.table("transcriptions").update({
            "metadata": initial_metadata,
            "ai_model": "basic_pitch"
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
    except Exception as db_err:
        print("DB güncelleme hatası (Basic Pitch başlangıç):", str(db_err))

    try:
        temp_dir = os.path.abspath("temp_audio")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)

        file_base, file_ext = os.path.splitext(req.filename)
        timestamp = str(int(datetime.datetime.utcnow().timestamp() * 1000))
        input_filename = f"{timestamp}_{req.filename}"
        input_audio_path = os.path.join(temp_dir, input_filename)
        
        print(f"[{req.filename}] Dosya indiriliyor: {req.original_audio_url}")
        urllib.request.urlretrieve(req.original_audio_url, input_audio_path)
        print(f"[{req.filename}] İndirildi -> {input_audio_path}")

        python_exe = r"C:\melodify2.0\models\basicpitch\bpVenv\Scripts\python.exe"
        script_path = r"C:\melodify2.0\models\basicpitch\transcribe_pitch.py"
        
        print(f"[{req.filename}] Basic Pitch mırıldanma analizi başlatılıyor...")
        cmd = [python_exe, script_path, input_audio_path, temp_dir]
        subprocess.run(cmd, check=True)
        print(f"[{req.filename}] Basic Pitch başarıyla tamamlandı!")

        output_mid_filename = f"{timestamp}_{file_base}_basic_pitch.mid"
        output_mid_path = os.path.join(temp_dir, output_mid_filename)
        
        if not os.path.exists(output_mid_path):
            raise Exception("Basic Pitch sonucunda MIDI dosyası üretilemedi!")

        midi_storage_path = f"{req.user_id}/{timestamp}/basic_pitch.mid"
        with open(output_mid_path, "rb") as f:
            supabase.storage.from_("audio-files").upload(
                midi_storage_path, 
                f, 
                file_options={"upsert": "true", "content-type": "audio/midi"}
            )
        midi_url = supabase.storage.from_("audio-files").get_public_url(midi_storage_path)
        print(f"YÜKLENDİ BASIC PITCH MIDI: {midi_url}")

        completed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        completed_metadata = {
            "task_type": "basic_pitch",
            "status": "completed",
            "started_at": started_at_iso,
            "completed_at": completed_at_iso,
            "error": None,
            "outputs": {
                "midi_url": midi_url
            }
        }
        
        supabase.table("transcriptions").update({
            "metadata": completed_metadata
        }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
        print(f"[{req.filename}] Basic Pitch işlemi başarıyla tamamlandı ve veritabanına işlendi!")

    except Exception as e:
        print("BASIC PITCH HATA OLUŞTU:", str(e))
        failed_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        failed_metadata = {
            "task_type": "basic_pitch",
            "status": "failed",
            "started_at": started_at_iso,
            "completed_at": failed_at_iso,
            "error": str(e),
            "outputs": {}
        }
        try:
            supabase.table("transcriptions").update({
                "metadata": failed_metadata
            }).eq("user_id", req.user_id).eq("original_audio_url", req.original_audio_url).execute()
            print(f"[{req.filename}] Basic Pitch Hata durumu veritabanına kaydedildi.")
        except Exception as db_err2:
            print("Hata durumu kaydedilirken ikinci hata:", str(db_err2))

@app.get("/")
def read_root():
    return {"message": "Melodify AI Arka Ucu Çalışıyor (Mobil-Web Tam Uyumlu)", "status": "online"}

@app.post("/api/transcribe")
async def start_transcription(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    HTTP Süre Aşımını (Timeout) engellemek için işlem "Arka Planda" (Background) başlatılır.
    Senin sitene saniyesinde 'İşlem Başladı' geri dönüşü yapılır.
    """
    background_tasks.add_task(run_demucs_and_upload, req)
    return {
        "status": "processing",
        "message": "Arka planda Demucs devraldı. Htdemucs_ft modeli ile ses kanallarına ayrılıyor!"
    }

@app.post("/api/transcribe/adtof")
async def start_adtof_transcription(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    Arka planda ADTOF Bateri Transkripsiyonunu başlatır.
    """
    background_tasks.add_task(run_adtof_and_upload, req)
    return {
        "status": "processing",
        "message": "Arka planda ADTOF Bateri Transkripsiyonu devraldı. Bateri vuruşları .mid dosyasına transkribe ediliyor!"
    }

@app.post("/api/transcribe/bytedance")
async def start_bytedance_transcription(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    Arka planda ByteDance Piyano Transkripsiyonunu başlatır.
    """
    background_tasks.add_task(run_bytedance_and_upload, req)
    return {
        "status": "processing",
        "message": "Arka planda ByteDance Piyano Transkripsiyonu devraldı. Piyano ezgileri .mid dosyasına transkribe ediliyor!"
    }

@app.post("/api/transcribe/btc")
async def start_btc_transcription(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    Arka planda BTC Akor, BPM ve Ton analizini başlatır.
    """
    background_tasks.add_task(run_btc_and_upload, req)
    return {
        "status": "processing",
        "message": "Arka planda BTC Akor, BPM ve Ton Analizi devraldı. Akorlar ve ritim değerleri hesaplanıyor!"
    }

@app.post("/api/transcribe/basic_pitch")
async def start_basic_pitch_transcription(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    Arka planda Basic Pitch mırıldanmayı MIDI'ye çevirme işlemini başlatır.
    """
    background_tasks.add_task(run_basic_pitch_and_upload, req)
    return {
        "status": "processing",
        "message": "Arka planda Basic Pitch mırıldanma analizi devraldı. Ses dalgaları notaya dönüştürülüyor!"
    }

@app.post("/api/upload-midi")
async def upload_midi_file(file: UploadFile = File(...)):
    import shutil
    import urllib.parse
    import re
    try:
        # Next.js public klasörünün yolunu bulup uploads alt klasörünü oluşturuyoruz
        public_uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "uploads"))
        os.makedirs(public_uploads_dir, exist_ok=True)
        
        # 1. Dosya adını URL decode edelim (örn: %20 -> boşluk)
        decoded_name = urllib.parse.unquote(file.filename)
        
        # 2. Sadece güvenli karakterlere izin verelim (harf, sayı, nokta, alt tire, tire)
        clean_name = re.sub(r'[^a-zA-Z0-9._-]', '_', decoded_name)
        
        # 3. Dosya ismini benzersiz yapalım
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        safe_filename = f"{timestamp}_{clean_name}"
        file_path = os.path.join(public_uploads_dir, safe_filename)
        
        # Dosyayı diske kaydedelim
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "success": True,
            "filename": safe_filename,
            "url": f"/uploads/{safe_filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



