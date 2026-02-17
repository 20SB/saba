#!/bin/bash

# SABA Quick Test Script - Pollution Tracking Agent
# This script helps you quickly test SABA by creating a pollution tracking agent

echo "========================================="
echo "SABA Quick Test - Pollution Tracker"
echo "========================================="
echo ""

# Check if Docker is running
echo "1. Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi
echo "✓ Docker is running"
echo ""

# Check if .env exists
echo "2. Checking configuration..."
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env from .env.example and configure:"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - TELEGRAM_ADMIN_CHAT_ID"
    exit 1
fi

# Check for required env vars
if ! grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY may not be configured"
fi

if ! grep -q "TELEGRAM_BOT_TOKEN=[0-9]" .env 2>/dev/null; then
    echo "⚠️  Warning: TELEGRAM_BOT_TOKEN may not be configured"
fi

echo "✓ Configuration file exists"
echo ""

# Start PostgreSQL
echo "3. Starting PostgreSQL database..."
docker-compose up -d postgres
sleep 5

# Check if database is running
if docker-compose ps postgres | grep -q "Up"; then
    echo "✓ PostgreSQL is running"
else
    echo "❌ PostgreSQL failed to start"
    exit 1
fi
echo ""

# Run migrations
echo "4. Running database migrations..."
npm run migrate 2>&1 | grep -E "Migration|completed|tables|Error" | head -20
if [ $? -eq 0 ]; then
    echo "✓ Migrations completed"
else
    echo "⚠️  Check migration output above"
fi
echo ""

# Build project
echo "5. Building SABA..."
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
echo "1. Start SABA in this terminal:"
echo "   npm run dev:telegram"
echo ""
echo "2. Open Telegram and send to your bot:"
echo "   /create_agent pollution-tracker Track air quality and pollution levels for any location using AQI data"
echo ""
echo "3. Wait for approval notifications and click [✓ Approve]"
echo ""
echo "4. Monitor the agent creation in the console output"
echo ""
echo "Expected timeline: ~3-4 minutes for complete agent creation"
echo ""
echo "For detailed instructions, see: TEST-POLLUTION-AGENT.md"
echo ""
echo "========================================="
echo ""
echo "Starting SABA now..."
echo ""

# Start SABA
npm run dev:telegram
