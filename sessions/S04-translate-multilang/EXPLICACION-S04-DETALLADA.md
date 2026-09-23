# S4 · Explicación Detallada — Traducción Multilingüe con Amazon Translate

**Duración de lectura:** ~15 min  
**Nivel:** Principiante  
**Dominio AIF-C01:** D1 — Fundamentals of AI and ML (20%)  

---

## 🎯 ¿Qué es S04 y por qué importa?

**El problema real:** TechModa vende ropa. Sus clientes están en España e Hispanoamérica (español), pero también en EE.UU., UK, etc. (inglés). Contratar traductores para cada producto nuevo es caro y lento.

**La solución:** S04 agrega una Lambda que **traduce automáticamente** el nombre y descripción de cada producto entre español e inglés en **segundos**, usando Amazon Translate (un modelo neuronal preentrenado).

**Por qué entra en el examen (D1):**
- D1 ("Fundamentals of AI and ML") incluye **servicios de IA especializados por tarea**: imagen → Rekognition, texto → Comprehend, **traducción → Translate**, voz → Polly/Transcribe, etc.
- El examen espera que entiendas **cuándo usar cada servicio** y por qué (costo, latencia, determinismo).
- S04 demuestra **composición de servicios** (Translate usa Comprehend internamente para detectar idioma).

---

## 🧩 Servicios involucrados

### 1. **Amazon Translate** — Motor de traducción neuronal

Translate es un modelo de **Traducción Automática Neuronal (NMT, del inglés Neural Machine Translation)** preentrenado. Características:

- **No entrenas nada:** AWS ya lo entrenó con millones de textos bilingües.
- **Detecta idioma automáticamente:** Pasas `SourceLanguageCode="auto"` y Translate detecta si es español, inglés, etc.
- **Multiidioma:** soporta 75+ pares de idiomas.
- **Determinista:** misma entrada → misma salida (útil para catálogos).

**¿Por qué Translate y no Bedrock para traducir?**
- **Translate:** rápido (100-500 ms), barato (centavos), determinista, especializado.
- **Bedrock:** más lento (1-3 s), más caro (dólares por grandes volúmenes), no determinista (LLM genera respuestas variadas).

Para traducir un catálogo, Translate es la opción correcta.

### 2. **Comprehend** — Detecta idioma

Translate usa `DetectDominantLanguage` de Comprehend internamente. Si pasas `SourceLanguageCode="auto"`:
1. Translate llama a Comprehend.
2. Comprehend devuelve el idioma detectado (ej: `"es"`).
3. Translate traduce usando ese idioma.

**¿Por qué importa para IAM?** Porque la Lambda de S04 necesita permiso para **ambas acciones**:
- `translate:TranslateText` (la acción principal).
- `comprehend:DetectDominantLanguage` (dependencia).

### 3. **AWS Lambda** — El orquestador

```
Cliente → Lambda Function URL → Translate + Comprehend → DynamoDB → Lambda devuelve resultado
```

La Lambda de S04:
1. Recibe el ID del producto + idioma destino (ej: `{"target":"en"}`).
2. Lee el producto de DynamoDB.
3. Llama a Translate: `TranslateText(text="Zapatillas blancas...", SourceLanguageCode="auto", TargetLanguageCode="en")`.
4. Guarda la traducción en `translations.en` del producto.
5. Devuelve el resultado.

### 4. **DynamoDB** — Almacén persistente

Cada producto almacena un mapa anidado `translations`:
```json
{
  "productId": "8e701adc-...",
  "name": "Zapatillas blancas",
  "description": "Zapatillas en cuero sintético blanco...",
  "translations": {
    "es": {
      "name": "Zapatillas blancas",
      "description": "Zapatillas en cuero sintético blanco..."
    },
    "en": {
      "name": "Minimalist white sneakers",
      "description": "Sneakers in white synthetic leather..."
    }
  }
}
```

### 5. **IAM** — Permisos mínimos

La Lambda solo puede:
- Llamar a `translate:TranslateText` y `comprehend:DetectDominantLanguage`.
- Hacer CRUD en la tabla `ProductsTable`.
- Nada más.

---

## 🏗️ Arquitectura y flujo

```
┌─────────────┐
│   Usuario   │
│  (Frontend) │
└──────┬──────┘
       │ curl -X POST $URL/products/ID/translate
       │ {"target":"en"}
       ▼
┌──────────────────────────────────────┐
│  Lambda: TranslateCatalogFunction    │
│                                      │
│  1. Parse body (target="en")         │
│  2. Read producto from DynamoDB      │
│  3. Para name y description:         │
│     a. Llama TranslateText           │
│        - SourceLanguageCode="auto"   │
│        - TargetLanguageCode="en"     │
│     (Translate llama DetectLanguage) │
│  4. Guarda en translations.en        │
│  5. Return JSON con traducción       │
└──────┬──────────────────────────────┘
       │
       ├──────→ Translate ──────→ Texto traducido
       │        (usa Comprehend)
       │
       └──────→ DynamoDB ──────→ translations.en + translations.es
       │
       └──────→ Cliente ───────→ JSON con traducción
```

---

## 💡 Conceptos clave

### Traducción Automática Neuronal (NMT)

**Antes (SMT, Statistical Machine Translation):**
- Basada en reglas y estadísticas palabra por palabra.
- Frágil: "no está nada mal" → ERROR.

**Ahora (NMT, Neural Machine Translation):**
- Red neuronal entrenada con millones de pares de frases.
- Entiende contexto: "no está nada mal" → correcto.
- Mejor calidad, más rápida.

Translate usa NMT.

### Autodetección de idioma (`SourceLanguageCode="auto"`)

Si pasas `"auto"`, Translate:
1. Llama internamente a `comprehend.detect_dominant_language(Text=...)`.
2. Detecta el idioma (ej: `"es"`).
3. Traduce desde ese idioma al destino (ej: `"en"`).

**Ventaja:** no necesitas que el cliente diga qué idioma es el producto.

### Traducción vs. Localización (importante para el examen)

| Aspecto | Traducción | Localización |
|--------|-----------|--------------|
| Scope | Convertir texto de un idioma a otro. | Adaptar todo para un mercado (moneda, formato, cultura). |
| Servicio | Amazon Translate | Trabajo manual + Translate + reglas custom. |
| S04 hace | ✅ Traduce name + description. | ❌ No adapta moneda, tallas, etc. |
| Ejemplo | `"Zapatillas"` → `"Sneakers"` | `"€49,99"` → `"$54.99"` + conversión. |

**¿Por qué importa?** El examen distingue: "Translate traduce, pero no localiza. Localizar requiere trabajo extra."

### Determinismo

**Translate siempre devuelve la misma traducción para el mismo input.** Eso es importante para un catálogo:
- Llamás dos veces con `"Zapatillas blancas"` → siempre `"Minimalist white sneakers"`.
- Útil para consistencia.

**Bedrock (LLM) no es determinista:**
- Llamas dos veces → posibles respuestas distintas (varía con `temperature`).
- Para catálogos, eso es un problema.

---

## 🚀 Paso a paso: qué sucede en el código

### Cuando llamas (Paso 3 de GUIA):

```bash
curl -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/translate" \
  -H "Content-Type: application/json" \
  -d '{"target":"en"}'
```

### La Lambda hace (en `app.py`):

1. **Parse del body y extrae el producto ID del path:**
   ```python
   product_id = "8e701adc-af8d-4882-994d-6e2237e98ec4"
   target = "en"
   ```

2. **Lee el producto de DynamoDB:**
   ```python
   product = table.get_item(Key={"productId": product_id})
   # product = {
   #   "name": "Zapatillas blancas",
   #   "description": "Zapatillas en cuero sintético blanco, suela de goma."
   # }
   ```

3. **Traduce cada campo:**
   ```python
   name_translated = translate_client.translate_text(
     Text="Zapatillas blancas",
     SourceLanguageCode="auto",        # Translate detecta "es"
     TargetLanguageCode="en"
   )["TranslatedText"]
   # name_translated = "Minimalist white sneakers"
   
   desc_translated = translate_client.translate_text(
     Text="Zapatillas en cuero sintético blanco, suela de goma.",
     SourceLanguageCode="auto",
     TargetLanguageCode="en"
   )["TranslatedText"]
   # desc_translated = "Sneakers in white synthetic leather, rubber sole."
   ```

4. **Guarda en DynamoDB bajo `translations.en`:**
   ```python
   table.update_item(
     Key={"productId": product_id},
     UpdateExpression="SET translations.#t = :trans",
     ExpressionAttributeNames={"#t": "en"},
     ExpressionAttributeValues={
       ":trans": {
         "name": "Minimalist white sneakers",
         "description": "Sneakers in white synthetic leather, rubber sole."
       }
     }
   )
   ```

5. **Devuelve al cliente:**
   ```json
   {
     "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
     "target": "en",
     "translation": {
       "name": "Minimalist white sneakers",
       "description": "Sneakers in white synthetic leather, rubber sole."
     }
   }
   ```

---

## 📊 Ejemplo del mundo real

**Entrada (producto en español):**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "name": "Zapatillas blancas",
  "description": "Zapatillas en cuero sintético blanco, suela de goma."
}
```

**Tras llamar a S04 con `{"target":"en"}`:**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "translations": {
    "es": {
      "name": "Zapatillas blancas",
      "description": "Zapatillas en cuero sintético blanco, suela de goma."
    },
    "en": {
      "name": "Minimalist white sneakers",
      "description": "Sneakers in white synthetic leather, rubber sole."
    }
  }
}
```

**Frontend usa `translations` según el idioma del navegador:**
- Navegador en español → muestra `translations.es`.
- Navegador en inglés → muestra `translations.en`.

---

## 🎓 Conceptos D1 (para el examen)

### 1. **Elegir servicio por tarea**

El examen te da escenarios y espera que elijas:

| Tarea | Servicio | Por qué |
|------|----------|--------|
| Traducir texto | **Translate** | Rápido, barato, determinista. |
| Generar textos creativos | Bedrock | LLM, flexible, no determinista. |
| Analizar sentimiento | Comprehend | NLP especializado. |
| Etiquetar imágenes | Rekognition | Visión por computadora. |

**Clave:** saber cuándo usar Translate vs. Bedrock es un requisito de D1.

### 2. **Servicios compuestos**

Translate no trabaja solo: llama a Comprehend internamente. Esto demuestra:
- **Composición:** un servicio usa otro.
- **IAM necesario:** la Lambda debe tener permisos para ambos (`translate:TranslateText` + `comprehend:DetectDominantLanguage`).

### 3. **Inferencia vs. entrenamiento**

S04 es **puro inferencia**. Translate ya fue entrenado por AWS. Vos:
- ✅ Lo usás (llamás `TranslateText`).
- ❌ No lo entrenás.
- ❌ No cambias el modelo.

### 4. **Traducción ≠ Localización**

Examen distingue:
- **Traducción:** "Zapatillas" → "Sneakers".
- **Localización:** "Zapatillas" → "Sneakers" + "€49,99" → "$54,99" + tallas EU → US.

Translate solo traduce. Localizar es trabajo extra.

### 5. **Determinismo como requisito**

Para un catálogo, traducir dos veces el mismo texto:
- Debe devolver **siempre** lo mismo (determinismo).
- Translate lo garantiza.
- Bedrock (LLM) no.

El examen valora elegir herramienta por **propiedades** (determinismo, latencia, costo).

---

## 💸 Costos

**Translate se cobra por:**
- **Carácter traducido**, con descuentos por volumen.
- **Capa gratuita:** 2 millones de caracteres/mes (primeros 12 meses).

**Ejemplo:** traducir un catálogo de 1000 productos, ~500 caracteres cada uno:
- 1000 × 500 = 500,000 caracteres.
- Si es gratis (capa gratuita) → $0.
- Si no → ~$15 USD (aproximado).

Centavos/dólares en práctica, mucho más barato que traductores humanos.

---

## ❓ Preguntas frecuentes (FAQ)

### ¿Qué pasa si mando un idioma destino inválido?

Translate rechaza idiomas no soportados. Devuelve error 400:
```json
{
  "error": "TargetLanguageCode 'xx' no es válido"
}
```

S04 debe validar que `target` esté en lista de soportados: `["es", "en", "fr", "de", ...]`.

### ¿Puedo traducir a más de un idioma en una sola llamada?

No. S04 traduce a **un idioma destino por llamada** (`target="en"`). Si quieres ES → EN, FR, DE, son 3 llamadas:
```bash
curl ... -d '{"target":"en"}'   # Llamada 1
curl ... -d '{"target":"fr"}'   # Llamada 2
curl ... -d '{"target":"de"}'   # Llamada 3
```

### ¿Qué pasa si la descripción tiene emojis o caracteres especiales?

Translate los preserva. "Zapatillas 👟 blancas ⚪" → "Minimalist white sneakers 👟 ⚪". Sin problema.

### ¿Puedo confiar en Translate 100%?

No. Traducción automática tiene límites:
- Jerga, modismos, referencias culturales → errores.
- Contexto ambiguo → traducciones subóptimas.
- Para **catálogos de moda**, Translate es muy bueno.
- Para **marketing creativo**, mejor revisar un humano.

S04 supone que el backend confiará en Translate; el frontend podría mostrar un ⚠️ "Traducción automática".

### ¿Qué pasa si el producto no existe?

La Lambda devuelve error 404:
```json
{
  "error": "Producto no encontrado"
}
```

### ¿Puedo traducir campos adicionales (ej: `category`, `size`)?

Sí. Ahora S04 traduce solo `name` + `description`. Extender a más campos es trivial: loop sobre lista de campos y traduce cada uno.

### ¿Cómo manejo variantes regionales de idioma (ej: es-ES vs. es-MX)?

Translate soporta códigos de región:
- `"es"` → español genérico.
- `"es-ES"` → español de España.
- `"es-MX"` → español de México.

S04 ahora usa `"es"` genérico. Si necesitas región específica, agrega parámetro: `{"target":"es-MX"}`.

### ¿Qué pasa si traduces múltiples veces el mismo producto?

Cada llamada sobrescribe `translations.en` con la nueva traducción. Si Translate devuelve lo mismo, no hay cambio. Si actualiza (raro), el producto refleja lo nuevo.

---

## 🔐 Mínimo privilegio — IAM en S04

La Lambda de S04 tiene estos permisos:

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref ProductsTable
  - Statement:
      - Effect: Allow
        Action:
          - translate:TranslateText
          - comprehend:DetectDominantLanguage
        Resource: "*"
```

**¿Por qué `comprehend:DetectDominantLanguage`?**

Porque Translate lo llama internamente cuando pasas `SourceLanguageCode="auto"`. Sin ese permiso, falla con:
```
AccessDeniedException: User is not authorized to perform comprehend:DetectDominantLanguage
```

---

## 🎯 Diferencia entre S03 y S04

| Aspecto | S03 (Comprehend Sentiment) | S04 (Translate) |
|--------|---------------------------|-----------------|
| **Entrada** | Texto (reseña) | Texto (name, description) |
| **API** | `DetectSentiment` | `TranslateText` |
| **Salida** | Sentimiento + scores | Texto traducido |
| **Caso de uso** | Analizar feedback | Catálogo multilingüe |
| **Idioma** | Detectable; analiza en ese idioma | Detecta source; traduce a destino |

---

## 🧠 Resumen del flujo end-to-end

```
1. Cliente curl con target="en"
   ↓
2. Lambda recibe el POST + extrae product_id del path
   ↓
3. Lambda lee producto de DynamoDB
   ↓
4. Para name y description:
   a. Lambda llama TranslateText(text, SourceLanguageCode="auto", TargetLanguageCode="en")
   b. Translate llama internamente DetectDominantLanguage(text)
   c. Comprehend devuelve idioma detectado (ej: "es")
   d. Translate traduce usando ese idioma
   ↓
5. Lambda guarda translations.en en DynamoDB
   ↓
6. Lambda devuelve JSON con traducción
   ↓
7. Cliente ve: "translation": {"name": "...", "description": "..."}
```

---

## ✅ Validación paso a paso

- ✓ Lambda desplegada como `TranslateCatalogFunction`.
- ✓ Function URL accesible vía `TranslateCatalogUrl` (output del stack).
- ✓ Curl con `{"target":"en"}` devuelve traducción coherente.
- ✓ Curl con `{"target":"es"}` traduce desde otro idioma.
- ✓ `get-item` de DynamoDB muestra `translations.en` y/o `translations.es` actualizado.

---

## 📚 Conexión con otros módulos

- **S1 (Rekognition):** etiqueta imágenes en inglés (las etiquetas de Rekognition son en inglés). S04 podría traducir esas etiquetas si el frontend quisiera verlas en español.
- **S3 (Comprehend):** analiza reseñas. Si las reseñas están en varios idiomas, S04 no ayuda aquí (necesitarías lógica más compleja).
- **S5–S8 (PII, Entities, Keyphrase, Syntax):** más análisis de texto. Con S04, podrías analizar el texto traducido también.

---

## 🎓 Última palabra para el examen

**Cuándo esperar preguntas sobre S04:**

- "¿Cuál es el servicio AWS para traducción?" → **Amazon Translate** ✅
- "¿Cómo eliges entre Translate y Bedrock para un catálogo?" → **Translate (determinista, rápido, barato); Bedrock es para creatividad.** ✅
- "¿Qué es localización?" → **Traducción + adaptación (moneda, tallas, cultura).** ✅
- "¿Translate necesita entrenamiento?" → **No, es preentrenado (inferencia solo).** ✅
- "¿Por qué Translate llama a Comprehend?" → **Para autodetectar el idioma si pasas `auto`.** ✅
- "¿Translate es determinista?" → **Sí; Bedrock (LLM) no.** ✅

---

**Próxima sesión:** S05 (Detección de PII con Comprehend — privacidad).

¡Felicidades! Completaste **S04 · Catálogo Multilingüe** 🎉
