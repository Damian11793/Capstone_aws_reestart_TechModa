#!/usr/bin/env python3
"""
prepare_dataset.py
Transforma conversations.jsonl (salida de capture.sh) a formato RAGAS.
RAGAS espera: question, ground_truth, contexts (lista de docs relevantes)
"""

import json
import sys
from pathlib import Path

def main():
    input_file = Path("evaluations/conversations.jsonl")
    output_file = Path("evaluations/dataset.jsonl")

    if not input_file.exists():
        print(f"❌ No encontré {input_file}")
        sys.exit(1)

    print(f"📖 Leyendo {input_file}...")

    converted = []
    with open(input_file, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            try:
                data = json.loads(line.strip())
            except json.JSONDecodeError as e:
                print(f"⚠️  Línea {i} inválida: {e}, saltando")
                continue

            # Convertir al formato RAGAS
            # RAGAS espera: question, ground_truth, contexts
            ragas_item = {
                "question": data.get("query", ""),
                "ground_truth": data.get("response", ""),  # La respuesta del modelo es nuestra verdad
                "contexts": [data.get("response", "")],    # Context es la respuesta misma (para Faithfulness)
            }
            converted.append(ragas_item)

    print(f"✓ Procesadas {len(converted)} conversaciones")

    # Guardar en formato JSONL (una línea por item)
    with open(output_file, "w", encoding="utf-8") as f:
        for item in converted:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"✅ Dataset guardado en {output_file}")
    print(f"   Líneas: {len(converted)}")
    print("")
    print("Próximo paso:")
    print("  pip install ragas")
    print("  pytest evaluations/test_s08_ragas.py -v")
