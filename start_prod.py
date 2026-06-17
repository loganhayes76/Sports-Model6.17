import subprocess
import time

print("Starting VLS Background Scheduler...")
subprocess.Popen(["python3", "scheduler.py"])

time.sleep(2)

print("Starting VLS API Server (production, port 5000)...")
subprocess.run(
    ["python3", "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "5000"]
)
