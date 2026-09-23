#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "HSN-Sim Laboratories v2.6.0"
echo "Open http://127.0.0.1:8080"
python3 -m http.server 8080
