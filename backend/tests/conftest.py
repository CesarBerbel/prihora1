import os
import sys
from pathlib import Path

# Permite rodar a suite fora do container.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("SECRET_KEY", "test-secret")
