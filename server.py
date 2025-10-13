# server.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# -------------------------------
# 1) FastAPI 앱 생성
# -------------------------------
app = FastAPI(title="React 연동용 백엔드 서버")

# -------------------------------
# 2) CORS 설정 (React와 통신 허용)
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 개발 단계에서는 전체 허용 (*)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# 3) 테스트용 기본 엔드포인트
# -------------------------------
@app.get("/")
def home():
    return {"message": "백엔드 서버 연결 OK!"}

# -------------------------------
# 4) 예시 API (React에서 가져올 데이터)
# -------------------------------
@app.get("/api/status")
def get_status():
    return {
        "ess_soc": 72,            # ESS SOC (%) 예시
        "pv_output": 43.5,        # PV 발전 출력 (kW)
        "alarm": "No Alarm",      # 알람 상태
    }
