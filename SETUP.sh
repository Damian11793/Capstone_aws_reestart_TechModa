#!/bin/bash

# ============================================================================
# SETUP.sh - Script automático para desplegar TechModa AI Capstone
# ============================================================================
# Uso: bash SETUP.sh
# ============================================================================

set -e  # Exit si hay error

echo "🚀 ========== TechModa AI Capstone - Setup Automático =========="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# 1. VALIDACIONES PREVIAS
# ============================================================================

echo -e "${BLUE}📋 Validando requisitos...${NC}"

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI no instalado. Instálalo con: brew install awscli"
    exit 1
fi

if ! command -v sam &> /dev/null; then
    echo "❌ SAM CLI no instalado. Instálalo con: brew install aws-sam-cli"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js no instalado. Instálalo desde https://nodejs.org/"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT" ]; then
    echo "❌ AWS CLI no configurado. Ejecuta: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ Todos los requisitos cumplidos${NC}"
echo "   AWS Account: $AWS_ACCOUNT"
echo "   AWS Region: us-east-1"
echo ""

# ============================================================================
# 2. PREGUNTAR NOMBRE DEL STACK
# ============================================================================

echo -e "${BLUE}🏗️  Configuración del Stack${NC}"
read -p "Nombre del stack [techmoda-ai-jorge-damian-diaz-v2]: " STACK_NAME
STACK_NAME=${STACK_NAME:-"techmoda-ai-jorge-damian-diaz-v2"}

echo "Stack: $STACK_NAME"
echo ""

# ============================================================================
# 3. BUILD BACKEND
# ============================================================================

echo -e "${BLUE}🔨 Compilando backend (SAM)...${NC}"
sam build
echo -e "${GREEN}✅ Backend compilado${NC}"
echo ""

# ============================================================================
# 4. DEPLOY BACKEND
# ============================================================================

echo -e "${BLUE}☁️  Desplegando backend a AWS...${NC}"
echo "Esto puede tomar 2-5 minutos..."
sam deploy \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --resolve-s3 \
    --no-confirm-changeset

echo -e "${GREEN}✅ Backend desplegado${NC}"
echo ""

# ============================================================================
# 5. OBTENER URLS
# ============================================================================

echo -e "${BLUE}📍 Obteniendo URLs del stack...${NC}"

ROUTER_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

S8_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ShoppingAssistantUrl`].OutputValue' \
    --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

echo "Router URL: $ROUTER_URL"
echo "S8 URL: $S8_URL"
echo "Frontend Bucket: $FRONTEND_BUCKET"
echo ""

# ============================================================================
# 6. BUILD FRONTEND
# ============================================================================

echo -e "${BLUE}⚛️  Compilando frontend (React)...${NC}"
npm run build --prefix frontend > /dev/null 2>&1
echo -e "${GREEN}✅ Frontend compilado${NC}"
echo ""

# ============================================================================
# 7. DEPLOY FRONTEND
# ============================================================================

echo -e "${BLUE}☁️  Desplegando frontend a S3...${NC}"
bash scripts/deploy-frontend.sh > /dev/null 2>&1
echo -e "${GREEN}✅ Frontend desplegado${NC}"
echo ""

# ============================================================================
# 8. VERIFICAR
# ============================================================================

echo -e "${BLUE}🔍 Verificando stack...${NC}"

# Test Router
PRODUCTS=$(curl -s "${ROUTER_URL}products" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('products', [])))" 2>/dev/null || echo "0")
echo "✅ Router: $PRODUCTS productos en catálogo"

# Test S8
S8_TEST=$(curl -s -X POST "${S8_URL}assistant" \
    -H 'Content-Type: application/json' \
    -d '{"message":"hola"}' | python3 -c "import sys, json; d=json.load(sys.stdin); print('OK' if d.get('reply') else 'FAIL')" 2>/dev/null || echo "FAIL")
echo "✅ S8 ChatBot: $S8_TEST"

# Frontend URL
FRONTEND_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
    --output text)
echo "✅ Frontend: $FRONTEND_URL"
echo ""

# ============================================================================
# 9. RESUMEN
# ============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ SETUP COMPLETADO${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📚 URLs DEL PROYECTO${NC}"
echo "   Frontend: $FRONTEND_URL"
echo "   Router API: $ROUTER_URL"
echo "   ChatBot S8: $S8_URL"
echo ""
echo -e "${BLUE}🎯 PRÓXIMOS PASOS${NC}"
echo "   1. Abre el frontend en el navegador"
echo "   2. Prueba el ChatBot"
echo "   3. Ejecuta: bash evaluations/run_eval.sh"
echo ""
echo -e "${BLUE}🧹 PARA LIMPIAR${NC}"
echo "   bash scripts/delete-all.sh"
echo ""
