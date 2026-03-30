from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI(title="Melodify Demucs Backend API")

# CORS (Bağlantı) İzinleri: Next.js (Web) veya Expo (Mobil) uygulamasından gelen isteklere izin verilir.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Hem http://localhost:3000, hem de telefondan gelen iplere izin verir.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Melodify AI Arka Ucu Çalışıyor!", "status": "online"}

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """
    Adım 1: Bu test servisi yalnızca müzik dosyasının Python'a ulaştığını doğrular.
    Adım 2: Bir sonraki aşamada indirilen 'checkpoints' kullanarak şarkıyı kanallarına (Vokal vs.) ayıracağız.
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Dosya yüklenmedi/bulunamadı.")
        
        # Müzik/Ses uzantısı kontrolü
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.mp3', '.wav', '.midi']:
            raise HTTPException(status_code=400, detail="Yalnızca mp3, wav ve midi formatlarına izin var!")

        # TODO: Dosya Supabase Storage'a yüklendikten sonra veya doğrudan buraya geldiğinde ayrıştırma tetiklenecek
        
        return {
            "status": "success",
            "message": f"'{file.filename}' başarıyla alındı. Ayrıştırma altyapısına girmeye hazır!",
            "filename": file.filename
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
