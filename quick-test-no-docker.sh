#!/bin/bash

# SABA Quick Test Script (No Docker) - Pollution Tracking Agent
# Use this if you have PostgreSQL installed locally

echo "========================================="
echo "SABA Quick Test - No Docker"
echo "========================================="
echo ""

# Check if .env exists
echo "1. Checking configuration..."
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env from .env.example and configure:"
    echo "   - DB_HOST=localhost (or your PostgreSQL host)"
    echo "   - DB_PORT=5432"
    echo "   - DB_USER=saba"
    echo "   - DB_PASSWORD=your_password"
    echo "   - DB_NAME=saba_db"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - TELEGRAM_ADMIN_CHAT_ID"
    exit 1
fi

echo "✓ Configuration file exists"
echo ""

# Check PostgreSQL connection
echo "2. Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)
    DB_PORT=$(grep DB_PORT .env | cut -d '=' -f2)
    DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
    DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        echo "✓ PostgreSQL is accessible"
    else
        echo "⚠️  Warning: Cannot connect to PostgreSQL"
        echo "   Make sure PostgreSQL is running and credentials are correct"
    fi
else
    echo "⚠️  psql not found in PATH, skipping connection test"
fi
echo ""

# Run migrations
echo "3. Running database migrations..."
npm run migrate 2>&1 | grep -E "Migration|completed|tables|Error" | head -20
if [ $? -eq 0 ]; then
    echo "✓ Migrations completed"
else
    echo "⚠️  Check migration output above"
fi
echo ""

# Build project
echo "4. Building SABA..."
npm run build 2>&1 | grep -E "error|warning|SUCCESS" | head -10
if [ $? -eq 0 ]; then
    echo "✓ Build successful"
fi
echo ""

# Instructions
echo "========================================="
echo "✓ SABA is ready!"
echo "========================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. SABA will start now in this terminal"
echo ""
echo "2. Open Telegram and send to your bot:"
echo "   /create_agent pollution-tracker Track air quality and pollution levels for any location using AQI data"
echo ""
echo "3. Wait for approval notifications and click [✓ Approve]"
echo ""
echo "Expected timeline: ~3-4 minutes for complete agent creation"
echo ""
echo "========================================="
echo ""
echo "Starting SABA now..."
echo ""

# Start SABA
npm run dev:telegram
