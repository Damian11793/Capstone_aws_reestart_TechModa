#!/bin/bash
#
# Inject runtime environment configuration into frontend
# This script generates env-config.js from the template with actual values
#

set -e

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Inject runtime environment configuration into frontend build"
    echo ""
    echo "Options:"
    echo "  -a, --api-url URL      API Gateway URL (required)"
    echo "  -d, --dist-dir DIR     Distribution directory (default: frontend/dist)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --api-url https://abc123.lambda-url.us-east-1.on.aws"
    echo "  $0 -a https://abc123.lambda-url.us-east-1.on.aws -d ./dist"
    echo ""
    exit 1
}

# Default values
DIST_DIR="frontend/dist"
API_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--api-url)
            API_URL="$2"
            shift 2
            ;;
        -d|--dist-dir)
            DIST_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Error: Unknown option $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$API_URL" ]; then
    echo "❌ Error: API URL is required"
    echo ""
    usage
fi

# Normalizar: la Lambda Function URL termina en '/'. La quitamos para evitar
# dobles slash en el frontend (${API_URL}/products).
API_URL="${API_URL%/}"

# Validate dist directory exists
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ Error: Distribution directory not found: $DIST_DIR"
    echo ""
    echo "💡 Make sure you've built the frontend first:"
    echo "   npm run build (from frontend/ directory)"
    echo "   or"
    echo "   ./scripts/build-frontend.sh"
    exit 1
fi

# Check if template exists
TEMPLATE_FILE="frontend/public/env-config.js.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Error: Template file not found: $TEMPLATE_FILE"
    exit 1
fi

echo "=========================================="
echo "  Runtime Environment Injection"
echo "=========================================="
echo ""
echo "📋 Configuration:"
echo "   API URL:  $API_URL"
echo "   Dist dir: $DIST_DIR"
echo ""

# Generate env-config.js from template
OUTPUT_FILE="$DIST_DIR/env-config.js"

echo "🔧 Generating runtime configuration..."

# Get function URLs from CloudFormation stack
STACK_NAME="techmoda-ai-jorge-damian-diaz-v2"
REGION="us-east-1"

echo "   Fetching function URLs from stack: $STACK_NAME"
S8_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`ShoppingAssistantUrl`].OutputValue' --output text 2>/dev/null | sed 's|/$||')
S3_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`AnalyzeSentimentUrl`].OutputValue' --output text 2>/dev/null | sed 's|/$||')
S5_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`SynthesizeVoiceUrl`].OutputValue' --output text 2>/dev/null | sed 's|/$||')

sed "s|%%VITE_API_URL%%|$API_URL|g; s|%%VITE_S8_URL%%|$S8_URL|g; s|%%VITE_S3_URL%%|$S3_URL|g; s|%%VITE_S5_URL%%|$S5_URL|g" "$TEMPLATE_FILE" > "$OUTPUT_FILE"

# Verify the file was created
if [ ! -f "$OUTPUT_FILE" ]; then
    echo "❌ Error: Failed to create $OUTPUT_FILE"
    exit 1
fi

echo "✅ Runtime configuration injected successfully!"
echo ""
echo "📄 Generated file: $OUTPUT_FILE"
echo ""
echo "🔍 Content preview:"
cat "$OUTPUT_FILE"
echo ""
echo "=========================================="
echo ""
echo "💡 Next steps:"
echo "   1. Deploy to S3: aws s3 sync $DIST_DIR/ s3://your-bucket/"
echo "   2. Or use: ./scripts/deploy-frontend.sh"
echo ""
