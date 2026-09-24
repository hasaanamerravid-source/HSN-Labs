#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "HSN-Labs (HSN-Sim Laboratories) v2.7.0"
echo "Open http://127.0.0.1:8080"
echo "Do not open index.html as a file — ES modules need a server."
python3 -m http.server 8080
