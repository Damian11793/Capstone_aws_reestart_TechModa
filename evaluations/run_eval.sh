#!/bin/bash

# Script para ejecutar las 50 preguntas contra S8 ChatBot
S8_URL=$(aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`ShoppingAssistantUrl`].OutputValue' --output text)
S8_URL="${S8_URL%/}"

RESULTS_FILE="evaluations/eval_results_$(date +%Y%m%d_%H%M%S).jsonl"

echo "📋 Iniciando evaluación del ChatBot S8"
echo "URL: $S8_URL"
echo "Resultados: $RESULTS_FILE"
echo ""

python3 - <<PYTHON_EOF
import json
import subprocess
import sys
from datetime import datetime

S8_URL = "$S8_URL"
RESULTS_FILE = "$RESULTS_FILE"

# Leer preguntas
with open('evaluations/eval_questions_50.json') as f:
    data = json.load(f)
    questions = data['evaluation']['questions']

total = len(questions)
print(f"📊 Total de preguntas: {total}\n")

results = []

for idx, q in enumerate(questions, 1):
    question = q['question']
    question_id = q['id']
    category = q['category']
    difficulty = q['difficulty']
    
    print(f"[{idx}/{total}] {question[:50]}...", end=' ', flush=True)
    
    try:
        cmd = [
            'curl', '-s', '-X', 'POST',
            f'{S8_URL}/assistant',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({"message": question})
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        response_data = json.loads(result.stdout)
        
        reply = response_data.get('reply', 'ERROR')
        tokens = response_data.get('usage', {}).get('totalTokens', 0)
        retrieved = len(response_data.get('retrieved', []))
        
        result_entry = {
            "question_id": question_id,
            "question": question,
            "category": category,
            "difficulty": difficulty,
            "reply": reply,
            "tokens_used": tokens,
            "products_retrieved": retrieved,
            "timestamp": datetime.now().isoformat(),
            "status": "success"
        }
        
        results.append(result_entry)
        print("✅")
        
    except subprocess.TimeoutExpired:
        print("⏱️")
        results.append({"question_id": question_id, "status": "timeout"})
    except Exception as e:
        print("❌")
        results.append({"question_id": question_id, "status": "error", "error": str(e)[:50]})

# Guardar JSONL
with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
    for result in results:
        f.write(json.dumps(result, ensure_ascii=False) + '\n')

successful = sum(1 for r in results if r.get('status') == 'success')
print(f"\n✅ {successful}/{total} preguntas respondidas")
print(f"📁 Resultados: {RESULTS_FILE}")

PYTHON_EOF
