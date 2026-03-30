import os
import sys
import subprocess
import urllib.request
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Next.js projesindeki .env.local dosyasındaki Supabase şifrelerini Python'a çekiyoruz
load_dotenv(dotenv_path="../.env.local")

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
        print("Supabase bağlatısı hatalı! .env dosyası bulunamadı veya Service Role Key eksik.")
        return

    # Backend 'admin' yetkisiyle (Service Role Key) Supabase'e bağlanıyor: RLS aşılır!
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
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
        # Windows'ta ".exe" tetikleyicileri bazen izin veya yol (WinError 2) hatası verebilir.
        # En garanti (foolproof) yöntem, o sanal ortamın asıl motorunu (python.exe) '-m demucs' komutuyla başlatmaktır:
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
                    # Supabase Python SDK, .wav uzantısını metin (text) sanabiliyor. Formatı zorla "audio/wav" yapıyoruz.
                    supabase.storage.from_("audio-files").upload(
                        storage_path, 
                        f, 
                        file_options={"upsert": "true", "content-type": "audio/wav"}
                    )
                
                # Public URL erişim linkini kaydet
                public_url = supabase.storage.from_("audio-files").get_public_url(storage_path)
                stem_urls[stem] = public_url
                print(f"YÜKLENDİ: {stem}")

        # 6. İşlem geçmişine (transcriptions) bu gizli linkleri kaydet
        if stem_urls:
             # İlerleyen aşamada bu veritabanı update'ini projenin veri tabanına göre de güncelleyebiliriz
             pass

    except Exception as e:
        print("HATA OLUŞTU:", str(e))

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
