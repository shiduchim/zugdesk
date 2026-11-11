#!/usr/bin/env bash
# Linux / macOS: set up once (if needed) and start the lab.  ./start.sh   (./start.sh --all for every model)
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  command -v uv >/dev/null || { echo "Installing uv (https://astral.sh/uv)"; curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
  uv venv .venv --python 3.12
  uv pip install --python .venv/bin/python -r requirements.txt
fi
if ! command -v llama-server >/dev/null && [ ! -x tools/llama.cpp/llama-server ]; then
  if command -v brew >/dev/null; then brew install llama.cpp
  else echo "Engine B needs llama-server: put it in tools/llama.cpp/ (https://github.com/ggml-org/llama.cpp/releases) or build llama.cpp."; fi
fi
HF_HUB_OFFLINE=0 .venv/bin/python lab/download_models.py ${1:-} || true
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 exec .venv/bin/python lab/server.py
