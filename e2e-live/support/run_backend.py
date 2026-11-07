"""Start the real cURLCraft backend for the live E2E suite.

Usage: python run_backend.py <backend_dir> <port>

The backend calls load_dotenv(override=True) on import, so a developer's own backend/.env would
override the settings this suite depends on (ENVIRONMENT, ALLOWED_ORIGINS, rate limits). It is
disabled here: the configuration comes only from the environment playwright.live.config.ts sets.
"""

import os
import sys

backend_dir, port = os.path.abspath(sys.argv[1]), int(sys.argv[2])
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

import dotenv  # noqa: E402

dotenv.load_dotenv = lambda *args, **kwargs: False

import uvicorn  # noqa: E402

uvicorn.run("main:app", host="127.0.0.1", port=port, log_level="warning", access_log=False)
