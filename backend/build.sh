#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Collecting static assets for WhiteNoise..."
python manage.py collectstatic --no-input

echo "==> Running database migrations on Supabase..."
python manage.py migrate --no-input

echo "==> Build complete and ready for deployment!"
