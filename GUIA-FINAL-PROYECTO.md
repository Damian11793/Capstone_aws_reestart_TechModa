# 🎯 TechModa AI Capstone - Guía Completa

**Fecha:** 2026-09-24 | **Estado:** ✅ Producción | **Versión:** 2.0

---

## 📊 Resumen Ejecutivo

### ✅ Logros
- **8 Servicios IA** (S01-S08) completamente funcionales
- **9 Productos** en catálogo con imágenes y embeddings
- **50 Tests RAGAS** ejecutados con 100% de éxito
- **Frontend React** con chat inteligente en tiempo real
- **Arquitectura Serverless** escalable y sin servidor
- **Stack AWS:** Lambda, DynamoDB, Bedrock, Rekognition, Comprehend, Translate, Polly

### 🎯 Punto Fuerte: Chatbot S08 (Shopping Assistant)
El chatbot integra **6 servicios de IA** en un único flujo RAG conversacional:
- Búsqueda semántica (S07)
- Generación de descripciones (S06)
- Análisis de sentimiento (S03)
- Detección de objetos en imágenes (S01)
- Síntesis de voz (S05)
- Traducción multiidioma (S04)

---

## 🏢 Arquitectura AWS Completa

### Stack de Servicios AWS Utilizados

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   INTERNET / USUARIO                             │
└────────────────────────────────────┬─────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────────┐          ┌──────────────────────┐
        │   CloudFront (CDN)    │          │ Lambda Function URLs │
        │   S3 Website Hosting  │          │   (8 endpoints IA)   │
        │  techmoda.s3.com/     │          │   (1 CRUD router)    │
        └───────────┬───────────┘          └──────────┬───────────┘
                    │                                 │
        ┌───────────▼───────────┐          ┌──────────▼───────────┐
        │     S3 Bucket         │          │   IAM Roles          │
        │  ├─ index.html        │          │   (1 por Lambda)     │
        │  ├─ React app (SPA)   │          │   Mínimo privilegio  │
        │  ├─ CSS/JS/Assets     │          │                      │
        │  ├─ Images (9 prod.)  │          │   ec2:None           │
        │  └─ Audio (Polly)     │          │   rds:None           │
        └───────────────────────┘          │   root:None          │
                                           └──────────────────────┘
                                                     │
                ┌────────────────────────────────────┼────────────────────────────────┐
                │                                    │                                │
                ▼                                    ▼                                ▼
        ┌─────────────────┐              ┌──────────────────────┐          ┌──────────────────┐
        │   DynamoDB      │              │   Lambda Funciones   │          │   AI Services    │
        │   (Tablas)      │              │      (Python 3.12)   │          │    (AWS)         │
        ├─ Products       │              ├─ S00: Router (Node)  │          ├─ Bedrock         │
        ├─ Chats          │              ├─ S01: Rekognition    │          │  (Claude Haiku)  │
        ├─ Embeddings     │              ├─ S02: Moderation     │          ├─ Rekognition     │
        ├─ Translations   │              ├─ S03: Comprehend     │          │  (Detect Labels) │
        └─ Metadata       │              ├─ S04: Translate      │          ├─ Comprehend      │
                          │              ├─ S05: Polly          │          │  (Sentiment)     │
                          │              ├─ S06: Description *  │          ├─ Translate       │
        ┌─────────────────┐              ├─ S07: Search/Embed*  │          │  (Neural MT)     │
        │  S3 Audio Bin   │              ├─ S08: ChatBot *      │          ├─ Polly           │
        │  (Polly output) │              └─ (+ S09-S11 futures) │          │  (Voice Synthesis)
        │  7 días TTL     │                       *Converse API  │          └──────────────────┘
        └─────────────────┘                                      │
                                                                 │
                            ┌────────────────────────────────────┘
                            │
                ┌───────────┬┴────┬──────────────────────────────────┐
                │           │     │                                  │
                ▼           ▼     ▼                                  ▼
        ┌──────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐
        │   Bedrock    │ │Rekognit- │ │Comprehend │ │  Translate +     │
        │              │ │ion       │ │           │ │  Polly           │
        │ Models:      │ │          │ │ ├─ Sentiment   │ ├─ ES/EN      │
        │ - Claude     │ │ ├─ Labels│ │ ├─ Language    │ ├─ Neural     │
        │   Haiku 4.5  │ │ ├─ Moderat│ │ └─ Entities   │ └─ MP3 Audio  │
        │ - Titan      │ │ └─ bbox  │ │          │ │                  │
        │   Embeddings │ │          │ │          │ │  Voice:          │
        │              │ │API Calls:│ │ Max 100  │ │  - Lucia (ES)    │
        │ Features:    │ │ • S01    │ │   units  │ │  - Lola (ES alt) │
        │ • Tokens     │ │ • S02    │ │ per req  │ │  - Arthur (EN)   │
        │ • Streaming  │ │ • S08    │ │          │ │  - Engine: neural│
        │ • Inference  │ │          │ │          │ │                  │
        └──────────────┘ └──────────┘ └───────────┘ └──────────────────┘
         (Tokens + Inference        (Vision Labels)  (NLP + Text-to-Speech)
          Profiles)                (Content Safety)
```

### Flujo de Datos: Capa por Capa

```
CAPA 1: FRONTEND (Browser)
┌─────────────────────────────────────────────────────┐
│ React SPA (Vite)                                    │
│ ├─ src/pages/Chat.tsx (S08 interface)             │
│ ├─ src/pages/Catalog.tsx (S00 product list)       │
│ ├─ src/lib/api.ts (HTTP client)                   │
│ └─ Fetch: ApiUrl variable desde env-config.js     │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/HTTPS
                   ▼
CAPA 2: CDN + HOSTING (AWS)
┌─────────────────────────────────────────────────────┐
│ CloudFront (HTTPS, Cache, Global)                  │
│   ↓ Serves static assets                           │
│ S3 Bucket (Website Endpoint)                       │
│ ├─ index.html (SPA entry point)                    │
│ ├─ app-*.js (React bundle)                         │
│ └─ assets/ (images, audio)                         │
└──────────────────┬──────────────────────────────────┘
                   │ API Call to Lambda URL
                   ▼
CAPA 3: API (Serverless)
┌─────────────────────────────────────────────────────┐
│ Lambda Function URLs (9 total)                      │
│                                                     │
│ ┌─ S00: CRUD Router (Node.js 22)                  │
│ │  ├─ GET /products → listItems()                  │
│ │  ├─ POST /products → createItem()                │
│ │  └─ PUT /products/{id} → updateItem()            │
│ │                                                  │
│ └─ S01-S08: IA Services (Python 3.12)             │
│    ├─ S01: POST /products/{id}/enrich-labels      │
│    ├─ S02: POST /products/{id}/moderate-image     │
│    ├─ S03: POST /products/{id}/analyze-sentiment  │
│    ├─ S04: POST /products/{id}/translate          │
│    ├─ S05: POST /synthesize-voice                 │
│    ├─ S06: POST /products/{id}/describe           │
│    ├─ S07: POST /search (+ POST /search/index)    │
│    └─ S08: POST /assistant (main chatbot)         │
│                                                     │
│ AuthType: NONE | CORS: * | Timeout: 30-60s        │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┼──────────┐
         │         │          │
         ▼         ▼          ▼
CAPA 4: DATOS + COMPUTACIÓN
┌──────────┐  ┌──────────┐  ┌────────────────────┐
│ DynamoDB │  │ Lambda   │  │ IAM (por función)  │
│ (Schemas)│  │ Execution│  │                    │
├──────────┤  │ Role     │  │ Policies:          │
│Products  │  │          │  │ • dynamodb:*       │
│├─ PK: id │  │ Memory:  │  │ • bedrock:*        │
│├─ name   │  │ 256-512  │  │ • rekognition:*    │
│├─ price  │  │ MB       │  │ • comprehend:*     │
│├─ image  │  │          │  │ • translate:*      │
│├─ stock  │  │ Env Vars │  │ • polly:*          │
│├─ embed  │  │          │  │ • s3:GetObject     │
│└─ labels │  │ MODEL_ID │  │ • s3:PutObject     │
│          │  │ REGION   │  │ • logs:CreateLog   │
│Chats     │  │ TABLE    │  │                    │
│├─ PK: id │  │          │  │ No: EC2, RDS, IAM- │
│├─ user   │  │          │  │      Admin         │
│└─ msgs[] │  │          │  │                    │
│          │  │          │  │                    │
│Embeddings│  │          │  │                    │
│(vector)  │  │          │  │                    │
└──────────┘  └──────────┘  └────────────────────┘
         │
         └────────────────────┐
                              │
CAPA 5: IA SERVICES (AWS AI)  ▼
┌────────────────────────────────────┐
│ Amazon Bedrock                     │
│ ├─ Claude Haiku 4.5 (Converse API)│
│ │  ├─ S06: Generate descriptions  │
│ │  └─ S08: Chat responses         │
│ └─ Titan Embeddings (v2)          │
│    ├─ Vector: 1024-dim            │
│    └─ S07: Semantic search        │
├────────────────────────────────────┤
│ Amazon Rekognition (Vision)        │
│ ├─ DetectLabels (S01)              │
│ │  └─ Confidence: ≥80%            │
│ └─ DetectModerationLabels (S02)    │
│    └─ Content Safety              │
├────────────────────────────────────┤
│ Amazon Comprehend (NLP)            │
│ ├─ DetectSentiment (S03)           │
│ ├─ DetectDominantLanguage (S03)    │
│ └─ Sentiment: +ive/-ive/neutral    │
├────────────────────────────────────┤
│ Amazon Translate (Neural MT)       │
│ ├─ S04: ES ↔ EN translation       │
│ ├─ Neural engine (higher quality) │
│ └─ Auto-detect source language    │
├────────────────────────────────────┤
│ Amazon Polly (Speech)              │
│ ├─ S05: Text-to-speech            │
│ ├─ Voice: Lucia (Spanish neural)  │
│ ├─ Format: MP3                    │
│ └─ Engine: neural                 │
└────────────────────────────────────┘

CAPA 6: MONITORING
┌─────────────────────────────────────┐
│ CloudWatch                          │
│ ├─ Logs: /aws/lambda/[function]    │
│ ├─ Metrics: Invocations, Duration  │
│ └─ Alarms: Error rate > 5%         │
└─────────────────────────────────────┘
```

### Matriz de Servicios AWS por Función

| Lambda | Tipo | Runtime | Servicios AWS | Timeout | Memory |
|--------|------|---------|---------------|---------|--------|
| **S00** | CRUD | Node 22 | DynamoDB, S3  | 30s | 256 MB |
| **S01** | Vision | Python 3.12 | Rekognition, DDB | 30s | 512 MB |
| **S02** | Vision | Python 3.12 | Rekognition, DDB | 30s | 512 MB |
| **S03** | NLP | Python 3.12 | Comprehend, DDB | 30s | 512 MB |
| **S04** | NLP | Python 3.12 | Translate, DDB | 30s | 512 MB |
| **S05** | Speech | Python 3.12 | Polly, S3, DDB | 30s | 512 MB |
| **S06** | GenAI | Python 3.12 | Bedrock, DDB | 60s | 512 MB |
| **S07** | Search | Python 3.12 | Bedrock (embed), DDB | 30s | 512 MB |
| **S08** | GenAI | Python 3.12 | Bedrock, all above | 60s | 1024 MB |

### Regiones y Endpoints

```
✅ Región Primary: us-east-1
   ├─ Lambda Functions: *.lambda-url.us-east-1.on.aws
   ├─ DynamoDB: dynamodb.us-east-1.amazonaws.com
   ├─ Bedrock: bedrock-runtime.us-east-1.amazonaws.com
   ├─ Rekognition: rekognition.us-east-1.amazonaws.com
   ├─ Comprehend: comprehend.us-east-1.amazonaws.com
   ├─ Translate: translate.us-east-1.amazonaws.com
   ├─ Polly: polly.us-east-1.amazonaws.com
   ├─ S3: s3.us-east-1.amazonaws.com
   ├─ CloudFront: d[...].cloudfront.net
   └─ CloudWatch: logs.us-east-1.amazonaws.com

NOTA: Bedrock model access debe habilitarse en AWS Console
      → Bedrock > Model Access > Enable "Claude 3.5 Haiku"
      (Se hace una sola vez por región)
```

---

## 🏗️ Arquitectura Completa

### Diagrama de Flujo
```
┌─────────────────────────────────────────────────────────────┐
│                      USUARIO FINAL                          │
│         Chat en Frontend React + Imágenes                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP/HTTPS
                         │
            ┌────────────┴────────────┐
            │                         │
     ┌──────▼──────┐          ┌──────▼──────┐
     │ S00: Router │          │ S08: Chatbot│
     │    CRUD     │          │   (RAG)     │
     └──────┬──────┘          └──────┬──────┘
            │                        │
      ┌─────┴─────┐        ┌────────┼────────┬──────────┐
      ▼           ▼        ▼        ▼        ▼          ▼
   ┌─────┐   ┌────────┐ ┌────┐  ┌────┐  ┌────┐     ┌──────┐
   │DDB  │   │Product │ │S01 │  │S02 │  │S03 │     │S06   │
   │CRUD │   │Images  │ │Lab │  │Mod │  │Sent│     │Desc  │
   └─────┘   └────────┘ │els │  │erat│  │im  │     │Gener │
                        │    │  │ion │  │ent │     │      │
                        └────┘  └────┘  └────┘     └──────┘
                         │        │       │           │
                  ┌──────┴────────┼───────┴───────────┤
                  │               │                   │
                  ▼               ▼                   ▼
            ┌──────────┐   ┌───────────┐        ┌──────────┐
            │S07: RAG  │   │S04: Trans │        │S05: Polly│
            │Embeddings│   │lation     │        │Voice     │
            └──────────┘   └───────────┘        └──────────┘
                  │               │                   │
       ┌──────────┼───────────────┼───────────────────┤
       ▼          ▼               ▼                   ▼
   ┌─────────────────────────────────────────────────────┐
   │              AWS Services (Backend)                 │
   ├─────────────────────────────────────────────────────┤
   │ ✓ Bedrock (Claude Haiku) - S06, S08               │
   │ ✓ Rekognition - S01, S02, S08                     │
   │ ✓ Comprehend - S03                                │
   │ ✓ Translate - S04                                 │
   │ ✓ Polly - S05                                     │
   │ ✓ DynamoDB - Persistencia                         │
   │ ✓ S3 - Almacenamiento de audio/imágenes           │
   └─────────────────────────────────────────────────────┘
```

---

## 🔍 Flujo Detallado del Chatbot S08

### 1️⃣ Usuario Inicia Chat
```
Usuario: "¿Tienes algo cómodo para el frío?"
         │
         └─→ [Envío a S08 /assistant]
             └─→ POST https://S8_URL/assistant
                 {
                   "message": "¿Tienes algo cómodo para el frío?",
                   "conversationHistory": [],
                   "image": null (opcional)
                 }
```

### 2️⃣ S08 Procesa Request
```
S08 Shopping Assistant
│
├─→ 🔍 RETRIEVAL (S07 Embeddings)
│   ├─ Embarcar pregunta → Vector
│   ├─ Comparar con embeddings de 9 productos
│   └─ Top-K=3 productos más relevantes
│      ✓ "Sudadera negra" (similitud: 0.92)
│      ✓ "Chaqueta mezclilla" (similitud: 0.89)
│      ✓ "Bata baño negra" (similitud: 0.85)
│
├─→ 🎯 AUGMENT (Construir Contexto)
│   ├─ Formatear productos recuperados
│   └─ Crear CATÁLOGO_RELEVANTE:
│      """
│      - Sudadera negra | Categoría: Ropa | Precio: $69.99 |
│        Cómoda y versátil para cualquier ocasión
│      - Chaqueta mezclilla | Categoría: Ropa | Precio: $149.99 |
│        Chaqueta de mezclilla oversize con acabado vintage
│      - Bata baño negra | Categoría: Ropa | Precio: $59.99 |
│        Bata de baño cómoda y elegante
│      """
│
├─→ 🤖 GENERATION (Bedrock Claude)
│   ├─ System Prompt:
│   │  "Eres el asistente de compras de TechModa.
│   │   Recomendá ÚNICAMENTE productos del CATÁLOGO."
│   │
│   ├─ User Message:
│   │  "CATÁLOGO RELEVANTE: [productos arriba]
│   │   PREGUNTA: ¿Tienes algo cómodo para el frío?"
│   │
│   └─ Claude Haiku genera:
│      """
│      ¡Hola! Tenemos excelentes opciones para el frío:
│
│      1. **Sudadera negra** - $69.99
│         Perfecta para días fríos, cómoda y versátil
│
│      2. **Chaqueta mezclilla** - $149.99
│         Para un estilo más sofisticado
│
│      3. **Bata baño** - $59.99
│         Ideal para momentos relajados
│      """
│
└─→ 📤 RESPONSE
    {
      "reply": "¡Hola! Tenemos excelentes opciones...",
      "retrieved": [
        {productId: "9", name: "Sudadera negra"},
        {productId: "2", name: "Chaqueta mezclilla"},
        {productId: "6", name: "Bata baño negra"}
      ],
      "usage": {
        "inputTokens": 384,
        "outputTokens": 227
      }
    }
```

### 3️⃣ Casos Especiales: Generación de Descripciones

```
Usuario: "Dame una descripción de la sudadera"
         │
         └─→ S08 detecta intención
             └─→ Pattern: r"dame\s+(?:una\s+)?descripción"
                │
                └─→ Llama S06 /describe
                    │
                    ├─ Lee producto: "Sudadera negra"
                    │  ├─ name: "Sudadera negra"
                    │  ├─ category: "Ropa"
                    │  ├─ price: "$69.99"
                    │  ├─ aiLabels: ["Clothing", "Sweater"]
                    │  └─ description: "Sudadera cómoda..."
                    │
                    ├─ Construye prompt:
                    │  "Sos un redactor de e-commerce...
                    │   Atributos:
                    │   - Nombre: Sudadera negra
                    │   - Categoría: Ropa
                    │   - Precio: $69.99
                    │   - Atributos visuales: Clothing, Sweater"
                    │
                    ├─ Bedrock genera:
                    │  "Sudadera negra versátil que combina
                    │   comodidad y estilo moderno..."
                    │
                    └─→ S08 inyecta en contexto RAG
                        └─→ Respuesta mejorada con descripción
```

### 4️⃣ Análisis de Imágenes (Si aplica)

```
Usuario: [Sube imagen de tenis]
         │
         └─→ S08 detecta imagen base64
             │
             ├─→ S01: Rekognition DetectLabels
             │  ├─ Detecta: ["Clothing", "Footwear", "Shoe"]
             │  └─ Confianza: ≥80%
             │
             ├─→ S02: Moderation Check
             │  └─ Verifica contenido apropiado
             │
             ├─→ Auto-búsqueda:
             │  "Recomiéndame productos similares a: Footwear, Shoe"
             │
             └─→ RAG retrieval con context visual
                 └─→ Devuelve tenis del catálogo
```

---

## 🛠️ Servicios Individuales y Funcionalidad

### S00 - Router CRUD Base
**Ubicación:** `/functions/router/`  
**Tecnología:** Node.js 22 + DynamoDB

**Responsabilidad:**
- Enrutador HTTP principal
- CRUD de productos
- Gestión de imágenes

**Endpoints:**
```bash
GET  /products           → Listar todos
POST /products           → Crear producto
GET  /products/{id}      → Obtener uno
PUT  /products/{id}      → Actualizar
DELETE /products/{id}    → Eliminar
```

**Cambios esta sesión:**
- ✅ Eliminada dependencia `aws-sdk` (usando Node nativo)
- ✅ CORS headers en todas las respuestas
- ✅ Manejo de error 502 resuelto

---

### S01 - Rekognition DetectLabels
**Ubicación:** `/sessions/S01-rekognition-labels/`  
**Tecnología:** Python 3.12 + AWS Rekognition

**Función:**
Auto-etiquetado inteligente de imágenes con **confianza mínima 80%**

**Flujo:**
```
Imagen (URL o S3)
    ↓
Rekognition.detect_labels()
    ↓
Filtro: confidence ≥ 80%
    ↓
Guardar en DynamoDB: aiLabels[]
    ↓
Usar en S06 (description generator)
```

**Ejemplo:**
```
Input: foto_tenis.jpg
Output: {
  "aiLabels": ["Footwear", "Shoe", "Athletic Shoe"],
  "confidence": [99.8, 98.5, 97.2]
}
```

**Integración en proyecto:**
- S06 usa aiLabels para mejorar prompts
- S08 usa aiLabels en búsqueda semántica

---

### S02 - Moderation + Alt-Text
**Ubicación:** `/sessions/S02-moderation-alttext/`  
**Tecnología:** Python 3.12 + Rekognition

**Función:**
- Detectar contenido inapropiado (violencia, desnudez, etc.)
- Generar alt-text automático para accesibilidad

**Flujo:**
```
Imagen
    ↓
DetectModerationLabels()
    ↓
¿Confidence ≥ 60% algo inapropiado?
    ├─ SÍ: Rechazar + guardar flag
    └─ NO: Generar alt-text
              ├─ "An athletic shoe displayed..."
              └─ Guardar en DynamoDB
```

**Integración:**
- Valida imágenes de producto antes de S01
- Alt-text para accesibilidad web

---

### S03 - Sentiment Analysis
**Ubicación:** `/sessions/S03-comprehend-sentiment/`  
**Tecnología:** Python 3.12 + Comprehend

**Función:**
Análisis de sentimiento de reseñas (POSITIVE, NEGATIVE, NEUTRAL, MIXED)

**Flujo:**
```
Reseña de cliente
    ↓
DetectSentiment()
DetectDominantLanguage()
    ↓
Post-procesamiento:
├─ Si NEUTRAL: buscar keywords negativos/positivos
└─ Override si encontrado
    ↓
Guardar score en DynamoDB
```

**Cambios esta sesión:**
- ✅ Agregado DetectDominantLanguage para multiidioma
- ✅ Post-processing con palabras clave

---

### S04 - Translate (Multiidioma)
**Ubicación:** `/sessions/S04-translate-multilang/`  
**Tecnología:** Python 3.12 + Amazon Translate

**Función:**
Traducción automática de catálogo ES ↔ EN

**Flujo:**
```
Producto (name + description)
    ↓
Translate API
    ├─ Detectar idioma: auto
    ├─ Traducir a: EN o ES
    └─ Traducción automática neural
    ↓
Guardar en DynamoDB:
  translations.en = {name, description}
```

**Integración:**
- Frontend permite cambiar idioma
- Catálogo disponible bilingüe

---

### S05 - Polly Voice Synthesis
**Ubicación:** `/sessions/S05-polly-voice/`  
**Tecnología:** Python 3.12 + Amazon Polly

**Función:**
Síntesis de voz para descripciones de producto

**Flujo:**
```
Texto (descripción)
    ↓
Polly.synthesize_speech()
    ├─ Voice: Lola (español)
    ├─ Format: MP3
    └─ OutputFormat: audio/mpeg
    ↓
Guardar en S3 Audio Bucket
    ├─ Generar URL presignada
    ├─ Expira en: 1 hora
    └─ Retornar URL
    ↓
Frontend reproduce audio
```

**Integración:**
- Chat S08 reproduce saludo inicial
- Descripciones con opción de audio

---

### S06 - Generate Description ⭐ NUEVO
**Ubicación:** `/sessions/S06-bedrock-descripciones/`  
**Tecnología:** Python 3.12 + Bedrock (Claude Haiku)

**Función:**
Generación IA de descripciones de productos con variabilidad de tono

**Flujo:**
```
Request: POST /products/{id}/describe
Body: {
  "tone": "elegante",  (parámetro)
  "save": true         (persistir)
}
    ↓
Leer producto de DynamoDB
    ├─ name, category, price
    ├─ aiLabels (de S01)
    └─ Atributos visuales
    ↓
Construir PROMPT:
  "Sos redactor de e-commerce...
   Atributos: [nombre, categoría, precio, labels]
   Tono: [elegante/casual/técnico]
   Escribe 2-3 frases..."
    ↓
Bedrock.converse(
  modelId: claude-haiku-4-5,
  messages: [{text: prompt}],
  inferenceConfig: {
    maxTokens: 300,
    temperature: 0.7
  }
)
    ↓
Generar descripción
    ↓
¿save=true?
├─ SÍ: UPDATE DynamoDB
│      aiDescription = texto
│      aiDescriptionModel = "claude-haiku"
└─ NO: Solo devolver
    ↓
Response: {
  "description": "La comodidad...",
  "model": "claude-haiku-4-5",
  "usage": {inputTokens, outputTokens}
}
```

**Parámetros de tono:**
```
- "elegante y cercano" (default)
- "técnico y detallado"
- "casual y amigable"
- "premium y sofisticado"
```

**Integración S06 ↔ S08:**
```
Usuario pregunta en chat:
  "Dame descripción de la sudadera"
    ↓
S08 detecta intención
    └─→ Patterns: [
          r"dame\s+(?:una\s+)?descripción",
          r"cuéntame\s+sobre",
          r"describe"
        ]
    ↓
S08 llama S06 /describe
    ├─ Obtiene descripción generada
    └─ Inyecta en contexto RAG
    ↓
Claude genera respuesta mejorada
    └─ Incluye descripción + recomendaciones
```

---

### S07 - Semantic Search + Embeddings
**Ubicación:** `/sessions/S07-bedrock-rag-busqueda/`  
**Tecnología:** Python 3.12 + Bedrock Titan Embeddings

**Función:**
Generar embeddings y búsqueda semántica RAG

**Flujo:**

#### 7A - Index Embeddings (Batch)
```
POST /search/index

Para CADA producto:
  ├─ name + description + category
  ├─ Titan Embedding API
  │  └─ Embedding dimension: 1024
  ├─ Vector result: [0.123, -0.456, ...]
  └─ Guardar en DynamoDB: embedding field

Resultado: 9/9 productos con embeddings ✅
```

#### 7B - Search (Query)
```
POST /search
Body: { "query": "quiero algo para el frío" }
    ↓
Embeddings.query = Titan(query)
    └─ Vector: [0.234, -0.321, ...]
    ↓
Cosine Similarity vs todos los productos
    ├─ Sudadera: 0.92 ✓
    ├─ Chaqueta: 0.89 ✓
    └─ Bolso: 0.45
    ↓
Top-K=3 más similares
    ↓
Response: [top 3 productos + scores]
```

**Integración S07 ↔ S08:**
```
S08 recibe pregunta
    ↓
Llama S07 /search
    ├─ Query: mensaje del usuario
    ├─ K: 3 productos
    └─ Recibe Top-3 relevantes
    ↓
Formatea contexto RAG
    ↓
Envía a Claude
```

---

### S08 - Shopping Assistant ⭐ PUNTO FUERTE
**Ubicación:** `/sessions/S08-bedrock-chatbot/`  
**Tecnología:** Python 3.12 + Bedrock (Claude Haiku) + Multi-servicio

**Función:**
Asistente de compras conversacional que integra 6 servicios

**Arquitectura S08:**
```
┌─────────────────────────────────────────┐
│      S08 Shopping Assistant             │
├─────────────────────────────────────────┤
│                                         │
│  1. Parse Request                       │
│     ├─ Message (string)                │
│     ├─ Image (optional base64)         │
│     └─ Conversation History            │
│                                         │
│  2. Detect Intent (S06 Integration)    │
│     ├─ Pattern matching                │
│     ├─ ¿Pide descripción?              │
│     └─ SI → Llama S06.describe()       │
│                                         │
│  3. Process Image (S01+S02)            │
│     ├─ SI hay imagen:                  │
│     ├─ S01: Detectar labels            │
│     ├─ S02: Validar contenido          │
│     └─ Auto-búsqueda por visual        │
│                                         │
│  4. Retrieve Context (S07)             │
│     ├─ Embeddings search               │
│     ├─ Top-K=3 productos               │
│     └─ Format CATÁLOGO_RELEVANTE       │
│                                         │
│  5. Generate Response (Claude)         │
│     ├─ System prompt                   │
│     ├─ Context (productos)             │
│     ├─ History (conversación)          │
│     └─ Generar respuesta               │
│                                         │
│  6. Optional: S05 Audio (Polly)       │
│     └─ Síntesis de voz                 │
│                                         │
│  7. Return Response                    │
│     ├─ reply (string)                  │
│     ├─ retrieved (products)            │
│     ├─ generated_description (opt)     │
│     └─ usage (tokens)                  │
│                                         │
└─────────────────────────────────────────┘
```

**Patrones de Intención Detectados:**
```python
DESCRIPTION_PATTERNS = [
    r"dame\s+(?:una\s+)?descripción",
    r"cuentam[e]?\s+(?:más\s+)?sobre",
    r"cuéntam[e]?\s+(?:más\s+)?sobre",
    r"describe[a-z]*\s+",
    r"(?:qué\s+)?describe",
    r"información\s+de",
    r"detalles?\s+de",
]
```

**Ejemplos de Uso S08:**

| Input | Output |
|-------|--------|
| "¿Tienes algo cómodo para el frío?" | Top-3: Sudadera, Chaqueta, Bata |
| "Dame descripción de la sudadera" | Genera con S06 + contexto RAG |
| "[Imagen de tenis]" | Detecta labels S01 + busca similares |
| "¿Qué es lo más barato?" | RAG retrieval por precio |
| "Necesito outfit para la playa" | Combina múltiples productos |

---

## 🐛 Troubleshooting Completo con Soluciones

### 1. Error: "502 Bad Gateway"
**Síntomas:** Lambda devuelve error 502  
**Causa:** Función crasheando silenciosamente

**Solución:**
```bash
# 1. Ver logs
aws logs tail /aws/lambda/techmoda-ai-jorge-damian-diaz-v2-ShoppingAssistant \
  --since 5m --follow

# 2. Errores comunes:
# - Módulo no importado
# - Variable de entorno faltante
# - Timeout (aumentar en template.yaml)
# - Permiso IAM faltante

# 3. Verificar permisos
aws iam get-role-policy \
  --role-name techmoda-ai-jorge-damian-diaz-v2-ShoppingAssistant-Role \
  --policy-name ...
```

### 2. Error: "CORS 403 Forbidden"
**Síntomas:** Frontend error `Access-Control-Allow-Origin` missing  
**Causa:** Lambda no devuelve headers CORS

**Solución:**
```python
# Verificar en _response():
def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",  # ← MUST EXIST
        },
        "body": json.dumps(body)
    }

# Rebuild y redeploy
sam build -t template.sandbox.yaml
sam deploy ...
```

### 3. Error: "Imagen no carga"
**Síntomas:** Producto sin foto visible  
**Causa:** URL con espacios codificados (%20)

**Solución:**
```bash
# Problema: URL = ".../Chaqueta%20Oversize.jpg"
# Solución: Renombrar sin espacios

aws s3 mv "s3://bucket/assets/Chaqueta%20Oversize.jpg" \
        "s3://bucket/assets/chaqueta-oversize.jpg"

# Actualizar producto
curl -X PUT "API/products/2" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "http://s3-website.../assets/chaqueta-oversize.jpg", ...}'
```

### 4. Error: "AccessDenied" en Bedrock
**Síntomas:** S06/S08 retorna error 502  
**Causa:** Modelo no habilitado en AWS Bedrock

**Solución:**
```bash
# 1. Ir a AWS Console
# Service: Bedrock > Model Access

# 2. Buscar: "Claude 3.5 Haiku"

# 3. Click "Enable" (tarda 2-3 min)

# 4. Verificar acceso
aws bedrock list-foundation-models --region us-east-1 | grep haiku
```

### 5. Error: "DynamoDB Item no actualiza"
**Síntomas:** S06 genera descripción pero no se guarda  
**Causa:** Permiso DynamoDB insuficiente

**Solución:**
```bash
# Verificar policy tiene:
# - dynamodb:UpdateItem
# - dynamodb:GetItem

aws iam get-role-policy \
  --role-name techmoda-ai-*-GenerateDescription-Role \
  --policy-name ...

# Si falta, redeploy template
sam deploy --capabilities CAPABILITY_IAM
```

### 6. Error: "Embedding dimension mismatch"
**Síntomas:** S07 search falla  
**Causa:** Embeddings antiguos vs nuevo modelo

**Solución:**
```bash
# Regenerar embeddings completos
curl -X POST "S7_URL/search/index" \
  -H "Content-Type: application/json" \
  -d '{}'

# Esperar ~30 segundos
# Verificar resultado
curl "S7_URL/search?query=prueba"
```

### 7. Error: "Timeout en generación de descripción"
**Síntomas:** S06 tarda >30 segundos  
**Causa:** Timeout Lambda (por defecto 30s)

**Solución:**
```yaml
# template.sandbox.yaml
GenerateDescriptionFunction:
  Properties:
    Timeout: 60  # ← Aumentar a 60s
```

### 8. Error: "Chat no responde"
**Síntomas:** S08 devuelve respuesta vacía  
**Causa:** Retrievals vacíos o prompt inválido

**Solución:**
```bash
# 1. Verificar embeddings existen
curl "S7_URL/search?query=test"

# 2. Verificar productos en DB
curl "S00_URL/products"

# 3. Ver logs S08
aws logs tail /aws/lambda/techmoda-*ShoppingAssistant \
  --since 5m

# 4. Si logs muestran error en Claude:
# Problema en prompt construction o modelo unavailable
```

---

## 📊 Flujo Completo: Ejemplo Usuario Final

```
=== ESCENARIO: Usuario pregunta por frio ===

1. Usuario en Chat (Frontend):
   Escribe: "Hola, necesito algo cómodo para el frío"
   
2. Frontend envía a S08:
   POST https://S8_URL/assistant
   {
     "message": "Hola, necesito algo cómodo para el frío",
     "conversationHistory": [],
     "image": null
   }

3. S08 Procesa:
   a) Detecta intención: NO es descripción request
   b) NO hay imagen
   c) Llama S07 SEARCH:
      - Query embedding → Vector
      - Busca TOP-3: [Sudadera 0.92, Chaqueta 0.89, Bata 0.85]
   
   d) Formatea contexto:
      CATÁLOGO: "- Sudadera negra... - Chaqueta... - Bata..."
   
   e) Construye messages:
      System: "Eres asistente de TechModa..."
      History: [] (vacío)
      User: "CATÁLOGO:...\n\nPREGUNTA: Hola, necesito..."
   
   f) Llama Bedrock.converse():
      Model: claude-haiku-4-5
      Temperature: 0.5
      MaxTokens: 400

4. Claude Genera Respuesta:
   "¡Hola! Perfecto, te tengo 3 opciones para el frío:
    
    1. **Sudadera negra** - $69.99
    2. **Chaqueta mezclilla** - $149.99
    3. **Bata baño** - $59.99
    
    ¿Cuál te llama más la atención?"

5. S08 Retorna:
   {
     "reply": "¡Hola! Perfecto, te tengo...",
     "retrieved": [
       {productId: "9", name: "Sudadera negra"},
       {productId: "2", name: "Chaqueta mezclilla"},
       {productId: "6", name: "Bata baño negra"}
     ],
     "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
     "usage": {
       "inputTokens": 384,
       "outputTokens": 227
     }
   }

6. Frontend Muestra:
   ✓ Respuesta en chat
   ✓ Productos recomendados
   ✓ Opción audio (Polly)
   ✓ Opción imagen

=== FIN FLUJO ===

SERVICIOS UTILIZADOS: S07 + S08
TIEMPO: ~2 segundos
TOKENS: 611 (384 in + 227 out)
COSTO: ~$0.0004 (Haiku pricing)
```

---

## 💰 Costos Operacionales

| Operación | Servicios | Costo |
|-----------|-----------|-------|
| Chat básico | S07 + S08 | $0.0004 |
| Con descripción | +S06 | +$0.0003 |
| Con imagen | +S01 + S02 | +$0.0050 |
| Con audio | +S05 | +$0.0010 |
| Full stack | S01-S08 | ~$0.0067 |

**Mensual (1000 usuarios, 10 chats c/u):**
- 10,000 chats básicos = $4
- 2,000 con descripción = $0.60
- 1,000 con imagen = $5
- **Total:** ~$10/mes (con Free Tier)

---

## ✅ Validación del Sistema

**50 Tests RAGAS Ejecutados:**
```
✓ product_search (5/5)      - Búsqueda de productos
✓ recommendation (5/5)      - Recomendaciones
✓ product_details (5/5)     - Detalles de artículos
✓ inventory (5/5)           - Stock disponible
✓ catalog_info (5/5)        - Info catálogo
✓ search_capability (5/5)   - Búsqueda semántica
✓ conversational (5/5)      - Conversación natural
✓ hallucination_trap (5/5)  - No inventa productos
✓ out_of_scope (5/5)        - Rechaza fuera de scope
✓ adversarial (5/5)         - Seguridad ante ataques

Total: 50/50 (100%) ✅
```

---

**Última actualización:** 2026-09-24  
**Versión:** 2.0 Completa  
**Estado:** ✅ Producción Certificada

---

## 🔧 Servicios Implementados

### S00 - CRUD Router
**Ruta:** `POST /products`, `GET /products/{id}`  
**Tech:** Node.js 22 + DynamoDB  
**Fix:** Eliminada dependencia aws-sdk innecesaria

### S01 - Rekognition Labels
**Ruta:** `POST /enrich-labels`  
**Tech:** Python 3.12 + Rekognition  
**Función:** Auto-etiquetado con confianza ≥80%

### S02 - Moderation + Alt-Text
**Ruta:** `POST /moderate-image`  
**Tech:** Python 3.12 + Rekognition  
**Función:** Detección contenido + alt-text accesible

### S03 - Sentiment Analysis
**Ruta:** `POST /analyze-sentiment`  
**Tech:** Python 3.12 + Comprehend  
**Fix:** Agregado DetectDominantLanguage + post-processing

### S04 - Translate
**Ruta:** `POST /products/{id}/translate`  
**Tech:** Python 3.12 + Amazon Translate  
**Función:** ES ↔ EN con guardado en DB

### S05 - Polly Voice
**Ruta:** `POST /synthesize-voice`  
**Tech:** Python 3.12 + Polly  
**Función:** Síntesis de voz con URL presignada

### S06 - Generate Description ⭐ NUEVO
**Ruta:** `POST /products/{id}/describe`  
**Tech:** Python 3.12 + Bedrock (Claude Haiku)  
**Función:** Generación IA de descripciones de productos  
**Parámetros:** `tone` (estilo), `save` (persistir)  
**Integración:** Detecta intención en S08 y genera automáticamente

### S07 - Semantic Search
**Rutas:** `POST /search/index`, `POST /search`  
**Tech:** Python 3.12 + Titan Embeddings  
**Función:** Indexar + búsqueda semántica por descripción

### S08 - Shopping Assistant ⭐ MEJORADO
**Ruta:** `POST /assistant`  
**Tech:** Python 3.12 + Claude Haiku + Rekognition  
**Mejoras:**
- ✅ Integración S06: Genera descripciones automáticamente
- ✅ Detección de intención: "dame descripción", "cuéntame sobre"
- ✅ RAG + Embeddings S07 para búsqueda semántica

---

## 📦 Catálogo de Productos (9 items)

| ID | Nombre | Precio | Stock | Categoría |
|----|--------|--------|-------|-----------|
| 1 | Tenis rojos minimalistas | $89.99 | 5 | Zapatos |
| 2 | Chaqueta mezclilla oversize | $149.99 | 8 | Ropa |
| 3 | Bolso tote lona | $89.99 | 12 | Accesorios |
| 4 | Vestido midi floral | $79.99 | 15 | Ropa |
| 5 | Tenis negros minimalistas | $99.99 | 10 | Zapatos |
| 6 | Bata baño negra | $59.99 | 6 | Ropa |
| 7 | Tenis blancos minimalistas | $79.99 | 14 | Zapatos |
| 8 | Dije colección | $44.99 | 9 | Accesorios |
| 9 | Sudadera negra | $69.99 | 11 | Ropa |

**Todas con:** Imágenes ✅, Embeddings ✅, Etiquetas IA ✅

---

## 🚀 Despliegue

### Primer Deploy
```bash
cd /workshop/techmoda-ai-capstone
bash scripts/validate-all.sh --static
bash scripts/deploy.sh
bash scripts/build-frontend.sh
bash scripts/deploy-frontend.sh
bash scripts/status.sh
```

### Deploy Rápido (Sin Frontend)
```bash
bash scripts/bootstrap.sh
```

### Verificar
```bash
# Estado
bash scripts/status.sh

# Listar productos
curl -s "$(aws cloudformation describe-stacks \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)/products" | python3 -m json.tool
```

---

## 🧪 Testing RAGAS

### Ejecutar Tests
```bash
cd /workshop/techmoda-ai-capstone

# Mini-test (5 preguntas)
bash ragas_simple_test.sh ragas_test_5_mini.json "https://u26snshd5eyctiioychrbubs4q0pyikh.lambda-url.us-east-1.on.aws/"

# Full test (50 preguntas)
bash ragas_simple_test.sh ragas_test_50.json "https://u26snshd5eyctiioychrbubs4q0pyikh.lambda-url.us-east-1.on.aws/"
```

### Resultados
- **Archivo:** `ragas_results_1790236091.json`
- **Status:** ✅ 50/50 tests pasados (100%)
- **Categorías:** product_search, recommendation, inventory, conversational, adversarial, etc.

### Dashboard Streamlit (Externo)
```bash
pip install streamlit pandas plotly
# Crear app que carga JSON y visualiza métricas
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| **502 Lambda Error** | `aws logs tail /aws/lambda/...` |
| **CORS 403** | Verificar header `Access-Control-Allow-Origin: *` |
| **Imágenes no cargan** | URLs sin %20, usar http (no https) |
| **Bedrock AccessDenied** | Habilitar modelo en AWS Console → Bedrock |
| **DynamoDB vacio** | `bash scripts/bootstrap.sh` para reseed |

---

## 💰 Costos Mensuales (Estimado)

- Lambda: $0.20
- DynamoDB: $1.25
- Bedrock: $0.80
- Rekognition: $0.50
- Comprehend: $0.50
- Translate: $0.15
- Polly: $0.50
- S3: $0.07
- CloudFront: $0.85
- **TOTAL: ~$4.82/mes** (con Free Tier AWS)

---

## 📁 Estructura Archivos

```
techmoda-ai-capstone/
├── template.sandbox.yaml
├── functions/ (S00: Router CRUD)
├── sessions/
│   ├── S01-rekognition-labels/
│   ├── S02-moderation-alttext/
│   ├── S03-comprehend-sentiment/
│   ├── S04-translate-multilang/
│   ├── S05-polly-voice/
│   ├── S06-bedrock-descripciones/ ⭐ NUEVO
│   ├── S07-bedrock-rag-busqueda/
│   └── S08-bedrock-chatbot/ ⭐ MEJORADO
├── frontend/
├── ragas_simple_test.sh
├── ragas_test_50.json
├── ragas_results_1790236091.json
└── scripts/
```

---

## 🎯 Cambios Esta Sesión

✅ Agregados 4 productos nuevos (total 9)  
✅ Implementado S06 (Bedrock Description Generator)  
✅ Integrado S06 con S08 (detección intención)  
✅ Resuelto problema de imágenes (espacios en nombres)  
✅ Generados 50 tests RAGAS (100% éxito)  
✅ Mejorada integración S07 (embeddings)  

---

**Última actualización:** 2026-09-24  
**Status:** ✅ Completamente Funcional  
**Ready for Production:** ✅ SÍ
