# 📊 Diagramas - TechModa AI Capstone

## 1. Arquitectura General

```
┌────────────────────────────────────────────────────────────────┐
│                        USUARIO                                 │
└────────────────────────────┬─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   NAVEGADOR     │
                    │  React/Vite     │
                    └────────┬────────┘
                             │ HTTP/CORS
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │  S1-S7  │          │ Router  │          │   S8    │
   │ Lambdas │◄─────────│ Lambda  │─────────►│ ChatBot │
   │ (Vision,│          │(CRUD)   │          │ (RAG)   │
   │Language)│          │         │          │         │
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        │                    │              ┌─────▼──────┐
        │                    │              │  Bedrock   │
        │                    │              │  - Claude  │
        │                    │              │  - Embeddings
        │                    │              │  - Guardrails
        │                    │              └────────────┘
        │                    │
        └────────┬───────────┘
                 │
        ┌────────▼──────────┐
        │   DynamoDB        │
        │   Products        │
        │   - name          │
        │   - price         │
        │   - stock         │
        │   - embedding     │
        └───────────────────┘
```

---

## 2. Flujo del ChatBot (S8 - RAG)

```
┌─────────────────────────────────────────────────────────────────┐
│                      USUARIO PREGUNTA                           │
│              "¿Qué me recomiendas para una boda?"              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────▼───────────────┐
                │    S8 ChatBot Lambda       │
                └────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌────────────┐      ┌──────────┐        ┌──────────────┐
   │ RETRIEVAL  │      │ AUGMENT  │        │ GENERATION   │
   ├────────────┤      ├──────────┤        ├──────────────┤
   │ 1. Embed   │      │ 1. Toma  │        │ 1. Claude    │
   │    la      │      │    top-3 │        │    lee todo  │
   │    pregunta│      │    items │        │ 2. Genera    │
   │ 2. Busca   │      │ 2. Forma │        │    respuesta │
   │    en      │      │    contexto        │    coherente │
   │    DDB     │      │    con      con    │ 3. Aplica   │
   │ 3. Trae    │      │    descripciones   │    guardrails
   │    top-3   │      │ 3. Arma   │        │ 4. Responde │
   │    productos│     │    prompt  │        │ con productos
   └────────────┘      └──────────┘        └──────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   DynamoDB           Prompt Bedrock      Bedrock + Guardrails
   Embeddings         ┌──────────────┐    ┌───────────────────┐
                      │ CONTEXT:     │    │ FILTERS:          │
                      │ - Vestido    │    │ - HATE            │
                      │ - Tenis      │    │ - INSULTS         │
                      │ - Bolso      │    │ - SEXUAL          │
                      └──────────────┘    │ - MISCONDUCT      │
                                          │ - PROMPT_ATTACK   │
                                          └───────────────────┘
                             │
                             ▼
           ┌─────────────────────────────────────┐
           │  RESPUESTA AL USUARIO               │
           │ "Para una boda te recomiendo:       │
           │  1. Vestido midi floral ($79.99)   │
           │  2. Tenis blancos ($89.99)         │
           │  3. Bolso tote ($59.99)"            │
           └─────────────────────────────────────┘
```

---

## 3. Ciclo de Vida de la Solicitud HTTP

```
┌──────────────────────────────────────────────────────────────────┐
│                  FRONTEND (React/Vite)                           │
│                                                                  │
│  User Input → fetch(/assistant, POST, {"message": "..."})      │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ CORS Preflight (OPTIONS)
                     ▼
        ┌────────────────────────────┐
        │ Browser Preflight Check    │
        │ ✓ Access-Control-*Headers  │
        └────────────┬───────────────┘
                     │
                     │ Actual Request (POST)
                     ▼
        ┌────────────────────────────────────┐
        │  S8 Function URL                   │
        │  (Lambda invocation via AWS)       │
        └────────────┬──────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Lambda Handler (Python)  │
        │  - Parse body             │
        │  - Call RAG logic         │
        │  - Return response        │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────────┐
        │  CORS Response Headers        │
        │  Access-Control-Allow-Origin: *
        │  Content-Type: application/json
        └────────────┬──────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │  Browser receives response      │
        │  (CORS validation passes)       │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │  Frontend renders reply         │
        │  in ChatBot message window     │
        └────────────────────────────────┘
```

---

## 4. Evaluación del RAG - 50 Preguntas

```
┌────────────────────────────────────────────────────┐
│   EVALUACIÓN DEL RAG - 50 PREGUNTAS               │
└────────────────────┬───────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │Hallucin- │  │Retrieval │  │Context   │
  │ation     │  │Precision │  │Precision │
  │Detection │  │          │  │          │
  │ 16 Q     │  │  6 Q     │  │  12 Q    │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │             │             │
       └─────────────┼─────────────┘
                     │
                ┌────▼────┐
                │ Answer  │
                │Relevance│
                │  16 Q   │
                └────┬────┘
                     │
        ┌────────────▼────────────┐
        │   run_eval.sh          │
        │   - Ejecuta 50 preguntas
        │   - Captura respuestas  │
        │   - Genera JSONL        │
        └────────────┬────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Resultados               │
        │ eval_results_*.jsonl     │
        │                          │
        │ Métricas por categoría:  │
        │ - Hallucination rate     │
        │ - Retrieval precision    │
        │ - Context recall         │
        │ - Answer relevance %     │
        └──────────────────────────┘
```

---

## 5. Stack de Tecnologías

```
┌─────────────────────────────────────────────────┐
│              FRONTEND LAYER                      │
├─────────────────────────────────────────────────┤
│  React 18 + TypeScript + Tailwind CSS           │
│  Vite (build tool)                              │
│  S3 Website Hosting                             │
└─────────────────────────────────────────────────┘
                     ▲
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────┐
│              API LAYER                           │
├─────────────────────────────────────────────────┤
│  AWS Lambda Function URLs (no API Gateway)      │
│  Node.js 22.x (Router CRUD)                    │
│  Python 3.12 (S1-S8 handlers)                  │
└─────────────────────────────────────────────────┘
                     ▲
                     │ boto3
                     ▼
┌──────────────────────────────────┬──────────────────────────────┐
│      DATA LAYER                  │      AI SERVICES LAYER       │
├──────────────────────────────────┼──────────────────────────────┤
│  DynamoDB                        │  AWS Bedrock                 │
│  - Products table                │  - Claude Haiku              │
│  - On-demand billing             │  - Titan Embeddings          │
│  - Embeddings column             │  - Guardrails               │
│                                  │                              │
│                                  │  AWS Rekognition            │
│                                  │  - DetectLabels             │
│                                  │  - DetectModerationLabels   │
│                                  │                              │
│                                  │  AWS Comprehend             │
│                                  │  - DetectSentiment          │
│                                  │                              │
│                                  │  AWS Polly                  │
│                                  │  - SynthesizeSpeech         │
└──────────────────────────────────┴──────────────────────────────┘
```

---

## 6. IAM - Mínimo Privilegio

```
┌────────────────────────────────────────────────────┐
│         AWS Account (281248178297)                │
│                                                  │
│  Permissions Boundary:                           │
│  techmoda-capstone-boundary                     │
│  (techo máximo de permisos)                     │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  RouterFunction IAM Role                 │   │
│  ├──────────────────────────────────────────┤   │
│  │  - dynamodb:GetItem                      │   │
│  │  - dynamodb:PutItem                      │   │
│  │  - dynamodb:UpdateItem                   │   │
│  │  - dynamodb:DeleteItem                   │   │
│  │  - dynamodb:Query                        │   │
│  │  - dynamodb:Scan                         │   │
│  │  (solo en ProductsTable)                 │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  ShoppingAssistantFunction IAM Role      │   │
│  ├──────────────────────────────────────────┤   │
│  │  - dynamodb:GetItem (read-only)          │   │
│  │  - dynamodb:Query (read-only)            │   │
│  │  - dynamodb:Scan (read-only)             │   │
│  │  - bedrock:InvokeModel                   │   │
│  │  - bedrock:ApplyGuardrail                │   │
│  │  (solo Bedrock en us-east-1)             │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  S1-S7 Lambdas (roles similares)         │   │
│  │  Solo permisos para su servicio           │   │
│  └──────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

## 7. Flujo de Evaluación

```
┌──────────────────────────────────────┐
│  50 Preguntas (JSONL)                │
└────────────┬───────────────────────┘
             │
    ┌────────▼─────────┐
    │  run_eval.sh     │
    │  (bash script)   │
    └────────┬─────────┘
             │
    ┌────────▼─────────────────────┐
    │  Para cada pregunta:          │
    │  1. curl POST /assistant      │
    │  2. Captura respuesta         │
    │  3. Extrae tokens + productos │
    │  4. Escribe en JSONL          │
    └────────┬─────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │  eval_results_TIMESTAMP.jsonl │
    │  (resultados sin evaluar)     │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────┐
    │  EVALUACIÓN MANUAL (por usuario):  │
    │                                   │
    │  Para cada resultado:             │
    │  ✅ Correcto                       │
    │  ⚠️  Parcialmente correcto        │
    │  ❌ Incorrecto                     │
    │                                   │
    │  Calcular métricas:               │
    │  - Hallucination rate %           │
    │  - Retrieval precision %          │
    │  - Context accuracy %             │
    │  - Answer relevance %             │
    └────────────────────────────────────┘
```

---

## 8. Ciclo de Vida - De Pregunta a Respuesta

```
TIME
│
├─ T0: Usuario escribe "¿Tenis para correr?"
│       ↓ enviar click
│
├─ T1: ChatBot.tsx envia fetch POST /assistant
│       Headers: CORS preflight automático
│       ↓
│
├─ T2: Browser envía OPTIONS (CORS check)
│       ✓ Access-Control-Allow-Methods
│       ✓ Access-Control-Allow-Headers
│       ↓
│
├─ T3: Browser envía POST real
│       Body: {"message": "¿Tenis para correr?"}
│       ↓
│
├─ T4: S8 Lambda recibe
│       1. Parse message
│       2. Embed con Titan
│       3. Query DynamoDB
│       4. Trae top-3 productos
│       5. Arma contexto
│       ↓
│
├─ T5: Bedrock Claude procesa
│       System prompt + Contexto + Message
│       ↓ Guardrails filtering
│       ↓
│
├─ T6: Lambda retorna respuesta JSON
│       {reply, retrieved[], tokens, model}
│       Headers: CORS + Content-Type
│       ↓
│
├─ T7: Frontend recibe respuesta
│       Actualiza estado
│       Re-renderiza ChatBot
│       ↓
│
└─ T8: Usuario ve respuesta en chat
        "Te recomiendo tenis blancos... $89.99"
```

---

**Notas**:
- Los diagramas son ASCII para compatibilidad
- Las tecnologías pueden cambiar según versiones
- IAM sigue principio de mínimo privilegio
- CORS es crítico para comunicación frontend ↔ backend
