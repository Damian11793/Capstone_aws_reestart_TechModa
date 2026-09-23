# S06 · Generar descripciones de producto desde atributos (Amazon Bedrock) — Guía Detallada

**Nivel:** Intermedio · **Tiempo de lectura:** ~20 min · **Importancia:** 🔥 **52% del examen (D2 + D3)**

---

## ¿Qué es S06 y por qué es crítica?

Hasta ahora TechModa **analiza y traduce** contenido existente. S06 es el **primer salto a generación:** convertir atributos simples (nombre, categoría, precio, etiquetas visuales) en descripciones de marketing coherentes y persuasivas.

**Impacto real:**
- 📝 Catálogo de 1000 productos con descripciones únicas en **segundos**, sin copywriter
- 🎯 Diferentes tonos para diferentes mercados (premium, casual, minimalista)
- 💰 Ahorro masivo de contenido manual
- ⚠️ **Primer encuentro con "alucinación"** — el modelo puede inventar datos

**Por qué importa para el examen:**
- **D2 (Generative AI Fundamentals):** Foundation models, prompt engineering, tokens
- **D3 (Generative AI Applications):** Casos de uso reales, limitaciones, mitigación

---

## 🏗️ Arquitectura: Foundation Models en Bedrock

```
┌──────────────────────────────────────────────────────────────┐
│           TechModa Frontend / Backend                        │
│  "Dame descripción premium para este producto"              │
└──────────────────────────────────────────────────────────────┘
                            │ POST
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  GenerateDescriptionFunction (Lambda Python)                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. Lee producto de DynamoDB (name, category, price)    │ │
│  │ 2. Lee etiquetas visuales de S1 (aiLabels)             │ │
│  │ 3. Arma PROMPT:                                         │ │
│  │    "Eres redactor de moda. Escribí descripción         │ │
│  │     elegante y aspiracional para:                       │ │
│  │     Nombre: Vestido midi floral                         │ │
│  │     Categoría: Vestidos                                 │ │
│  │     Precio: $89                                         │ │
│  │     Etiquetas: ['floral', 'midi', 'gasa']              │ │
│  │     Restricciones: 2-3 frases, sin emojis,            │ │
│  │     sin inventar materiales."                           │ │
│  │ 4. Llama a Bedrock.converse() con ese prompt           │ │
│  │ 5. Recibe: descripción generada + token usage          │ │
│  │ 6. Opcionalmente guarda en DynamoDB                    │ │
│  │ 7. Retorna { description, usage, model }              │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │
         ├──→ DynamoDB (lee) → ProductsTable
         │
         └──→ Bedrock (invoca) → Claude Haiku 4.5
              - Converse API (agnóstica a modelo)
              - Engine: neural
              - Temperature: 0.7 (creativo)
              - MaxTokens: 300
```

---

## 🧠 Conceptos clave: Foundation Models e IA Generativa

### 1. **Foundation Model (FM)**

Un **foundation model** es un modelo de IA **grande, preentrenado** con terabytes de texto, capaz de:
- Entender instrucciones (prompts)
- Generar texto coherente
- Ejecutar múltiples tareas sin reentrenamiento (zero-shot learning)

Ejemplos:
- **Claude Haiku 4.5** (Anthropic) — pequeño, rápido, barato ✅ *Lo usamos en S06*
- Claude Opus 5 (Anthropic) — grande, más inteligente, más caro
- Llama 3.1 (Meta) — open source, flexible
- Mistral (Mistral AI) — especializado en Europa

### 2. **Amazon Bedrock: acceso unificado a FMs**

```
┌─────────────────────────────────────────────────────────┐
│  Tu código Python: bedrock_client.converse(...)         │
├─────────────────────────────────────────────────────────┤
│         Amazon Bedrock (API unificada)                  │
├─────────────────────────────────────────────────────────┤
│  │  │  │  │                                             │
│  ↓  ↓  ↓  ↓                                             │
│ Claude Llama Mistral Titans (AWS)                       │
│  ...y más                                               │
└─────────────────────────────────────────────────────────┘
```

**Ventaja:** cambias de modelo cambiando `BEDROCK_MODEL_ID` — **sin tocar código.** Eso es crucial.

### 3. **Prompt Engineering: el arte de pedir bien**

Un prompt tiene 4 componentes:

| Componente | Ejemplo | Por qué importa |
|---|---|---|
| **Rol** | "Eres redactor de moda de lujo" | Define el contexto y tono |
| **Tarea** | "Escribe descripción de producto" | Específico, no vago |
| **Restricciones** | "2-3 frases, sin emojis, sin inventar" | Reduce alucinación |
| **Contexto** | "Categoría: vestidos, Precio: $89" | Ancla al mundo real |

**Mal prompt:**
```
"Describe este producto"
```
→ Vago, el modelo genera lo que quiera. Alto riesgo de alucinación.

**Buen prompt (lo que usa S06):**
```
Eres redactor de moda profesional. Basándote SOLO en estos atributos reales:
- Nombre: Vestido midi floral
- Categoría: Vestidos
- Precio: $89
- Etiquetas visuales: floral, midi, gasa

Escribe una descripción persuasiva de 2-3 frases. Restricciones:
- NO inventes materiales ni tallas
- Sin emojis
- Tono: elegante y aspiracional
- Sé honesto: si no tienes información, no la improvises
```

→ Preciso, anclado, con guardrails. Bajo riesgo de alucinación.

### 4. **Tokens: la unidad de costo**

Un **token** es ~4 caracteres (más o menos):

```
"Vestido midi floral" = ~5 tokens
"Este es un vestido midi de gasa floral con..." = ~15 tokens
```

**Bedrock cobra por token:**
- Input tokens (lo que envías): más baratos
- Output tokens (lo que genera): más caros

Ejemplo (Claude Haiku 4.5):
- Input: ~$0.000080 / 1k tokens
- Output: ~$0.00024 / 1k tokens

**Cálculo de S06:**
- Prompt: ~150 tokens de entrada
- Descripción: ~50 tokens de salida
- Costo por generación: ~$0.000025 (0.0025 centavos)
- 1000 productos: ~$0.025 (25 centavos) 🤑

### 5. **Temperatura: control de aleatoriedad**

```
Temperature = 0.0   (determinista)
  → "Descripción exacta"
  → Siempre lo mismo
  → Uso: resúmenes, datos exactos

Temperature = 0.7   (creativo pero coherente)
  → "Descripción variada pero sensata"
  → Diferente cada vez, pero siempre sensata
  → Uso: marketing, redacción

Temperature = 1.0+  (muy creativo/aleatorio)
  → "Descripción puede ser extraña"
  → Alto riesgo de no tener sentido
  → Uso: brainstorming, creatividad pura
```

**S06 usa 0.7:** queremos variedad (diferentes tonos), pero siempre coherente.

### 6. **Alucinación: el fantasma de GenAI**

Un FM **alucinará** si:
- El prompt es vago ("Describe esto" ← ¿qué?)
- No está anclado a datos reales
- Se le pide predecir algo fuera de su entrenamiento

**Ejemplos de alucinación:**
```
Entrada: "Vestido midi floral, $89"
Salida (alucinada): "100% seda italiana importada, confeccionado en Milán..."
                    ↑ Inventó todo. No tenía esa info.
```

**Cómo mitigar (lo que hace S06):**
1. ✅ Anclar el prompt a atributos REALES (nombre, categoría, etiquetas de S1)
2. ✅ Restricciones explícitas: "NO inventes materiales"
3. ✅ Rol específico: "Redactor profesional" (implica responsabilidad)
4. ✅ Guardrails downstream (S09 valida salida con más guardrails)

### 7. **Converse API: agnóstica al modelo**

En vez de API específica por proveedor:

```python
# ❌ Viejo (específico)
claude_response = bedrock_client.invoke_model(
    modelId="anthropic.claude-3-haiku-20240307-v1:0",
    body=json.dumps({...})
)

# ✅ Nuevo (agnóstico, S06)
response = bedrock_client.converse(
    modelId=BEDROCK_MODEL_ID,  # variable
    messages=[...],
    system=[...],
    inferenceConfig={...}
)
```

**Ventaja:** cambias modelo sin cambiar código. Es el futuro.

### 8. **Bedrock vs. SageMaker vs. Bedrock Agents**

| Servicio | ¿Qué haces? | Cuándo |
|---|---|---|
| **Bedrock** | Invocar FMs administrados | Usar LLMs existentes (S06) |
| **SageMaker** | Entrenar/afinar modelos propios | Datos especializados, control total |
| **Bedrock Agents** | Workflows multi-paso (LLM + tools) | Tareas complejas (S10+) |

**S06 = Bedrock.** Solo invocamos, no entrenamos.

---

## 🔄 Flujo de código paso a paso

**Archivo:** `sessions/S06-bedrock-descripciones/functions/generate-description/app.py`

### Paso 1: Recibir request
```python
def lambda_handler(event, context):
    product_id = extract_id_from_path(event['rawPath'])
    body = json.loads(event['body'] or '{}')
    tone = body.get('tone', 'profesional')
    save = body.get('save', False)
```

### Paso 2: Leer producto de DynamoDB
```python
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(PRODUCTS_TABLE)

response = table.get_item(Key={'productId': product_id})
product = response.get('Item', {})

name = product.get('name', '')
category = product.get('category', '')
price = product.get('price', '')
ai_labels = product.get('aiLabels', [])  # de S1
```

### Paso 3: Armar el prompt (prompt engineering)
```python
system_prompt = """Eres redactor de moda profesional y honesto.
Tu trabajo es escribir descripciones persuasivas de productos.
RESTRICCIONES CRÍTICAS:
- Basate SOLO en los atributos reales que se te dan
- NO inventes materiales, tallas, procedencias ni características no mencionadas
- Sé honesto: si la información es insuficiente, déjalo claro
- Escribe 2-3 frases coherentes
- Sin emojis
- Tono: como se te especifique en el user message
"""

user_message = f"""
Generá descripción para este producto:
- Nombre: {name}
- Categoría: {category}
- Precio: ${price}
- Etiquetas visuales detectadas: {', '.join(ai_labels)}
- Tono solicitado: {tone}

Recorda: NO inventes datos. Si algo no está claro, omitilo.
"""
```

### Paso 4: Invocar Bedrock con Converse API
```python
bedrock = boto3.client('bedrock-runtime')

response = bedrock.converse(
    modelId=BEDROCK_MODEL_ID,  # "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    messages=[
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': user_message}
            ]
        }
    ],
    system=[
        {'type': 'text', 'text': system_prompt}
    ],
    inferenceConfig={
        'maxTokens': int(BEDROCK_MAX_TOKENS),  # 300
        'temperature': float(BEDROCK_TEMPERATURE)  # 0.7
    }
)
```

### Paso 5: Extraer respuesta y uso de tokens
```python
description = response['output']['message']['content'][0]['text']

usage = response['usage']
input_tokens = usage['inputTokens']
output_tokens = usage['outputTokens']
total_tokens = input_tokens + output_tokens

# Ojo: el costo real incluye ambos, a diferentes precios
# Bedrock retorna esto para que vos puedas calcular costo
```

### Paso 6: Opcionalmente guardar en DynamoDB
```python
if save:
    table.update_item(
        Key={'productId': product_id},
        UpdateExpression='SET aiDescription = :desc',
        ExpressionAttributeValues={
            ':desc': description
        }
    )
```

### Paso 7: Retornar respuesta
```python
return _response(200, {
    'productId': product_id,
    'model': BEDROCK_MODEL_ID,
    'tone': tone,
    'saved': save,
    'description': description,
    'usage': {
        'inputTokens': input_tokens,
        'outputTokens': output_tokens,
        'totalTokens': total_tokens
    }
})
```

---

## 🌍 Ejemplo real: mismo producto, diferentes tonos

**Producto en DynamoDB:**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "name": "Vestido midi floral",
  "category": "Vestidos",
  "price": 89,
  "aiLabels": ["floral", "midi", "gasa", "moda"]
}
```

**Curl S06 (tono: elegante y aspiracional):**
```bash
URL=$(aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='GenerateDescriptionUrl'].OutputValue" --output text)
curl -s -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/describe" \
  -H "Content-Type: application/json" \
  -d '{"tone":"elegante y aspiracional","save":true}' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  "tone": "elegante y aspiracional",
  "saved": true,
  "description": "Vestido midi con estampado floral que une sofisticación y delicadeza. La tela de gasa crea un movimiento elegante ideal para ocasiones especiales. Un diseño versátil que complementa tanto looks casuales como formales.",
  "usage": {
    "inputTokens": 156,
    "outputTokens": 52,
    "totalTokens": 208
  }
}
```

**Curl S06 (tono: divertido y juvenil):**
```bash
curl -s -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/describe" \
  -H "Content-Type: application/json" \
  -d '{"tone":"divertido y juvenil","save":false}' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "description": "¡Floral y hermoso! Este vestido midi te hace sentir cómoda y radiante. Perfecto para salidas, fiestas o simplemente para verte increíble. La tela ligera es ideal para días de calor.",
  "usage": {
    "inputTokens": 156,
    "outputTokens": 48,
    "totalTokens": 204
  }
}
```

**Curl S06 (tono: minimalista):**
```bash
curl -s -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/describe" \
  -H "Content-Type: application/json" \
  -d '{"tone":"minimalista","save":false}' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "description": "Vestido midi con patrón floral. Tela ligera. Diseño versátil.",
  "usage": {
    "inputTokens": 156,
    "outputTokens": 18,
    "totalTokens": 174
  }
}
```

**Observación:** mismo producto, 3 descripciones diferentes, costo variable (tokens de salida).

---

## 📚 Conceptos D2 (examen) — Foundation Models

✅ **Foundation models** = modelos grandes preentrenados, capaces de múltiples tareas  
✅ **Amazon Bedrock** = servicio administrado para invocar FMs de varios proveedores  
✅ **Prompt engineering** = el arte de escribir instrucciones efectivas  
✅ **Tokens** = unidad de costo; prompt + salida se cobran por separado  
✅ **Temperatura** = controla aleatoriedad (0.0 = determinista, 1.0+ = aleatorio)  
✅ **Alucinación** = inventar datos plausibles pero falsos; se mitiga anclando a contexto real  
✅ **Zero-shot** = pedir sin ejemplos ("describe esto")  
✅ **Few-shot** = pedir CON ejemplos (S07 lo toca)  
✅ **Bedrock vs SageMaker** = consumir FMs vs entrenar modelos propios  
✅ **Converse API** = agnóstica al modelo, cambias parámetro vs cambiar código

---

## 📚 Conceptos D3 (examen) — Aplicaciones Generativas

✅ **Casos de uso:** generación de texto, imágenes, resumen, extracción, chat  
✅ **RAG (Retrieval-Augmented Generation):** combinar LLM con búsqueda para mejor contexto (S07)  
✅ **Guardrails:** restricciones para evitar alucinación (S09)  
✅ **Agents:** LLM que decide qué herramientas usar (S10)  
✅ **Cost optimization:** elegir modelo chico (Haiku) cuando es suficiente  

---

## 🔐 IAM: mínimo privilegio + ARN de recurso

A diferencia de Rekognition/Comprehend, **Bedrock SÍ soporta ARN de recurso:**

```yaml
Policies:
  - Statement:
      Action: bedrock:InvokeModel
      Resource:
        - arn:aws:bedrock:*::foundation-model/*
        - arn:aws:bedrock:*:ACCOUNT:inference-profile/*
```

**¿Por qué dos ARNs?**
- `foundation-model/*` = acceso a modelos base
- `inference-profile/*` = acceso a perfiles de inferencia (cross-region, optimizados)

**¿Por qué region wildcard `*` en vez de `us-east-1`?**
Los inference profiles de Anthropic pueden ejecutarse cross-region dentro de EE.UU. Por seguridad, Bedrock permite `us-*` en el ARN real, pero usamos `*` como shorthand (AWS lo valida).

---

## ❓ FAQ

### P1: ¿Qué pasa si el modelo alucina?
R: El prompt de S06 mitiga con restricciones y rol. Pero aún es posible. Para casos críticos (S09) usamos Guardrails de Bedrock para detectar/bloquear output problemático.

### P2: ¿Se puede cambiar a otro modelo?
R: Sí, cambias `BEDROCK_MODEL_ID` en template.yaml. Bedrock.converse es agnóstica. Pero si cambias a un modelo que exija diferente configuración, necesitás ajustar el código (ej: parámetros específicos del modelo).

### P3: ¿Bedrock factura aunque no haya invocaciones?
R: **No.** Solo cobras lo que invocas. Sin invocaciones = $0. (A diferencia de SageMaker endpoints, que cobran por estar desplegados.)

### P4: ¿Qué pasa si el prompt es muy grande?
R: Los tokens de entrada escalan. Si tienes 10,000 caracteres de contexto, eso es ~2,500 tokens de entrada, costo más alto. Usa `maxTokens` para limitar salida.

### P5: ¿La salida es determinista si temperature = 0.0?
R: Sí, mucho. Mismo prompt, misma temperatura 0 = prácticamente misma salida (hay mínima variación por razones técnicas, pero negligible).

### P6: ¿Se puede usar Bedrock sin hackear Bedrock Model access?
R: No, es un prereq. Si no habilitas el modelo, Bedrock rechaza la invocación con `AccessDeniedException`. Es una medida de AWS para control de costos.

### P7: ¿Qué es inference-profile?
R: Un perfil que define qué modelo ejecutar y dónde. `us.anthropic.claude-haiku-4-5-20251001-v1:0` es un inference profile que dice "ejecutá Haiku en cualquier región EE.UU."

### P8: ¿Cuál es la diferencia entre estos IDs?
```
anthropic.claude-haiku-4-5-20251001-v1:0           ← foundation-model (base)
us.anthropic.claude-haiku-4-5-20251001-v1:0        ← inference-profile (con región)
```
S06 usa el inference-profile porque es más flexible (ejecuta donde sea más rápido/barato).

---

## ✅ Checklist de validación

- [ ] Deploy exitoso sin errores
- [ ] Output `GenerateDescriptionUrl` en CloudFormation
- [ ] Curl POST con `{"tone":"elegante y aspiracional","save":true}` retorna JSON válido
- [ ] La descripción generada es coherente con atributos del producto
- [ ] Diferentes tonos ("divertido", "minimalista", "premium") producen diferentes salidas
- [ ] El campo `usage` muestra conteo de tokens (entrada + salida)
- [ ] Cambiar `temperature` en template.yaml (ej: 0.0) produce outputs más deterministas
- [ ] Si `save:true`, el campo `aiDescription` se guarda en DynamoDB
- [ ] Si quitas Bedrock Model access, la llamada falla con error claro (probalo para entender control)

---

## 🧹 Cleanup (si necesitas borrar S06)

```bash
# Quitar de template.yaml:
# - GenerateDescriptionFunction

sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --no-confirm-changeset
```

---

## 🎓 Resumen: qué entrará en el examen

**D2 — Fundamentals of Generative AI (24%):**
- ✅ Foundation models y su capacidad
- ✅ Amazon Bedrock como servicio administrado
- ✅ Prompt engineering: rol, restricciones, contexto
- ✅ Tokens y su relación con costo
- ✅ Temperatura y su efecto en output
- ✅ Alucinación: definición y mitigación
- ✅ Zero-shot vs few-shot learning
- ✅ Bedrock vs SageMaker vs Bedrock Agents
- ✅ Converse API agnóstica

**D3 — Generative AI Applications (28%):**
- ✅ Casos de uso de LLM (texto, resumen, extracción)
- ✅ RAG (Retrieval-Augmented Generation)
- ✅ Agents y workflows multi-paso
- ✅ Guardrails y safety
- ✅ Cost optimization

---

**Siguiente:** S07 · Bedrock + Retrieval (RAG para contexto mejorado)
