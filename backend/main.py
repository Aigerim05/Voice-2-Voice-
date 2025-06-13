import os
import json
import base64
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketDisconnect
from dotenv import load_dotenv
import openai
import tempfile


load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Allow frontend connection (adjust in production!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "audio":
                audio_data = base64.b64decode(message["audio"])

                # Save to a temporary file for transcription
                with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
                    temp_audio.write(audio_data)
                    temp_audio_path = temp_audio.name

                with open(temp_audio_path, "rb") as f:
                    transcript = openai.Audio.transcribe(
                        model="whisper-1",
                        file=f
                    )

                # Send transcribed text first
                await websocket.send_json({
                    "type": "transcription",
                    "content": transcript["text"]
                })

                gpt_response = openai.ChatCompletion.create(
                    model="gpt-4",
                    messages=[
                        {"role": "user", "content": transcript["text"]}
                    ]
                )

                # Then send assistant's response
                await websocket.send_json({
                    "type": "text",
                    "content": gpt_response["choices"][0]["message"]["content"]
                })
                await websocket.send_json({"type": "end"})

    except WebSocketDisconnect:
        print("🔌 WebSocket disconnected")
    except Exception as e:
        import traceback
        print("❗ Error:", e)
        traceback.print_exc()
        try:
            await websocket.close()
        except RuntimeError:
            pass

@app.get("/")
def read_root():
    return {"status": "ok"}
