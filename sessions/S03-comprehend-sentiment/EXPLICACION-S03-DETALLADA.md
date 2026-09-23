# S3 · Explicación Detallada — Análisis de Sentimiento con Amazon Comprehend

**Duración de lectura:** ~15 min  
**Nivel:** Principiante  
**Dominio AIF-C01:** D1 — Fundamentals of AI and ML (20%)  

---

## 🎯 ¿Qué es S03 y por qué importa?

**El problema real:** TechModa recibe miles de reseñas de clientes en su catálogo. ¿Cómo saber cuáles son positivas, cuáles negativas y cuáles tienen problemas sin leer cada comentario manualmente?

**La solución:** S03 agrega una Lambda que **entiende automáticamente el sentimiento** de cualquier texto (reseña, comentario, feedback) en cuestión de milisegundos. Clasificando cada reseña como `POSITIVE`, `NEGATIVE`, `NEUTRAL` o `MIXED`, el equipo de TechModa puede:

1. Detectar productos problemáticos rápidamente.
2. Priorizar qué comentarios revisar (ej: todos los `NEGATIVE`).
3. Calcular un sentimiento agregado del producto (ej: 80% POSITIVE, 10% NEGATIVE, 10% NEUTRAL).

**Por qué entra en el examen (D1):**
- D1 ("Fundamentals of AI and ML") trata sobre **servicios de IA preentrenados administrados por AWS**.
- Comprehend es un ejemplo de **NLP (procesamiento de lenguaje natural)** sin entrenar modelos propios.
- Entender cuándo usar Comprehend (texto), Rekognition (imagen), Polly (voz), etc., es un requisito clave del examen.

---

## 🧩 Servicios involucrados

### 1. **Amazon Comprehend** — El motor NLP

Comprehend es un servicio de **Procesamiento de Lenguaje Natural (NLP) preentrenado**. No es una caja negra: tiene dos APIs principales que encadenaremos:

- **`DetectDominantLanguage`**: recibe un texto y devuelve el idioma con confianza.
- **`DetectSentiment`**: recibe texto + idioma y devuelve sentimiento + scores.

**¿Por qué dos pasos?** Porque Comprehend necesita saber el idioma para analizar bien el sentimiento. "Hola" en español se analiza diferente que en otros idiomas. Si se equivoca de idioma, el sentimiento será incorrecto.

### 2. **AWS Lambda** — El orquestador

La Lambda de S03 es el "cerebro":
1. Recibe texto (o lista de reseñas) del cliente.
2. Llama a Comprehend (DetectDominantLanguage).
3. Llama a Comprehend (DetectSentiment) en ese idioma.
4. Guarda el resultado en DynamoDB si corresponde.

**Patrón:**
```
Cliente → Lambda Function URL → Comprehend → DynamoDB → Lambda devuelve resultado
```

### 3. **DynamoDB** — Almacén persistente

Cada producto almacena:
- `reviewSentiment` — el sentimiento agregado (ej: `POSITIVE`).
- `reviewSentimentCounts` — cuántas reseñas de cada tipo (ej: `{POSITIVE: 10, NEGATIVE: 2}`).

### 4. **IAM** — Permisos mínimos

La Lambda solo puede:
- Llamar a `comprehend:DetectSentiment` y `comprehend:DetectDominantLanguage`.
- Hacer CRUD en la tabla `ProductsTable`.
- Nada más.

---

## 🏗️ Arquitectura y flujo

```
┌─────────────┐
│   Usuario   │
│  (Frontend) │
└──────┬──────┘
       │ curl -X POST $URL/sentiment
       │ {"productId":"...", "reviews":[...]}
       ▼
┌──────────────────────────────────────┐
│  Lambda: AnalyzeSentimentFunction    │
│                                      │
│  1. Parse body (text | reviews)      │
│  2. Para cada reseña:                │
│     a. Llama DetectDominantLanguage  │
│     b. Llama DetectSentiment en ese  │
│        idioma                        │
│  3. Agrupa resultados                │
│  4. Si productId → update DynamoDB   │
│  5. Return JSON con resultados       │
└──────┬──────────────────────────────┘
       │
       ├──────→ Comprehend ─────→ Sentimiento
       │                         (POSITIVE/NEGATIVE/NEUTRAL/MIXED)
       │
       └──────→ DynamoDB ──────→ reviewSentiment + reviewSentimentCounts
       │
       └──────→ Cliente ───────→ JSON con scores y labels
```

---

## 💡 Conceptos clave

### Sentimiento vs. opinión literal

**El truco de NLP que el examen valora:**

- Frase: `"No está nada mal"`
- Análisis literal (regex/reglas): ve `"no"` → `NEGATIVE` ❌
- Análisis NLP (Comprehend): entiende el matiz → `POSITIVE` ✅

Comprehend captura **contexto y matices**. Eso es el valor de ML sobre if/else.

### Scores vs. etiqueta

Comprehend devuelve:
- **Etiqueta**: `POSITIVE`, `NEGATIVE`, `NEUTRAL`, `MIXED`.
- **Scores**: probabilidad de cada clase (0.0 a 1.0).

Ejemplo:
```json
{
  "sentiment": "MIXED",
  "scores": {
    "Positive": 0.0012,
    "Negative": 0.0037,
    "Neutral": 0.0001,
    "Mixed": 0.9950
  }
}
```

**¿Por qué importa?** Porque:
1. Podrías rechazar solo si `Mixed > 0.95` (más cauteloso).
2. Un score de 0.51 POSITIVE es distinto que 0.99 POSITIVE (confianza).

### Idioma multi

Comprehend soporta 10+ idiomas: español, inglés, francés, alemán, italiano, portugués, árabe, hindi, japonés, coreano, chino.

En S03, si la reseña está en **inglés**, Comprehend lo detecta solo (DetectDominantLanguage), y luego analiza el sentimiento en inglés. Sin que el usuario tenga que decir nada.

---

## 🚀 Paso a paso: qué sucede en el código

### Cuando llamas (Paso 3 de GUIA):

```bash
curl -X POST "$URL/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text":"Me encantó la tela y el corte, llegó rapidísimo."}'
```

### La Lambda hace (en `app.py`):

1. **Parse del body:**
   ```python
   body = json.loads(event.get("body") or "{}")
   texts = [body.get("text")] if body.get("text") else body.get("reviews", [])
   # texts = ["Me encantó la tela..."]
   ```

2. **Para cada texto, detecta idioma:**
   ```python
   resp = comprehend.detect_dominant_language(Text="Me encantó la tela...")
   # resp = {"Languages": [{"LanguageCode": "es", "Score": 0.999}]}
   lang = "es"
   ```

3. **Luego detecta sentimiento en ese idioma:**
   ```python
   s = comprehend.detect_sentiment(Text="Me encantó la tela...", LanguageCode="es")
   # s = {
   #   "Sentiment": "POSITIVE",
   #   "SentimentScore": {
   #     "Positive": 0.9998,
   #     "Negative": 0.0001,
   #     "Neutral": 0.0001,
   #     "Mixed": 0.0
   #   }
   # }
   ```

4. **Arma el resultado:**
   ```python
   {
     "text": "Me encantó...",
     "language": "es",
     "sentiment": "POSITIVE",
     "scores": {
       "Positive": 0.9998,
       "Negative": 0.0001,
       "Neutral": 0.0001,
       "Mixed": 0.0
     }
   }
   ```

5. **Si hay `productId`, agrega a DynamoDB:**
   ```python
   table.update_item(
     Key={"productId": "8e701adc-..."},
     UpdateExpression="SET reviewSentiment = :s, reviewSentimentCounts = :c",
     ExpressionAttributeValues={
       ":s": "POSITIVE",
       ":c": {"POSITIVE": 1}  # contar cuántas reseñas positivas
     }
   )
   ```

---

## 🔍 Diferencia entre `DetectLabels` (S1) y `DetectSentiment` (S3)

| Aspecto | S1 (Rekognition) | S3 (Comprehend) |
|--------|------------------|-----------------|
| **Entrada** | Imagen | Texto |
| **Detecta** | Objetos, escenas (`"Clothing"`, `"Person"`) | Sentimiento (`"POSITIVE"`, `"NEGATIVE"`) |
| **API** | `DetectLabels` | `DetectSentiment` |
| **Caso de uso** | Etiquetar fotos automáticamente | Entender reseñas y feedback |
| **Entiende contexto** | Sí (qué hay en la imagen) | Sí (matices de lenguaje) |

---

## 📊 Ejemplo del mundo real: reseña mixta

**Reseña:** `"Buena pero el envío tardó tres semanas."`

- **Comprehend devuelve:**
  ```json
  {
    "sentiment": "MIXED",
    "scores": {
      "Positive": 0.0012,
      "Negative": 0.0037,
      "Neutral": 0.0001,
      "Mixed": 0.9950
    }
  }
  ```

- **¿Por qué?** Porque hay dos ideas enfrentadas:
  - Positiva: "Buena" (0.12%).
  - Negativa: "tardó" (0.37%).
  - Juntas forman una **mezcla** (99.50%).

- **¿Qué hace S03?**
  - Etiqueta como `MIXED`.
  - Guarda los scores para que TechModa vea la incertidumbre.
  - Si hubiera 10 reseñas, contaría: 7 POSITIVE, 2 MIXED, 1 NEGATIVE → agregado = `POSITIVE` (mayoría).

---

## 🎓 Conceptos D1 (para el examen)

### 1. **Servicio de IA preentrenado administrado**

Comprehend es un modelo **ya entrenado por AWS con millones de ejemplos**. Vos:
- ✅ Lo usás ("inferencia").
- ✅ Lo ajustás con parámetros (idioma, confianza).
- ❌ No lo entrenás.
- ❌ No necesitás GPUs ni datasets.

**Alternativa de D1:** si quisieras entrenar tu propio modelo, usarías **SageMaker** (D1 lo menciona). Pero Comprehend es más rápido y barato para la mayoría de casos.

### 2. **Elegir el servicio por modalidad de dato**

El examen te da escenarios y espera que elijas:

| Entrada | Servicio | Ejemplo |
|---------|----------|---------|
| Imagen | Rekognition | Detectar objetos en fotos de productos |
| Texto | Comprehend | Analizar reseñas, detectar PII, entidades |
| Voz | Transcribe | Convertir audio en texto |
| Voz (síntesis) | Polly | Generar voz desde texto (ej: "gracias por comprar") |
| Generación de texto/código | Bedrock | "Dame un poema sobre moda" |

### 3. **Inferencia vs. entrenamiento**

- **Inferencia** (S03): pasás datos a un modelo ya hecho → respuesta inmediata. Rápido, barato.
- **Entrenamiento** (no en S03): armás un dataset, ajustás un modelo de cero → toma horas/días. Caro, lento.

S03 es **puro inferencia**.

### 4. **Confianza y umbrales**

Comprehend te da scores (0–1). Podrías:
- Aceptar solo si `confidence > 0.9` (muy estricto, menos cobertura).
- Aceptar si `confidence > 0.5` (más permisivo, más errores).

**El examen valora:** que entiendas este trade-off (precisión vs. cobertura).

---

## 💸 Costos

**Comprehend se cobra por:**
- **`DetectSentiment`**: $0.0001 por unidad (100 caracteres).
- **`DetectDominantLanguage`**: $0.0001 por unidad.

**Ejemplo:** 100 reseñas de 500 caracteres cada una:
- Cada reseña → 5 unidades de 100 caracteres.
- 2 llamadas por reseña (idioma + sentimiento) → 10 unidades.
- 100 reseñas × 10 unidades × $0.0001 = **$0.10 USD**.

Centavos en práctica.

---

## ❓ Preguntas frecuentes (FAQ)

### ¿Qué pasa si la reseña está en un idioma no soportado?

Comprehend detecta el idioma igual. Si es idioma raro (ej: islandés), vuelca al `SUPPORTED` default (inglés). El resultado puede no ser preciso, pero no falla.

```python
SUPPORTED = {"es", "en", "fr", "de", "it", "pt", "ar", "hi", "ja", "ko", "zh", "zh-TW"}
```

### ¿Puedo cambiar la confianza mínima para aceptar un sentimiento?

Sí. Ahora Comprehend devuelve scores; podrías agregar lógica:

```python
if s["SentimentScore"]["Positive"] > 0.95:
    # Solo aceptar POSITIVE muy seguros
    sentiment = "POSITIVE"
```

Pero esto entra en **gobernanza**, no en el código base de S03.

### ¿Cómo detecto si una reseña es spam o fake?

Comprehend **no** detecta eso. Es exclusivamente para sentimiento. Para spam, necesitarías otra herramienta (ej: CloudWatch Logs patterns, modelo custom en SageMaker, etc.). S03 no lo hace.

### ¿Puedo analizar textos muy largos?

DetectSentiment acepta hasta 5000 caracteres. Si la reseña es más larga, podrías:
- Truncarla a 5000 chars (perder contexto).
- Dividirla en chunks y promediar sentimientos (más caro, más lógica).

S03 asume reseñas normales (~500 chars).

### ¿Qué pasa si mando un array vacío de `reviews`?

La Lambda devuelve error 400: `"Enviá 'text' o 'reviews'..."`.

```python
if not texts:
    return _response(400, {"error": "..."})
```

### ¿Se actualiza el agregado cada vez que agrego una reseña?

**No.** S03 reemplaza `reviewSentiment` y `reviewSentimentCounts` cada vez. Si quisieras **acumular**, necesitarías lógica diferente (leer el estado anterior, sumar, guardar). S03 es stateless por sesión.

---

## 🔐 Mínimo privilegio — IAM en S03

La Lambda de S03 tiene estos permisos:

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref ProductsTable
  - Statement:
      - Effect: Allow
        Action:
          - comprehend:DetectSentiment
          - comprehend:DetectDominantLanguage
        Resource: "*"
```

**¿Por qué `Resource: "*"` para Comprehend?**

Porque Comprehend **no soporta ARN a nivel de recurso**. No puedes hacer:
```
arn:aws:comprehend:us-east-1:ACCOUNT:model/my-model
```

Entonces, el control correcto es **por acción**: la Lambda solo puede hacer `DetectSentiment` y `DetectDominantLanguage`, no `comprehend:*` (ej: no puede llamar a `CreateDocumentClassifier` que es caro).

---

## 🎯 Diferencia entre `MIXED` y otras clases

Imaginá estas reseñas:

| Reseña | Sentimiento | Por qué |
|--------|------------|---------|
| `"Excelente, 10/10"` | POSITIVE | Una idea, muy clara. |
| `"Horrible, no lo recomiendo"` | NEGATIVE | Una idea, muy clara. |
| `"Bueno. Pero tardó."` | MIXED | Dos ideas enfrentadas. |
| `"El producto existe."` | NEUTRAL | Sin opinión positiva ni negativa. |

---

## 🧠 Resumen del flujo end-to-end

```
1. Cliente hace curl con reseña
   ↓
2. Lambda recibe el POST
   ↓
3. Lambda llama DetectDominantLanguage(reseña)
   → Respuesta: "es" (español)
   ↓
4. Lambda llama DetectSentiment(reseña, LanguageCode="es")
   → Respuesta: POSITIVE (0.9998 confianza)
   ↓
5. Si hay productId, Lambda hace UPDATE en DynamoDB
   → Suma +1 a reviewSentimentCounts["POSITIVE"]
   ↓
6. Lambda devuelve JSON con scores y resultado
   ↓
7. Cliente ve: "sentiment": "POSITIVE"
```

---

## ✅ Validación paso a paso

- ✓ Lambda desplegada como `AnalyzeSentimentFunction`.
- ✓ Function URL accesible vía `AnalyzeSentimentUrl` (output del stack).
- ✓ Curl con `{"text":"..."}` devuelve scores + sentimiento.
- ✓ Curl con `{"productId":"...", "reviews":[...]}` guarda en DynamoDB.
- ✓ `get-item` de DynamoDB muestra `reviewSentiment` actualizado.

---

## 📚 Conexión con otros módulos

- **S1 (Rekognition):** etiqueta imágenes. S03 complementa analizando **reseñas** (feedback) sobre esas imágenes.
- **S2 (Moderación):** filtra contenido inapropiado en imágenes. S03 filtra opiniones tóxicas en **texto** (extensión natural).
- **S5 (PII en Comprehend):** en una sesión futura, usarás `DetectPiiEntities` de Comprehend para encontrar números de teléfono/emails en reseñas → privacidad.

---

## 🎓 Última palabra para el examen

**Cuándo esperar preguntas sobre S03:**

- "¿Cuál es el servicio AWS para analizar sentimiento de texto?" → **Comprehend** ✅
- "¿Cómo detectas el idioma de una reseña?" → **DetectDominantLanguage** ✅
- "¿Qué ventaja tiene usar ML vs. regex para detectar sentimiento?" → **Entiende contexto, matices, no solo palabras clave.** ✅
- "¿Qué es una 'unidad' en Comprehend?" → **100 caracteres.** ✅
- "¿Puedo entrenar mi propio modelo de sentimientos en Comprehend?" → **No, es preentrenado; para entrenar necesitás SageMaker.** ✅

---

**Próxima sesión:** S04 (Extracción de entidades con Comprehend — más NLP).

¡Felicidades! Completaste **S03 · Sentimiento de reseñas** 🎉
