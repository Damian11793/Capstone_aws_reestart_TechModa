#!/usr/bin/env bash
# RAGAS Simple Test - TechModa AI Chatbot S08

set -euo pipefail

DATASET="${1:-ragas_test_5_mini.json}"
S8_URL="${2:-https://u26snshd5eyctiioychrbubs4q0pyikh.lambda-url.us-east-1.on.aws/}"
RESULTS="ragas_results_$(date +%s).jsonl"

echo "🧪 RAGAS Simple Test - TechModa AI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Dataset: $DATASET"
echo "S8 URL: $S8_URL"
echo "Results: $RESULTS"
echo ""

# Ejecutar cada pregunta
python3 <<PYEOF
import json
import subprocess
import sys

data = json.load(open("$DATASET"))

for item in data:
    q_id = item['id']
    category = item['category']
    question = item['user_input']
    reference = item.get('reference', '')

    sys.stdout.write(f"Test {q_id:2d} ({category:15s})... ")
    sys.stdout.flush()

    try:
        # Llamar S08
        cmd = f"""curl -s -X POST "$S8_URL/assistant" \\
            -H "Content-Type: application/json" \\
            -d '{{"message": "{question.replace('"', '\\\\"')}", "conversationHistory": []}}' """

        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)

        if result.returncode == 0 and result.stdout:
            resp = json.loads(result.stdout)
            reply = resp.get('reply', '')
            status = "✅" if reply else "❌"
            print(status)
        else:
            print("❌ (error)")
            reply = ""
            status = "error"

        # Guardar resultado
        with open("$RESULTS", "a") as f:
            json.dump({
                "id": q_id,
                "category": category,
                "question": question,
                "reference": reference,
                "reply": reply,
                "status": status
            }, f)
            f.write("\n")

    except Exception as e:
        print(f"❌ ({str(e)})")

print("\n✨ Resultados guardados en: $RESULTS")
PYEOF
