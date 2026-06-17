import subprocess
import time

print("Starting VLS Background Scheduler...")
# This launches the scheduler silently in the background
subprocess.Popen(["python3", "scheduler.py"])

# Give the scheduler a second to boot up before starting the API
time.sleep(2)

print("Starting VLS API Server...")
# This launches the new FastAPI engine so your mobile app can talk to it
subprocess.run(
    ["python3", "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
)
