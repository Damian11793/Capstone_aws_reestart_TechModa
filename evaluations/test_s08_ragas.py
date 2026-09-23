#!/usr/bin/env python3
"""
test_s08_ragas.py
Tests de RAGAS para evaluar calidad del chatbot S8.
Métricas: Faithfulness, Answer Relevance, Context Precision.

Uso: pytest evaluations/test_s08_ragas.py -v
"""

import json
import os
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def dataset():
    """Cargar dataset de evaluación"""
    dataset_file = Path("evaluations/dataset.jsonl")
    if not dataset_file.exists():
        pytest.skip(f"Dataset no encontrado: {dataset_file}")

    items = []
    with open(dataset_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(json.loads(line))

    if not items:
        pytest.skip("Dataset vacío")

    return items


def test_dataset_exists():
    """Verificar que el dataset existe"""
    dataset_file = Path("evaluations/dataset.jsonl")
    assert dataset_file.exists(), "dataset.jsonl no existe"
    assert dataset_file.stat().st_size > 0, "dataset.jsonl está vacío"


def test_dataset_format(dataset):
    """Verificar formato RAGAS"""
    required_keys = {"question", "ground_truth", "contexts"}
    for i, item in enumerate(dataset):
        assert set(item.keys()) >= required_keys, f"Ítem {i} falta keys: {required_keys - set(item.keys())}"
        assert isinstance(item["question"], str), f"Ítem {i}: question no es string"
        assert isinstance(item["ground_truth"], str), f"Ítem {i}: ground_truth no es string"
        assert isinstance(item["contexts"], list), f"Ítem {i}: contexts no es lista"


def test_no_empty_responses(dataset):
    """Las respuestas del modelo NO deben estar vacías"""
    empty_count = 0
    for i, item in enumerate(dataset):
        if not item["ground_truth"].strip():
            empty_count += 1
            print(f"⚠️  Ítem {i}: respuesta vacía para query '{item['question']}'")

    assert empty_count == 0, f"{empty_count} respuestas vacías encontradas"


@pytest.mark.skip(reason="Requiere RAGAS + API keys; ver instrucciones")
def test_faithfulness(dataset):
    """
    RAGAS: Faithfulness — ¿la respuesta es fiel al contexto?
    Requiere: pip install ragas
    Nota: este test se ejecuta con: pytest -v -m "not skip" para saltarlo por defecto
    """
    try:
        from ragas.metrics import faithfulness
        from ragas.run_config import RunConfig
    except ImportError:
        pytest.skip("ragas no instalado")

    # Configurar RAGAS (requiere variables de entorno para LLM evaluador)
    os.environ.setdefault("OPENAI_API_KEY", "sk-...")  # Reemplazar o pasar via env

    config = RunConfig()
    scores = []

    for item in dataset:
        try:
            score = faithfulness.compute(
                item=item,
                run_config=config,
            )
            scores.append(score)
        except Exception as e:
            print(f"Error evaluando faithfulness: {e}")

    avg_score = sum(scores) / len(scores) if scores else 0
    print(f"\n📊 Faithfulness score: {avg_score:.3f} (min 0.7)")
    assert avg_score >= 0.7, f"Faithfulness bajo: {avg_score}"


@pytest.mark.skip(reason="Requiere RAGAS + API keys; ver instrucciones")
def test_answer_relevance(dataset):
    """
    RAGAS: Answer Relevance — ¿la respuesta contesta la pregunta?
    """
    try:
        from ragas.metrics import answer_relevance
        from ragas.run_config import RunConfig
    except ImportError:
        pytest.skip("ragas no instalado")

    os.environ.setdefault("OPENAI_API_KEY", "sk-...")

    config = RunConfig()
    scores = []

    for item in dataset:
        try:
            score = answer_relevance.compute(
                item=item,
                run_config=config,
            )
            scores.append(score)
        except Exception as e:
            print(f"Error evaluando answer_relevance: {e}")

    avg_score = sum(scores) / len(scores) if scores else 0
    print(f"\n📊 Answer Relevance score: {avg_score:.3f} (min 0.7)")
    assert avg_score >= 0.7, f"Answer Relevance bajo: {avg_score}"


@pytest.mark.skip(reason="Requiere RAGAS + API keys; ver instrucciones")
def test_context_precision(dataset):
    """
    RAGAS: Context Precision — ¿el retrieval trae contexto relevante?
    """
    try:
        from ragas.metrics import context_precision
        from ragas.run_config import RunConfig
    except ImportError:
        pytest.skip("ragas no instalado")

    os.environ.setdefault("OPENAI_API_KEY", "sk-...")

    config = RunConfig()
    scores = []

    for item in dataset:
        try:
            score = context_precision.compute(
                item=item,
                run_config=config,
            )
            scores.append(score)
        except Exception as e:
            print(f"Error evaluando context_precision: {e}")

    avg_score = sum(scores) / len(scores) if scores else 0
    print(f"\n📊 Context Precision score: {avg_score:.3f} (min 0.7)")
    assert avg_score >= 0.7, f"Context Precision bajo: {avg_score}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
