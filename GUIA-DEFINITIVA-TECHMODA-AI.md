# 🚀 TechModa AI Capstone - Guía Definitiva

**Fecha**: Septiembre 2026  
**Estado**: Demo Técnica Funcional  
**Stack**: AWS Serverless + React/TypeScript + Bedrock + Claude Haiku

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Servicios de IA (S0-S8)](#servicios-de-ia-s0-s8)
4. [Frontend y ChatBot](#frontend-y-chatbot)
5. [Flujos de Datos](#flujos-de-datos)
6. [Memoria Conversacional](#memoria-conversacional)
7. [CORS y Configuración](#cors-y-configuración)
8. [Troubleshooting](#troubleshooting)
9. [Comandos Útiles](#comandos-útiles)
10. [Costos](#costos)

---

## Visión General

**TechModa AI** es una plataforma e-commerce serverless que demuestra capacidades de IA de AWS integradas en una aplicación web moderna. 

**Componentes principales:**
- 📦 **Catálogo de productos** (DynamoDB)
- 🤖 **Asistente de compras conversacional** (Bedrock + Claude Haiku)
- 💬 **Chat con memoria conversacional** (localStorage + RAG)
- 😊 **Análisis de sentimientos** (Amazon Comprehend)
- 🔊 **Síntesis de voz** (Amazon Polly)
- 🏷️ **Etiquetado automático** (Rekognition)
- 🔒 **Guardrails** (Bedrock Guardrails)

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Productos   │  │ ChatBot      │  │ Sentimientos    │   │
│  │ (Gallery)   │  │ (S8 + S03)   │  │ (Dashboard)     │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                 │                    │             │
│    S3 Website URL    localStorage             │             │
│    ↓ http://techmoda-ai-jorge-damian-diaz-v2-frontend.s3-website-us-east-1.amazonaws.com/
│                                               │             │
└─────────────────────────────────────────────────────────────┘
              ↓ fetch() + headers CORS
┌─────────────────────────────────────────────────────────────┐
│         LAMBDA FUNCTION URLs (API Layer)                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │
│  │ Router │ │ S03    │ │ S05    │ │ S07    │ │ S08      │ │
│  │ (CRUD) │ │Sentiment│Polly  │ │Search  │ │ChatBot  │ │
│  └───┬────┘ └───┬────┘ └───┬───┘ └───┬────┘ └────┬─────┘ │
│      │          │          │        │           │        │
└──────┼──────────┼──────────┼────────┼───────────┼────────┘
       │          │          │        │           │
       ↓          ↓          ↓        ↓           ↓
   ┌────────────────────────────────────────────────────┐
   │           AWS AI Services & DynamoDB               │
   │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
   │  │ DynamoDB     │ │ Comprehend   │ │ Polly    │  │
   │  │ Products     │ │ Sentiment    │ │ TTS      │  │
   │  └──────────────┘ └──────────────┘ └──────────┘  │
   │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
   │  │ Bedrock      │ │ Titan        │ │ S3       │  │
   │  │ Claude Haiku │ │ Embeddings   │ │ Audio    │  │
   │  └──────────────┘ └──────────────┘ └──────────┘  │
   └────────────────────────────────────────────────────┘
```

---

## Servicios de IA (S0-S8)

### S0 - Base (Router CRUD + DynamoDB)

**Propósito**: Catálogo de productos y API HTTP

**Endpoint**: `https://75eeu36ari7wdkar7iysizrvmi0mlzez.lambda-url.us-east-1.on.aws/`

**Rutas**:
```
GET    /products           → Listar todos
POST   /products           → Crear
GET    /products/{id}      → Obtener uno
PUT    /products/{id}      → Actualizar
DELETE /products/{id}      → Eliminar
```

**Tecnología**:
- Node.js 22.x (Router)
- DynamoDB (Tabla: `Products`)
- Lambda Function URL (CORS headers: `Access-Control-Allow-Origin: *`)

**Código clave** (`functions/router/index.js`):
```javascript
const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(payload),
});
```

---

### S03 - Sentiment Analysis (Comprehend)

**Propósito**: Analizar sentimiento de mensajes del usuario en el chat

**Endpoint**: `https://is74o5mes2qews6ev5ik35vbo40dofva.lambda-url.us-east-1.on.aws/analyze`

**Request**:
```json
{
  "text": "me encanta este producto"
}
```

**Response**:
```json
{
  "results": [
    {
      "sentiment": "POSITIVE",
      "scores": {
        "Positive": 0.95,
        "Neutral": 0.04,
        "Negative": 0.01,
        "Mixed": 0.00
      }
    }
  ]
}
```

**Características**:
- Detección automática de idioma
- Post-procesamiento con palabras clave para mayor precisión
- Negativas: "no me gusta", "horrible", "malo"
- Positivas: "me encanta", "excelente", "perfecto"

**Tecnología**:
- Python 3.12 + boto3
- Amazon Comprehend
- Handler OPTIONS para CORS preflight

---

### S05 - Polly Text-to-Speech

**Propósito**: Síntesis de voz neuronal para accesibilidad y demo

**Endpoints**:
- `/speak` - Genérico (chatbot)
- `/products/{id}/voice` - Descripción de producto

**Request** (`/speak`):
```json
{
  "text": "¡Hola! Soy tu asistente de compras",
  "language": "es"
}
```

**Response**:
```json
{
  "audioUrl": "https://techmoda-ai-jorge-damian-diaz-v2-audio.s3.amazonaws.com/audio/generic-es.mp3?...",
  "expiresIn": 3600
}
```

**Características**:
- Voces neuronales: Lupe (español), Joanna (inglés)
- URLs pre-firmadas válidas 1 hora
- Audio almacenado en S3 (expira en 7 días)
- Auto-play del saludo al abrir chat

**Tecnología**:
- Python 3.12 + boto3
- Amazon Polly (neural engine)
- S3 presigned URLs

---

### S07 - RAG Search (Bedrock Embeddings)

**Propósito**: Búsqueda semántica del catálogo para contexto del ChatBot

**Endpoints**:
- `/search/index` - Construir índice de embeddings
- `/search/query` - Buscar productos relevantes

**Flujo**:
1. Cada producto se embebe con Titan Embeddings
2. Se calcula similitud coseno con la query
3. Top-3 productos más relevantes se pasan al chatbot

---

### S08 - ChatBot Conversacional (Bedrock + Claude Haiku)

**Propósito**: Asistente de compras con RAG y memoria conversacional

**Endpoint**: `https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/assistant`

**Request**:
```json
{
  "message": "busco pantalones azules",
  "conversationHistory": [
    {"role": "user", "content": "hola"},
    {"role": "assistant", "content": "¡Hola! ..."}
  ]
}
```

**Response**:
```json
{
  "reply": "Te recomiendo estos pantalones...",
  "retrieved": [
    {"productId": "P001", "name": "Pantalones Azules"}
  ],
  "usage": {"inputTokens": 250, "outputTokens": 100}
}
```

**Características**:
- **RAG**: Recupera productos relevantes antes de generar respuesta
- **Memoria**: Recibe historial completo de conversación
- **Guardrails**: Filtro de contenido por compliance
- **Temperature**: 0.5 (respuestas consistentes pero creativas)
- **Max tokens**: 400

**System Prompt**:
```
Eres el asistente de compras de TechModa, una tienda de moda. 
Respondé en español neutral, amable y conciso. 
Recomendá ÚNICAMENTE productos del CATÁLOGO que se te entrega como contexto; 
si nada encaja, decirlo con honestidad y sugerir refinar la búsqueda. 
No inventes productos, precios ni características que no estén en el contexto.
```

**Tecnología**:
- Python 3.12 + boto3
- AWS Bedrock (Claude Haiku)
- Titan Embeddings (búsqueda)
- Bedrock Guardrails

---

## Frontend y ChatBot

### Stack Tecnológico

```
React 18 (TypeScript) + Vite
├── Components
│   ├── Products.tsx (gallery con imágenes)
│   ├── ChatBot.tsx (chat + audio + sentimientos)
│   ├── SentimentAnalysis.tsx (dashboard)
│   └── App.tsx (router)
├── Librerías
│   ├── Recharts (gráficos)
│   ├── Lucide React (iconos)
│   └── localStorage (persistencia)
└── Configuración Runtime
    └── env-config.js (URLs de Lambda inyectadas)
```

### ChatBot Component (`ChatBot.tsx`)

**Funcionalidades**:

1. **Auto-play del saludo**
   ```typescript
   useEffect(() => {
     if (isOpen && messages.length === 1) {
       playText(messages[0].content);
     }
   }, [isOpen]);
   ```

2. **Análisis de sentimiento en tiempo real**
   ```typescript
   const analyzeSentiment = async (text: string) => {
     const response = await fetch(`${S3_URL}/analyze`, {
       method: 'POST',
       body: JSON.stringify({ text })
     });
     const data = await response.json();
     return {
       sentiment: data.results?.[0]?.sentiment,
       score: Math.max(...Object.values(data.results?.[0]?.scores || {}))
     };
   };
   ```

3. **Síntesis de voz con botón 🔊**
   ```typescript
   const playText = async (text: string) => {
     const response = await fetch(`${S5_URL}/speak`, {
       method: 'POST',
       body: JSON.stringify({ text, language: 'es' })
     });
     const { audioUrl } = await response.json();
     const audio = new Audio(audioUrl);
     audio.play();
   };
   ```

4. **Envío con historial completo**
   ```typescript
   const conversationHistory = messages.slice(1).map(msg => ({
     role: msg.role,
     content: msg.content
   }));
   
   const response = await fetch(`${S8_URL}/assistant`, {
     method: 'POST',
     body: JSON.stringify({
       message: userText,
       conversationHistory
     })
   });
   ```

5. **Persistencia en localStorage**
   ```typescript
   localStorage.setItem('chat_history', JSON.stringify(messages));
   localStorage.setItem('sentiment_history', JSON.stringify(sentimentData));
   ```

---

## Flujos de Datos

### Flujo 1: Cargar Productos

```
Frontend (onMount)
  ↓ fetch GET /products
Router (S0)
  ↓ DynamoDB scan
Frontend
  ↓ setState + renderizar gallery
```

### Flujo 2: Chat + Sentimiento + Voz

```
User escribe en input
  ↓
Frontend onClick
  ↓
1. analyzeSentiment(text) 
   → S03 (Comprehend)
   → Emoji badge 😊😞😐
   → localStorage
  
2. fetch S8 /assistant
   {message, conversationHistory}
   → S8 Backend
     ├─ S7 embed query
     ├─ S7 retrieve top-3 productos
     └─ Bedrock converse(history + context)
   → Response con reply
  
3. renderizar assistant message
   ↓ onClick 🔊
   ├─ playText(reply)
   │  → S05 /speak
   │  → Polly synthesize
   │  → S3 presigned URL
   │  → Audio element play()
   └─ console ✅ Audio completado
   
4. localStorage.setItem('chat_history')
```

---

## Memoria Conversacional

### Cómo Funciona

1. **Primer mensaje**: User abre chat → S05 auto-play saludo
2. **Mensajes siguientes**: 
   - User escribe → envía a S8 con TODO el historial
   - S8 recibe: `conversationHistory = [msg1, msg2, ..., msg_actual]`
   - Bedrock usa contexto para respuestas coherentes
3. **Persistencia**: `localStorage['chat_history']` sobrevive refrescos

### Estructura en localStorage

```javascript
// chat_history
[
  {
    "role": "assistant",
    "content": "¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?"
  },
  {
    "role": "user",
    "content": "busco pantalones azules"
  },
  {
    "role": "assistant",
    "content": "Te recomiendo estos pantalones azules..."
  }
]

// sentiment_history
[
  {
    "timestamp": "2026-09-23T22:40:00.000Z",
    "message": "busco pantalones azules",
    "sentiment": "NEUTRAL",
    "score": 0.85
  }
]
```

---

## CORS y Configuración

### El Problema CORS que Enfrentamos

**Error**: 
```
The 'Access-Control-Allow-Origin' header contains multiple values '*, http://...'
but only one is allowed.
```

**Causa**: Lambda emitía AUTOMÁTICAMENTE el header `http://origen-del-cliente` ADEMÁS del `*` que emitía Python.

### Solución Final

**SAM Template** (sin Cors declarado):
```yaml
FunctionUrlConfig:
  AuthType: NONE
  # Sin Cors {} aquí
```

**Python** (emite headers manuales):
```python
def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }

def lambda_handler(event, context):
    # OPTIONS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": json.dumps({}),
        }
    
    # POST logic...
```

**Patrón**: SAM ∅ + Python = UN header CORS ✅

---

## Troubleshooting

### 1. Audio no suena (S05)

**Síntoma**: `✅ Respuesta S5` pero sin sonido

**Checklist**:
```bash
# 1. Verifica S05 response
curl -X POST https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"hola mundo","language":"es"}'

# 2. Verifica OPTIONS preflight
curl -X OPTIONS https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws/speak \
  -H "Content-Type: application/json" -v 2>&1 | grep -i access-control

# 3. Verifica URL de S3 audio
# En consola del navegador: copia audioUrl y abre en nueva pestaña
```

**Solución**: Hard refresh (Ctrl+Shift+R) para limpiar cache de Lambda

---

### 2. Chat falla "failed to fetch" (S08)

**Síntoma**: `❌ Audio playback failed: TypeError: Failed to fetch`

**Checklist**:
```bash
# 1. Verifica S08 OPTIONS
curl -X OPTIONS https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/assistant \
  -H "Content-Type: application/json" -v 2>&1 | grep -i access-control

# Debe devolver:
# < access-control-allow-origin: *
# < access-control-allow-methods: POST,OPTIONS
# < access-control-allow-headers: Content-Type

# 2. Verifica POST con datos
curl -X POST https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"hola"}'

# 3. Revisa stack status
aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 --query 'Stacks[0].StackStatus'
```

**Solución**: 
```bash
# Redeploy S08
cd /workshop/techmoda-ai-capstone
sam build -t template.yaml
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3
```

---

### 3. Sentimiento siempre "NEUTRAL" (S03)

**Síntoma**: "me encanta" devuelve NEUTRAL

**Solución en app.py**:
```python
# Post-procesamiento de palabras clave
text_lower = text.lower()
negative_keywords = ["no me gust", "horrible", "malo", "terrible"]
positive_keywords = ["me encanta", "excelente", "perfecto"]

if any(kw in text_lower for kw in negative_keywords):
    if sentiment in ["NEUTRAL", "MIXED"]:
        sentiment = "NEGATIVE"
        scores["Negative"] = 0.75
```

---

## Comandos Útiles

### Deploy

```bash
# Build
cd /workshop/techmoda-ai-capstone
sam build -t template.yaml

# Deploy backend
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3

# Deploy frontend (inyecta URLs de Lambda)
STACK_NAME="techmoda-ai-jorge-damian-diaz-v2" bash scripts/deploy-frontend.sh

# O manual:
npm run build -C frontend/
aws s3 sync frontend/dist/ s3://techmoda-ai-jorge-damian-diaz-v2-frontend/ --delete
```

### Status

```bash
# Stack status
aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 --query 'Stacks[0].StackStatus'

# Todos los endpoints
aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 --query 'Stacks[0].Outputs'
```

### Testing

```bash
# Test S0 Router
API="https://75eeu36ari7wdkar7iysizrvmi0mlzez.lambda-url.us-east-1.on.aws"
curl "${API}/products" | jq .

# Test S03 Sentiment
S3="https://is74o5mes2qews6ev5ik35vbo40dofva.lambda-url.us-east-1.on.aws"
curl -X POST "${S3}/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text":"me encanta este producto"}' | jq .

# Test S05 Polly
S5="https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws"
curl -X POST "${S5}/speak" \
  -H "Content-Type: application/json" \
  -d '{"text":"hola mundo","language":"es"}' | jq .

# Test S08 Chat
S8="https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws"
curl -X POST "${S8}/assistant" \
  -H "Content-Type: application/json" \
  -d '{"message":"busco pantalones"}' | jq .
```

### Logs

```bash
# Ver logs de una Lambda específica
aws logs tail /aws/lambda/techmoda-ai-jorge-damian-diaz-v2-ShoppingAssistant \
  --follow --region us-east-1

# O con timestamps
aws logs tail /aws/lambda/techmoda-ai-jorge-damian-diaz-v2-ShoppingAssistant \
  --follow --format short --region us-east-1 --since 5m
```

---

## Costos

### Precios Unitarios (Septiembre 2026)

| Servicio | Métrica | Precio |
|----------|---------|--------|
| Bedrock Claude Haiku | Input 1M tokens | $0.80 |
| Bedrock Claude Haiku | Output 1M tokens | $4.00 |
| Comprehend Sentiment | Por análisis | $0.0001 |
| Polly Síntesis | Per 1M caracteres | $0.04 |
| Bedrock Guardrails | Per evaluation | $0.04 |
| DynamoDB | Pay-per-request | ~$0.25/1M items |
| S3 Storage | Per GB/mes | $0.023 |
| Lambda | Per 1M requests | $0.20 |

### Escenarios de Uso

**Dev/Demo (50 chats)**:
- Bedrock: 50 × (100 in + 150 out) tokens ≈ $0.004
- Comprehend: 50 × $0.0001 = $0.005
- Polly: 50 × 500 chars × $0.04/1M = $0.001
- **Total**: ~$0.01/día

**Producción (10k chats/mes)**:
- Bedrock: 10k × (250 in + 300 out) × $4/1M = $12.50
- Comprehend: 10k × $0.0001 = $1.00
- Polly: 10k × 500 chars × $0.04/1M = $0.20
- Guardrails: 10k × $0.04/1M = $0.40
- **Total**: ~$14/mes

---

## Stack Técnico Resumido

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **HTTP** | Lambda Function URLs (no API Gateway) |
| **Base de datos** | DynamoDB (sin costo proyecto pequeño) |
| **IA - Chat** | Bedrock + Claude Haiku |
| **IA - Embeddings** | Bedrock Titan |
| **IA - Sentimiento** | Amazon Comprehend |
| **IA - Voz** | Amazon Polly |
| **IA - Seguridad** | Bedrock Guardrails |
| **Storage** | S3 (audio + frontend) |
| **IaC** | SAM (Serverless Application Model) |
| **Región** | us-east-1 |
| **Auth** | Ninguna (demo) |

---

## URLs de Acceso

**Frontend**:
```
http://techmoda-ai-jorge-damian-diaz-v2-frontend.s3-website-us-east-1.amazonaws.com/
```

**API Base**:
```
https://75eeu36ari7wdkar7iysizrvmi0mlzez.lambda-url.us-east-1.on.aws/
```

**Servicios Individuales**:
- S0 Router: ↑ (arriba)
- S03 Sentiment: `https://is74o5mes2qews6ev5ik35vbo40dofva.lambda-url.us-east-1.on.aws/analyze`
- S05 Polly: `https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws/speak`
- S08 ChatBot: `https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/assistant`

---

## Próximos Pasos (Mejoras Futuras)

- [ ] Autenticación con Cognito
- [ ] Almacenar historial en DynamoDB (no solo localStorage)
- [ ] Dashboard de métricas (CloudWatch)
- [ ] Multi-idioma (Translate + Comprehend)
- [ ] Búsqueda avanzada (filtros + facets)
- [ ] Analytics con Athena/QuickSight
- [ ] CI/CD con CodePipeline
- [ ] Pruebas automáticas E2E (Playwright)

---

**Última actualización**: 2026-09-23  
**Autor**: Claude Code (Anthropic)
