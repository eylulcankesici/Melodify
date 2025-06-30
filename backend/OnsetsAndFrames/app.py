import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import traceback
import requests
import sys
import tensorflow as tf

# Magenta'nın transcribe betiğini import ediyoruz
from magenta.models.onsets_frames_transcription import onsets_frames_transcription_transcribe as transcribe_script

app = Flask(__name__)
CORS(app)

# Yüklenen dosyaların kaydedileceği klasör
UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Model dizinini ayarla
MODEL_DIR = os.path.join(os.getcwd(), 'checkpoints')
print("Model dizini:", MODEL_DIR)

# Flags'leri parse et
from absl import flags
FLAGS = flags.FLAGS
if not FLAGS.is_parsed():
    flags.FLAGS(['dummy_program_name'])
# Model dizinini var olan flag'e ata
FLAGS.model_dir = MODEL_DIR

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        data = request.get_json()
        audio_url = data.get('audio_url')
        print("Alınan audio_url:", audio_url)
        
        if not audio_url:
            return jsonify({"error": "Ses dosyası URL'si bulunamadı"}), 400

        # Ses dosyasını indir
        print("Ses dosyası indiriliyor...")
        response = requests.get(audio_url)
        if response.status_code != 200:
            print(f"Dosya indirme hatası. Status code: {response.status_code}")
            return jsonify({"error": "Ses dosyası indirilemedi"}), 400

        # Geçici dosya oluştur
        temp_audio_path = os.path.join(UPLOAD_FOLDER, 'temp_audio.wav')
        print("Geçici dosya yolu:", temp_audio_path)
        
        with open(temp_audio_path, 'wb') as f:
            f.write(response.content)
        
        print(f"Dosya kaydedildi. Boyut: {os.path.getsize(temp_audio_path)} bytes")

        try:
            print("Transkripsiyon başlıyor...")
            print("Model dizini mevcut mu:", os.path.exists(MODEL_DIR))
            
            # Transkripsiyon işlemi
            argv = ['dummy_program_name', temp_audio_path]
            print("Argv:", argv)
            
            transcribe_script.run(
                argv=argv,
                config_map=transcribe_script.configs.CONFIG_MAP,
                data_fn=transcribe_script.data.provide_batch
            )

            # MIDI dosyası kontrolü
            midi_path = temp_audio_path + '.midi'
            print("Beklenen MIDI dosya yolu:", midi_path)
            print("MIDI dosyası mevcut mu:", os.path.exists(midi_path))
            
            if not os.path.exists(midi_path):
                return jsonify({"error": "MIDI dosyası oluşturulamadı"}), 500

            return send_file(
                midi_path,
                mimetype='audio/midi',
                as_attachment=True,
                download_name='transcribed.midi'
            )

        except Exception as e:
            print("Transkripsiyon hatası detayı:")
            print(str(e))
            print("Tam hata:")
            traceback.print_exc()
            return jsonify({"error": f"Transkripsiyon işlemi sırasında hata: {str(e)}"}), 500

    except Exception as e:
        print("Genel hata detayı:")
        print(str(e))
        print("Tam hata:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)