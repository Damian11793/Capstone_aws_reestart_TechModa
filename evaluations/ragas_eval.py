#!/usr/bin/env python3
"""
RAGAS Evaluation - Una sola corrida para evaluar el ChatBot S8
Uso: python3 ragas_eval.py --s8-url https://... --output results.json
"""

import json
import argparse
import requests
import sys
from datetime import datetime
from typing import List, Dict, Any
import os

# Intenta importar RAGAS, si no está instala las instrucciones
try:
    from ragas import evaluate
    from ragas.metrics import (
        context_precision,
        faithfulness,
        answer_relevance,
        context_recall,
    )
    from datasets import Dataset
except ImportError:
    print("❌ RAGAS no instalado.")
    print("Instala con: pip install ragas datasets")
    sys.exit(1)


def load_questions(filepath: str) -> List[Dict[str, Any]]:
    """Cargar 50 preguntas desde eval_questions_50.json"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = []
    for q in data['evaluation']['questions']:
        questions.append({
            'id': q['id'],
            'question': q['question'],
            'category': q['category'],
            'difficulty': q['difficulty'],
        })

    return questions


def query_chatbot(s8_url: str, question: str) -> Dict[str, Any]:
    """Ejecutar pregunta contra S8 ChatBot"""
    url = f"{s8_url.rstrip('/')}/assistant"

    try:
        response = requests.post(
            url,
            json={"message": question},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error consultando S8: {e}")
        return {
            "reply": "ERROR",
            "retrieved": [],
            "error": str(e)
        }


def format_contexts(retrieved: List[Dict]) -> List[str]:
    """Convertir contextos recuperados a strings"""
    contexts = []
    for item in retrieved:
        context = f"Producto: {item.get('name', 'Unknown')}"
        contexts.append(context)
    return contexts if contexts else ["No context retrieved"]


def run_evaluation(s8_url: str, output_file: str):
    """Ejecutar evaluación RAGAS completa"""

    print("📋 Cargando 50 preguntas...")
    questions = load_questions('evaluations/eval_questions_50.json')

    print(f"🚀 Ejecutando evaluación contra S8...")
    print(f"   URL: {s8_url}")
    print("")

    eval_data = {
        "question": [],
        "contexts": [],
        "answer": [],
        "ground_truth": []  # Para RAGAS, usamos la pregunta como referencia
    }

    metadata = []

    for idx, q in enumerate(questions, 1):
        print(f"[{idx}/50] {q['question'][:50]}...", end=' ', flush=True)

        # Ejecutar contra S8
        result = query_chatbot(s8_url, q['question'])

        if result.get('error'):
            print(f"❌ ERROR")
            continue

        reply = result.get('reply', 'ERROR')
        retrieved = result.get('retrieved', [])
        contexts = format_contexts(retrieved)
        tokens = result.get('usage', {}).get('totalTokens', 0)

        # Agregar a dataset de RAGAS
        eval_data['question'].append(q['question'])
        eval_data['contexts'].append(contexts)
        eval_data['answer'].append(reply)
        eval_data['ground_truth'].append(q['question'])  # Referencia

        # Metadata
        metadata.append({
            'id': q['id'],
            'category': q['category'],
            'difficulty': q['difficulty'],
            'tokens_used': tokens,
            'num_contexts': len(retrieved),
        })

        print("✅")

    print("")
    print("🧮 Calculando métricas con RAGAS...")

    # Crear dataset para RAGAS
    dataset = Dataset.from_dict(eval_data)

    # Ejecutar evaluación
    try:
        scores = evaluate(
            dataset,
            metrics=[
                context_precision,
                faithfulness,
                answer_relevance,
                context_recall,
            ]
        )
        print("✅ Métricas calculadas")
    except Exception as e:
        print(f"⚠️ Error en RAGAS: {e}")
        scores = None

    # Compilar resultados
    results = {
        "timestamp": datetime.now().isoformat(),
        "s8_url": s8_url,
        "total_questions": len(questions),
        "metadata": {
            "framework": "RAGAS",
            "metrics": [
                "context_precision",
                "faithfulness",
                "answer_relevance",
                "context_recall"
            ]
        },
        "metrics": {}
    }

    if scores:
        results['metrics'] = {
            'context_precision': float(scores.get('context_precision', 0)),
            'faithfulness': float(scores.get('faithfulness', 0)),
            'answer_relevance': float(scores.get('answer_relevance', 0)),
            'context_recall': float(scores.get('context_recall', 0)),
        }

        # Promedio general
        avg_score = sum(results['metrics'].values()) / len(results['metrics'])
        results['average_score'] = avg_score

    results['case_details'] = metadata

    # Guardar JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print("")
    print("✅ ========================================")
    print(f"📁 Resultados guardados: {output_file}")
    print("✅ ========================================")
    print("")
    print("📊 RESUMEN:")
    if scores:
        print(f"   Context Precision:  {results['metrics']['context_precision']:.2%}")
        print(f"   Faithfulness:       {results['metrics']['faithfulness']:.2%}")
        print(f"   Answer Relevance:   {results['metrics']['answer_relevance']:.2%}")
        print(f"   Context Recall:     {results['metrics']['context_recall']:.2%}")
        print(f"   ─────────────────────────────")
        print(f"   Promedio:           {results['average_score']:.2%}")
    print("")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluar ChatBot S8 con RAGAS"
    )
    parser.add_argument(
        "--s8-url",
        required=True,
        help="URL del S8 ChatBot (ej: https://xxx.lambda-url.us-east-1.on.aws)"
    )
    parser.add_argument(
        "--output",
        default="evaluations/ragas_results.json",
        help="Archivo de salida (default: evaluations/ragas_results.json)"
    )

    args = parser.parse_args()

    run_evaluation(args.s8_url, args.output)
