# 📚 GUÍA DEFINITIVA - TechModa AI Capstone

## 🚀 Inicio Rápido

### Requisitos
- AWS CLI configurado: `aws configure`
- SAM CLI: `brew install aws-sam-cli`
- Node.js 18+
- Cuenta AWS con permisos IAM

### 1️⃣ Descargar y Descomprimir

```bash
# Descargar el archivo
tar -xzf techmoda-ai-capstone-final.tar.gz
cd techmoda-ai-capstone

# Verificar estructura
ls -la
```

### 2️⃣ Desplegar Backend (SAM)

```bash
# Build
sam build

# Deploy
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 --no-confirm-changeset

# Obtener URLs
aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' --output table
```

### 3️⃣ Desplegar Frontend

```bash
# Build React
npm run build --prefix frontend

# Deploy a S3
bash scripts/deploy-frontend.sh
```

### 4️⃣ Verificar Stack

```bash
# Ver estado
bash scripts/status.sh

# Test Router
ROUTER_URL=$(aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

curl -s "${ROUTER_URL}products" | python3 -m json.tool | head -30
```

---

## 🏗️ Arquitectura

### Base (S0)
- **DynamoDB**: `${StackName}-Products` (catálogo)
- **Router Lambda**: Node.js, CRUD vía Function URL
- **Frontend**: React/Vite en S3

### Servicios de IA (S1-S8)
Cada uno es una Lambda Python 3.12 + Bedrock/Rekognition/Comprehend

```
┌─────────────────────────────────────────────────┐
│              Frontend (React/Vite)              │
│         S3 Website Hosting                       │
└─────────────┬───────────────────────────────────┘
              │
              │ HTTP/CORS
              ▼
┌─────────────────────────────────────────────────┐
│         Router Lambda (Function URL)             │
│    Maneja: GET/POST/PUT/DELETE /products       │
└────┬────────────────────────┬─────────────────┘
     │                        │
     │                        ▼
     │          ┌──────────────────────┐
     │          │   S01-S08 Lambdas    │
     │          │  (Bedrock, Rekognition│
     │          │   Comprehend, Polly)  │
     │          └──────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│          DynamoDB Products Table                │
│    productId, name, price, stock, embedding    │
└─────────────────────────────────────────────────┘
```

### S8 - ChatBot (Nuestra estrella)
```
User Input (pregunta)
    ▼
[S8 Lambda - shopping-assistant]
    ├─ 1️⃣ RETRIEVAL: Embeddings → búsqueda semántica en DDB
    ├─ 2️⃣ AUGMENTATION: Arma contexto con productos relevantes
    └─ 3️⃣ GENERATION: Bedrock Claude Haiku con Guardrails
    ▼
Response (recomendación con productos del catálogo)
```

---

## 🧪 Evaluación del RAG - 50 Preguntas

### Ejecutar Evaluación

```bash
cd techmoda-ai-capstone

# Correr las 50 preguntas de prueba
bash evaluations/run_eval.sh

# Ver resultados (JSONL)
cat evaluations/eval_results_*.jsonl | head -10
```

### Categorías Evaluadas

| Categoría | Preguntas | Objetivo |
|-----------|-----------|----------|
| **Hallucination Detection** | 16 | Detectar si el modelo inventa info |
| **Retrieval Precision** | 6 | Verificar recuperación correcta |
| **Context Precision** | 12 | Exactitud de hechos (precios, stock) |
| **Answer Relevance** | 16 | Relevancia de recomendaciones |

### Ejemplo de Pregunta
```json
{
  "id": 4,
  "question": "¿Tienen zapatos de marca Nike?",
  "category": "hallucination_detection",
  "difficulty": "medium"
}
```

✅ **Respuesta Correcta**: "No, no vendemos Nike. Tenemos..."
❌ **Hallucination**: "Sí, vendemos Nike Air Max..."

---

## 🔧 Operaciones Comunes

### Actualizar Producto
```bash
ROUTER_URL="$(aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)"

curl -X PUT "${ROUTER_URL%/}/products/PRODUCT_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Nuevo Nombre",
    "price": 99.99,
    "stock": 50,
    "category": "Ropa",
    "description": "Descripción",
    "imageUrl": "https://example.com/image.jpg"
  }'
```

### Test ChatBot (S8)
```bash
S8_URL=$(aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ShoppingAssistantUrl`].OutputValue' \
  --output text)

curl -X POST "${S8_URL%/}/assistant" \
  -H 'Content-Type: application/json' \
  -d '{"message": "¿Qué me recomiendas para una boda?"}'
```

### Ver Logs de Lambda
```bash
bash scripts/logs.sh get ShoppingAssistantFunction --tail

# Con filtro de errores
bash scripts/logs.sh get ShoppingAssistantFunction --errors
```

### Cleanup (Borrar todo)
```bash
# ⚠️ DESTRUYE EL STACK COMPLETO
bash scripts/delete-all.sh
```

---

## 📊 Costos Estimados

| Servicio | Uso Mensual | Costo |
|----------|-----------|-------|
| **DynamoDB** | On-demand | ~$1-2 |
| **Lambda** (S0-S8) | 10k calls | ~$2-3 |
| **Bedrock** (Haiku) | 10k calls | ~$15-25 |
| **S3 Frontend** | < 1 GB | ~$0.50 |
| **CloudWatch Logs** | 30 días | ~$1-2 |
| **TOTAL** | | ~$20-35 |

---

## 🔐 Seguridad

### IAM - Mínimo Privilegio
Cada Lambda tiene su rol con solo lo necesario:
- **Router**: DynamoDB CRUD
- **S8**: DynamoDB read + Bedrock invoke + Guardrails
- **S1-S7**: Permisos específicos por servicio

### CORS
- Router: Maneja CORS en código (SAM config removido)
- S8: CORS vía SAM FunctionUrlConfig
- Sin duplicación de headers

### Guardrails (S8)
5 capas de filtrado:
1. HATE (odio)
2. INSULTS (insultos)
3. SEXUAL (contenido sexual)
4. MISCONDUCT (conducta inapropiada)
5. PROMPT_ATTACK (inyección de prompts)

---

## 🛠️ Stack Completo - Comandos Rápido

```bash
# === SETUP ===
tar -xzf techmoda-ai-capstone-final.tar.gz
cd techmoda-ai-capstone

# === DEPLOY BACKEND ===
sam build
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 --no-confirm-changeset

# === DEPLOY FRONTEND ===
npm run build --prefix frontend
bash scripts/deploy-frontend.sh

# === VERIFICAR ===
bash scripts/status.sh

# === EVALUAR ===
bash evaluations/run_eval.sh

# === LIMPIAR ===
bash scripts/delete-all.sh
```

---

## 📝 Archivos Importantes

```
techmoda-ai-capstone/
├── template.yaml                 # SAM template (S0-S8)
├── frontend/
│   ├── src/App.tsx              # App principal
│   ├── src/components/
│   │   ├── ChatBot.tsx          # 🤖 ChatBot S8
│   │   └── ProductCard.tsx      # Card de producto
│   └── dist/                    # Build React
├── functions/
│   ├── router/index.js          # CRUD Router
│   └── {list,create,get,update,delete}-items/
├── sessions/
│   ├── S01-S05/                 # AWS Vision/Language
│   ├── S06-bedrock-descripciones/  # GenAI descripciones
│   ├── S07-bedrock-rag/         # Embeddings + búsqueda
│   ├── S08-bedrock-chatbot/     # 🎯 Chatbot RAG
│   ├── S09-guardrails/          # Filtering de contenido
│   └── S10-iam-logging/         # Gobernanza
├── evaluations/
│   ├── eval_questions_50.json   # 50 preguntas prueba
│   ├── run_eval.sh              # Script evaluación
│   └── eval_results_*.jsonl     # Resultados
└── scripts/
    ├── deploy.sh                # Deploy backend
    ├── deploy-frontend.sh       # Deploy frontend
    ├── status.sh                # Ver estado
    └── delete-all.sh            # Cleanup
```

---

## ❓ FAQ

**P: ¿Puedo cambiar el modelo Bedrock?**
A: Sí, edita `template.yaml` → `BEDROCK_MODEL_ID` y los `app.py` de S06 y S08. IDs disponibles en [Bedrock Console](https://console.aws.amazon.com/bedrock).

**P: ¿Cómo agrego más productos?**
A: `curl -X POST $ROUTER_URL/products` con JSON del producto.

**P: ¿El ChatBot inventa información?**
A: Por eso hacemos la evaluación con 50 preguntas. Los Guardrails filtran contenido malo, pero el RAG es lo que previene hallucinations.

**P: ¿Qué pasa si DynamoDB se agota?**
A: Con `PAY_PER_REQUEST` no hay límite, pero los costos suben. Ver `docs/COST_AND_CLEANUP.md`.

---

## 🎓 Recursos

- [AWS SAM Docs](https://docs.aws.amazon.com/serverless-application-model/)
- [Bedrock API](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [RAGAS Framework](https://ragas.io/) (para evaluar RAG)
- [Claude API](https://claude.ai/api)

---

**Creado para AWS re/Start AI Practitioner (AIF-C01)**
