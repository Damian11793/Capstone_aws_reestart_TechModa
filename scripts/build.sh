#!/bin/bash
#
# Build script for TechModa Serverless Capstone
# This script runs sam build to prepare the application for deployment
#

set -e

echo "Building SAM application..."
echo "============================"
echo ""

sam build

echo ""
echo "Build complete!"
echo "Next step: Run ./scripts/deploy.sh to deploy your application"
