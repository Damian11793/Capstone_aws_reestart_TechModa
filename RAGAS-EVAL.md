# 📊 Evaluación con RAGAS - ChatBot S8

Evaluación de una sola corrida del ChatBot usando **RAGAS** (Retrieval-Augmented Generation Assessment).

---

## 🚀 Quickstart (3 pasos)

### 1️⃣ Instalar RAGAS

```bash
pip install ragas datasets
```

### 2️⃣ Obtener URL de S8

```bash
# Desde tu máquina con AWS configurado:
aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ShoppingAssistantUrl`].OutputValue' \
  --output text
```

Salida: `https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/`

### 3️⃣ Ejecutar Evaluación

```bash
cd techmoda-ai-capstone

python3 evaluations/ragas_eval.py \
  --s8-url https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws \
  --output evaluations/ragas_results.json
```

**Output:**
- `evaluations/ragas_results.json` ← Descarga esto
- Console muestra resumen

---

## 📊 Ver Resultados en Frontend

### Opción 1: Subir JSON al dashboard

```bash
# Una vez construido el frontend:
npm run build --prefix frontend

# Abre: http://localhost:5173/
# → Click "Evaluación" tab
# → Carga el archivo ragas_results.json
```

### Opción 2: Ver JSON directamente

```bash
cat evaluations/ragas_results.json | python3 -m json.tool
```

---

## 📈 Métricas RAGAS

| Métrica | Qué mide | Rango |
|---------|----------|-------|
| **Context Precision** | Relevancia de contextos recuperados | 0-1 |
| **Faithfulness** | Respuesta fiel al contexto (sin hallucinations) | 0-1 |
| **Answer Relevance** | Respuesta responde la pregunta | 0-1 |
| **Context Recall** | ¿Se recuperó el contexto necesario? | 0-1 |

**Interpretación:**
- ✅ ≥ 0.85: Excelente
- ⚠️ 0.70–0.85: Bueno, margen de mejora
- ❌ < 0.70: Necesita trabajo

---

## 🎯 Estructura del JSON Resultante

```json
{
  "timestamp": "2026-09-23T20:15:30.123456",
  "s8_url": "https://...",
  "total_questions": 50,
  "average_score": 0.82,
  "metrics": {
    "context_precision": 0.85,
    "faithfulness": 0.78,
    "answer_relevance": 0.88,
    "context_recall": 0.76
  },
  "case_details": [
    {
      "id": 1,
      "category": "retrieval_precision",
      "difficulty": "easy",
      "tokens_used": 350,
      "num_contexts": 3
    },
    ...
  ]
}
```

---

## 🔧 Opciones Avanzadas

### Usar otro archivo de preguntas

```bash
python3 evaluations/ragas_eval.py \
  --s8-url https://... \
  --output evaluations/custom_results.json
  # (cambia el path en ragas_eval.py si necesitas otro dataset)
```

### Ejecutar solo un subset de preguntas

Edita `ragas_eval.py` línea 75:
```python
for idx, q in enumerate(questions[:10], 1):  # Solo primeras 10
```

---

## ⚡ Costos

- **Chatbot (Haiku):** ~$0.05
- **Evaluación:** $0.00 (RAGAS es local)
- **Total:** ~$0.05 USD 💰

---

## 🐛 Troubleshooting

### Error: "RAGAS no instalado"
```bash
pip install ragas datasets
```

### Error: "No se puede conectar a S8"
```bash
# Verifica que la URL sea correcta:
curl -s https://tu-url/assistant -X POST \
  -H 'Content-Type: application/json' \
  -d '{"message":"hola"}'
```

### Error: "No se encuentra eval_questions_50.json"
Asegúrate de estar en `techmoda-ai-capstone/` y que el archivo exista:
```bash
ls evaluations/eval_questions_50.json
```

---

## 📝 Interpretar Resultados

**Buen resultado (0.80+):**
```
✅ Context Precision 0.87  → Recupera contexto relevante
✅ Faithfulness 0.82       → Respuestas sin hallucinations
✅ Answer Relevance 0.85   → Responde bien
✅ Context Recall 0.78     → Obtiene contexto necesario
```

**Qué hacer si baja alguna métrica:**
- **Context Precision baja** → Embeddings no alineados, revisar RAG
- **Faithfulness baja** → Modelo alucina, ajusta system prompt
- **Answer Relevance baja** → Modelo no entiende preguntas
- **Context Recall baja** → KB indexing incompleto

---

## 🎓 Próximos Pasos

1. ✅ Ejecuta evaluación
2. ✅ Descarga ragas_results.json
3. ✅ Visualiza en frontend (tab Evaluación)
4. 📊 Comparte resultados en portafolio
5. 🚀 Opcional: Mejora el promot o KB basado en resultados

---

**Framework:** RAGAS  
**Modelos:** Claude Haiku (chatbot) + Haiku (embeddings internos RAGAS)  
**Duración:** ~2-3 minutos  
**Costo:** ~$0.05 USD
