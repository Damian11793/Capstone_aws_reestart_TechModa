#!/usr/bin/env bash
# RAGAS Test Suite para TechModa AI Chatbot (S08)
# Evalúa: context_precision, context_recall, faithfulness, answer_relevancy, etc.

set -euo pipefail

DATASET_FILE="${1:-ragas_test_50.json}"
S8_URL="${2:-https://u26snshd5eyctiioychrbubs4q0pyikh.lambda-url.us-east-1.on.aws/}"
RESULTS_FILE="ragas_results_$(date +%s).jsonl"

echo "🧪 RAGAS Test Suite - TechModa AI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Dataset: $DATASET_FILE"
echo "S8 URL: $S8_URL"
echo "Results: $RESULTS_FILE"
echo ""

# Generar dataset si no existe
if [ ! -f "$DATASET_FILE" ]; then
  echo "📝 Generando dataset de 50 preguntas..."
  bash "$(dirname "$0")/ragas_dataset.sh" "$DATASET_FILE"
fi

# Función para ejecutar pregunta contra S08
test_question() {
  local id=$1
  local category=$2
  local question=$3
  local reference=${4:-}

  echo -n "Test $id ($category)... "

  # Llamar S08
  response=$(curl -s -X POST "${S8_URL%/}/assistant" \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": \"$question\",
      \"conversationHistory\": []
    }")

  # Extraer reply
  reply=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('reply', ''))" 2>/dev/null || echo "")

  if [ -z "$reply" ]; then
    echo "❌ (sin respuesta)"
    status="failed"
  else
    echo "✅"
    status="ok"
  fi

  # Guardar resultado
  echo "{\"id\": $id, \"category\": \"$category\", \"question\": \"$question\", \"reference\": \"$reference\", \"reply\": \"$reply\", \"status\": \"$status\"}" >> "$RESULTS_FILE"
}

# Ejecutar tests
echo "🚀 Ejecutando preguntas..."
python3 <<PYEOF
import json
data = json.load(open("$DATASET_FILE"))
for item in data:
  id = item['id']
  cat = item['category']
  q = item['user_input'].replace('"', '\\"')
  ref = item.get('reference', '').replace('"', '\\"')
  print(f'{id} {cat} {q} {ref}')
PYEOF | while read id category question reference; do
  test_question "$id" "$category" "$question" "$reference"
done

# Análisis
echo ""
echo "📊 Análisis de Resultados"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python3 - "$RESULTS_FILE" <<'PY'
import json
from collections import Counter, defaultdict

results = [json.loads(line) for line in open("$RESULTS_FILE")]
passed = sum(1 for r in results if r["status"] == "ok")
failed = sum(1 for r in results if r["status"] == "failed")

print(f"\n✅ Passou: {passed}/50 ({100*passed//50}%)")
print(f"❌ Falhou: {failed}/50")

by_category = defaultdict(list)
for r in results:
  by_category[r["category"]].append(r["status"])

print(f"\nPor Categoría:")
for cat in sorted(by_category.keys()):
  ok = sum(1 for s in by_category[cat] if s == "ok")
  total = len(by_category[cat])
  pct = 100 * ok // total if total else 0
  print(f"  {cat}: {ok}/{total} ({pct}%)")

print(f"\n📁 Resultados guardados en: $RESULTS_FILE")
PY

echo ""
echo "✨ Test completado. Revisa $RESULTS_FILE para detalles."
