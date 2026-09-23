#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

STACK="${STACK_NAME:-techmoda-ai-jorge-damian-diaz-v2}"
REGION="${AWS_REGION:-us-east-1}"
OUTPUT_FILE="evaluations/conversations.jsonl"

echo "▶ Obteniendo URL de S8..."
URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ShoppingAssistantUrl'].OutputValue" \
  --output text)

if [ -z "$URL" ] || [ "$URL" == "None" ]; then
  echo "❌ No se encontró ShoppingAssistantUrl"
  exit 1
fi

echo "✓ URL: $URL"

QUERIES=(
  "Busco algo cómodo y blanco para caminar todo el día"
  "¿Tienen ropa deportiva para entrenar?"
  "Necesito un regalo para mi hermana, algo elegante"
  "¿Qué tienen para una boda casual?"
  "Busco zapatillas para correr"
  "¿Tienes vestidos largos?"
  "Quiero algo cómodo para trabajar desde casa"
  "¿Qué es lo más vendido?"
  "Busco ropa de playa"
  "¿Tienen tallas grandes?"
)

: > "$OUTPUT_FILE"

echo "📝 Capturando respuestas..."
COUNT=0

for QUERY in "${QUERIES[@]}"; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/${#QUERIES[@]}] Enviando: $QUERY"

  # Guardar response en archivo temporal para evitar problemas de escape
  TEMP_RESPONSE="/tmp/s8_response_$COUNT.json"

  curl -s -X POST "${URL%/}/assistant" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$QUERY\"}" > "$TEMP_RESPONSE"

  # Procesar con Python
  python3 << PYEOF
import json
with open("$TEMP_RESPONSE", "r") as f:
    response = json.load(f)

data = {
    "query": "$QUERY",
    "response": response.get("reply", ""),
    "tokens": response.get("usage", {})
}

with open("$OUTPUT_FILE", "a") as f:
    f.write(json.dumps(data, ensure_ascii=False) + "\n")
PYEOF

  echo "  ✓ Guardado"
  sleep 0.5
done

echo ""
echo "✅ Captura completada."
echo "📊 Líneas: $(wc -l < "$OUTPUT_FILE")"
echo "Archivo: $OUTPUT_FILE"
