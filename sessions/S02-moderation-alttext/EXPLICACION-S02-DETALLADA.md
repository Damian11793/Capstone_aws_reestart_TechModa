# S02 — Explicación Detallada: Moderación de Imágenes + Alt-text Accesible

> Esta guía está hecha para quienes recién empiezan con IA en AWS. S02 profundiza en **Responsible AI** y accesibilidad.

---

## 📚 Tabla de Contenidos

1. [¿Qué es S02?](#qué-es-s02)
2. [Los Conceptos de IA Responsable](#los-conceptos-de-ia-responsable)
3. [Los Servicios AWS Involucrados](#los-servicios-aws-involucrados)
4. [La Arquitectura en Detalle](#la-arquitectura-en-detalle)
5. [Flujo Paso a Paso](#flujo-paso-a-paso)
6. [Los Permisos IAM](#los-permisos-iam)
7. [Qué Pasó Cuando Ejecutamos los Comandos](#qué-pasó-cuando-ejecutamos-los-comandos)
8. [Conceptos Clave para el Examen (D4)](#conceptos-clave-para-el-examen-d4)

---

## ¿Qué es S02?

**S02 agranda el sistema de S01 con dos responsabilidades nuevas:**

### 1. **Moderación de Contenido** — Seguridad

Antes de publicar una imagen en el catálogo, verificamos automáticamente que **no contiene contenido inapropiado**.

**¿Inapropiado?** Violencia, contenido sugestivo, sustancias peligrosas, etc.

**¿Por qué?**
- Una tienda de moda no quiere publicar fotos ofensivas por error.
- Si publicamos contenido inapropiado, perdemos clientes y reputación.
- Un moderador manual revisaría miles de fotos: lento, costoso y agotador.

**Cómo funciona:**
- Rekognition analiza la imagen.
- Si detecta algo inapropiado con confianza > umbral → `FLAGGED`.
- Si está limpio → `APPROVED`.
- Los flagged van a un moderador humano (no se publican automáticamente).

### 2. **Alt-text Accesible** — Inclusión

Generamos automáticamente **texto alternativo** para cada imagen.

**¿Qué es alt-text?**
Texto que aparece si la imagen no carga, o que un lector de pantalla lee en voz alta para personas ciegas/con baja visión.

**Ejemplo:**
```html
<!-- Sin alt-text (malo) -->
<img src="vestido.jpg" />

<!-- Con alt-text (bueno) -->
<img src="vestido.jpg" alt="Vestido midi floral azul con mangas cortas" />
```

**¿Por qué?**
- **Accesibilidad:** WCAG (estándar web) lo exige.
- **SEO:** Google usa alt-text para indexar imágenes.
- **Experiencia:** Si la imagen no carga, el usuario entiende qué hay.

---

## Los Conceptos de IA Responsable

### D4 — Responsible AI (14% del examen)

S02 cubre los 4 pilares de **Responsible AI**:

| Pilar | S02 | Ejemplo |
|-------|-----|---------|
| **Seguridad** | Moderación de contenido dañino | Bloquear imágenes violentas |
| **Inclusión** | Alt-text para personas con discapacidad | Lector de pantalla |
| **Transparencia** | Usuario sabe por qué se flaggeó algo | "Confianza: 75% en violencia" |
| **Equidad** | Modelo igual para todos los países/idiomas | Rekognition está entrenado globalmente |

### Human-in-the-Loop

**Patrón clave del examen:**

```
IA (Rekognition) → Filtra y marca candidatos → Humano → Decisión final
```

**NO es:** IA decide todo automáticamente.  
**SÍ es:** IA filtra, **humano revisa** casos dudosos.

**Ventaja:** Reduce trabajo manual (1.000 imágenes → 50 flagged → humano revisa 50).

### Trade-off: Falsos Positivos vs. Falsos Negativos

**Falso Positivo:** Marcar una foto inocente como inapropiada.
- Problema: Comerciante molesto, puede perder ventas.
- Impacto: Comercial.

**Falso Negativo:** Dejar pasar una foto realmente inapropiada.
- Problema: Imagen inapropiada visible en catálogo.
- Impacto: Reputacional (peor).

**En S02:** `MinConfidence: 60` (más bajo que S01's 80).
- **Por qué:** Preferimos **pecar de cautelosos**. Mejor revisar 100 imágenes falsas que 1 inapropiada real.

---

## Los Servicios AWS Involucrados

### 1. **Rekognition — Dos APIs**

#### `DetectModerationLabels`
Analiza la imagen y devuelve etiquetas de contenido sensible.

```json
{
  "ModerationLabels": [
    {
      "Name": "Violence",
      "Confidence": 85.5,
      "ParentName": "Violent"  // Jerarquía padre/hijo
    },
    {
      "Name": "Weapons",
      "Confidence": 72.3,
      "ParentName": "Violence"
    }
  ]
}
```

**Categorías principales:**
- `Suggestive` (contenido sugestivo)
- `Violence` (violencia)
- `Visually Disturbing` (perturbador)
- `Rude Gestures` (gestos groseros)
- `Drugs` (drogas)
- `Tobacco` (tabaco)
- `Alcohol` (alcohol)
- `Gambling` (apuestas)
- `Hate Symbols` (símbolos de odio)

#### `DetectLabels` (reutilizado de S01)
Genera descripción de la imagen para el alt-text.

```json
{
  "Labels": [
    {"Name": "Clothing", "Confidence": 95.2},
    {"Name": "Dress", "Confidence": 93.1},
    {"Name": "Person", "Confidence": 88.7}
  ]
}
```

### 2. **Lambda** — Orquestadora

**Qué hace:**
1. Lee el producto de DynamoDB.
2. Llama a `DetectModerationLabels` → verifica si está flagged.
3. Llama a `DetectLabels` → construye alt-text.
4. Escribe `moderationStatus` y `altText` en DynamoDB.

**Diferencia con S01:**
- S01: Una sola llamada a Rekognition.
- S02: Dos llamadas (moderación + labels).

### 3. **DynamoDB** — Almacenamiento

Ahora guardamos más datos:

```
ProductoID: 8e701adc-af8d-4882-994d-6e2237e98ec4
  ├─ name: "Tenis blancos"
  ├─ imageUrl: "s3://..."
  ├─ aiLabels: ["Footwear", "Shoe"]              ← S01
  ├─ moderationStatus: "APPROVED"                 ← S02 nuevo
  └─ altText: "Tenis blancos minimalistas..."     ← S02 nuevo
```

---

## La Arquitectura en Detalle

### Diagrama del Flujo

```
┌──────────────────────────────────────┐
│  USUARIO: curl POST /moderate        │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│      LAMBDA FUNCTION (S02)           │
│  ├─ Lenguaje: Python 3.12            │
│  ├─ Trigger: HTTP POST /moderate     │
│  └─ Rol: Mínimo privilegio           │
└────┬─────────────────┬───────────────┘
     │                 │
     ▼ Lee             ▼ Escribe
 ┌────────┐        ┌────────┐
 │DynamoDB│        │DynamoDB│
 │(producto)       │(resultado)
 └────┬───┘        └────────┘
      │ Pasa URL
      │
      ▼ ╔════════════════════════════════╗
   S3 → ║  REKOGNITION (dos llamadas):   ║
        ║  1. DetectModerationLabels     ║
        ║  2. DetectLabels (alt-text)    ║
        ╚════════════════════════════════╝
```

### Decisión en la Lambda

```python
# Pseudocódigo
product = dynamodb.get(productId)
image_url = product["imageUrl"]

# Paso 1: Moderación
moderation = rekognition.detect_moderation_labels(image_url)
if any(label.confidence >= 60 for label in moderation):
    status = "FLAGGED"  # → Humano revisa
else:
    status = "APPROVED"  # → Se publica

# Paso 2: Alt-text
labels = rekognition.detect_labels(image_url)
alt_text = f"Imagen de producto que muestra: {', '.join([L.name for L in labels])}"

# Paso 3: Guardar
dynamodb.update(productId, {
    "moderationStatus": status,
    "altText": alt_text
})
```

---

## Flujo Paso a Paso

### Paso 1: Preparación

Igual que S01: agregamos `ModerateImageFunction` al `template.yaml`.

```yaml
ModerateImageFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: sessions/S02-moderation-alttext/functions/moderate-image
    Runtime: python3.12
    Environment:
      Variables:
        MODERATION_MIN_CONFIDENCE: "60"  # Umbral bajo (cauteloso)
    Policies:
      - rekognition:DetectModerationLabels
      - rekognition:DetectLabels
      - ...
```

**¿Por qué `"60"` (más bajo)?**
Porque preferimos revisar casos dudosos que dejar pasar contenido real inapropiado.

### Paso 2: Deploy

```bash
sam build && sam deploy
```

Se crea una URL nueva: `ModerateImageUrl`.

### Paso 3: Ejecutar

**Usuario llama:**
```bash
curl -X POST "https://.../products/8e701adc.../moderate"
```

**¿Qué pasa adentro?**

#### 3a. Lambda recibe evento
```json
{
  "path": "/products/8e701adc.../moderate",
  "method": "POST"
}
```

#### 3b. Lambda extrae productId
```python
productId = "8e701adc-af8d-4882-994d-6e2237e98ec4"
```

#### 3c. Lambda busca el producto
```python
product = dynamodb.get_item(productId)
# Obtiene: {"name": "...", "imageUrl": "s3://...", "aiLabels": [...]}
```

#### 3d. Lambda llama a DetectModerationLabels

```python
response = rekognition.detect_moderation_labels(
    Image={'S3Object': {'Bucket': 'techmoda-ai-...', 'Name': 'assets/test-image.jpg'}},
    MinConfidence=60
)
```

**Rekognition devuelve:**
```json
{
  "ModerationLabels": [
    {
      "Name": "Violence",
      "Confidence": 15.2
    }
  ]
}
```

(Confianza muy baja → no es violencia)

#### 3e. Lambda verifica si algo está flagged

```python
has_flags = any(label['Confidence'] >= 60 for label in response['ModerationLabels'])
# False → está limpio

status = "APPROVED" if not has_flags else "FLAGGED"
```

#### 3f. Lambda llama a DetectLabels

```python
response = rekognition.detect_labels(
    Image={'S3Object': {...}},
    MaxLabels=15,
    MinConfidence=80
)
```

**Devuelve:**
```json
{
  "Labels": [
    {"Name": "Animal", "Confidence": 99.31},
    {"Name": "Insect", "Confidence": 99.31}
  ]
}
```

#### 3g. Lambda construye alt-text

```python
label_names = [L['Name'] for L in response['Labels']]
alt_text = f"Imagen de producto que muestra: {', '.join(label_names)}."
# "Imagen de producto que muestra: Animal, Insect, Invertebrate, Ant."
```

#### 3h. Lambda guarda en DynamoDB

```python
dynamodb.update_item(
    Key={'productId': productId},
    UpdateExpression='SET moderationStatus = :status, altText = :alt',
    ExpressionAttributeValues={
        ':status': 'APPROVED',
        ':alt': 'Imagen de producto que muestra: Animal, Insect, ...'
    }
)
```

#### 3i. Lambda devuelve respuesta

```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "moderationStatus": "APPROVED",
  "moderationFlags": [],
  "altText": "Imagen de producto que muestra: Animal, Insect, Invertebrate, Ant."
}
```

---

## Los Permisos IAM

S02 necesita **dos acciones de Rekognition** (vs. una en S01):

```yaml
Policies:
  # DynamoDB: leer y escribir
  - DynamoDBCrudPolicy:
      TableName: !Ref ProductsTable

  # Rekognition: dos acciones específicas
  - Statement:
      - Effect: Allow
        Action:
          - rekognition:DetectModerationLabels  ← Nueva
          - rekognition:DetectLabels            ← De S01
        Resource: "*"

  # S3: leer imágenes del stack
  - Statement:
      - Effect: Allow
        Action: s3:GetObject
        Resource: !Sub arn:...s3:::${StackName}-*/*
```

**Seguridad:**
- Si la Lambda es hackeada, **solo** puede: moderación + etiquetado.
- No puede entrenar modelos, eliminar, acceder a otros servicios.

---

## Qué Pasó Cuando Ejecutamos los Comandos

### 1. Subir Imagen (S01)

```bash
aws s3 cp test-image.jpg s3://techmoda-ai-jorge-damian-diaz-v2-frontend/assets/test-image.jpg
```

S3 guardó la imagen.

### 2. Actualizar Producto (S01)

```bash
curl -X PUT ".../products/8e701adc.../label" -d '{"imageUrl": "s3://..."}'
```

Router CRUD actualizó `imageUrl`.

### 3. Etiquetar (S01)

```bash
curl -X POST ".../products/8e701adc.../labels"
```

S01 llamó a Rekognition DetectLabels → guardó `aiLabels`.

### 4. Moderar + Alt-text (S02 — NUEVO)

```bash
URL=$(aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ModerateImageUrl'].OutputValue" --output text)
curl -s -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/moderate" | python3 -m json.tool
```

**¿Qué pasó?**
1. Lambda leyó el producto de DynamoDB.
2. Llamó a `DetectModerationLabels` → confianza baja en "Violence" → `APPROVED`.
3. Llamó a `DetectLabels` → obtuvo 4 etiquetas.
4. Construyó alt-text: "Imagen de producto que muestra: Animal, Insect, Invertebrate, Ant."
5. Guardó en DynamoDB.

**Resultado:**
```json
{
  "productId": "8e701adc...",
  "moderationStatus": "APPROVED",
  "moderationFlags": [],
  "altText": "Imagen de producto que muestra: Animal, Insect, Invertebrate, Ant."
}
```

### 5. Verificar DynamoDB

```bash
aws dynamodb get-item --table-name techmoda-ai-jorge-damian-diaz-v2-Products \
  --key '{"productId":{"S":"8e701adc..."}}' \
  --query 'Item | {moderationStatus: moderationStatus, altText: altText}'
```

**Devolvió:**
```json
{
  "moderationStatus": {"S": "APPROVED"},
  "altText": {"S": "Imagen de producto que muestra: Animal, Insect, Invertebrate, Ant."}
}
```

---

## Conceptos Clave para el Examen (D4)

### 1. **Las Cuatro Dimensiones de Responsible AI**

| Dimensión | Pregunta | S02 |
|-----------|----------|-----|
| **Seguridad** | ¿Daña a alguien? | Moderación: bloquear violencia, etc. |
| **Inclusión** | ¿Excluye a alguien? | Alt-text para ciegos/baja visión |
| **Transparencia** | ¿Sabe el usuario por qué? | "Confianza: 75% en violencia" |
| **Equidad** | ¿Funciona igual para todos? | Rekognition entrenado globalmente |

**Para el examen:** Si ves "¿cuál es el riesgo de IA aquí?", analiza estas 4 dimensiones.

### 2. **Human-in-the-Loop**

**NO recomendado:**
```
IA decide automáticamente
→ Se publica si APPROVED
→ Riesgo: contenido inapropiado
```

**RECOMENDADO (S02):**
```
IA filtra y flaggea candidatos
→ Si APPROVED: se publica
→ Si FLAGGED: humano revisa
→ Más seguro: humano + IA
```

**Para el examen:** Siempre prefiere human-in-the-loop para decisiones sensibles.

### 3. **Umbral como Control de Riesgo**

| Umbral | Falsos Positivos | Falsos Negativos | Cuándo usar |
|--------|------------------|------------------|------------|
| **Alto (90%)** | Pocos | Muchos | Baja tolerancia a falsos positivos |
| **Bajo (60%)** | Muchos | Pocos | Baja tolerancia a falsos negativos |

**S02 usa 60% porque:** Preferimos revisar 100 inocentes que 1 culpable se nos escape.

### 4. **Un Servicio, Múltiples Dominios**

- **S01 (D1):** Etiquetado → Inferencia, IA preentrenada.
- **S02 (D4):** Moderación + accesibilidad → IA responsable.

**El mismo servicio (Rekognition) sirve para diferentes dominios** del examen.

### 5. **Accesibilidad como Derecho**

WCAG 2.1 exige alt-text. S02 lo automatiza:
- Beneficia a personas ciegas/baja visión.
- Beneficia a todos cuando la imagen no carga.
- Mejora SEO (Google indexa alt-text).

**Para el examen:** Accesibilidad no es "feature", es **requisito legal** + ética.

---

## Resumen: De Principio a Fin

1. **Agregaste una Lambda** con dos responsabilidades.
2. **Deployaste** con SAM.
3. **Llamaste a Rekognition DetectModerationLabels** → verifica seguridad.
4. **Llamaste a Rekognition DetectLabels** → genera alt-text.
5. **Guardaste** ambos resultados en DynamoDB.
6. **Verificaste** que funcionó.

**Servicios usados:**
- ✅ Lambda (ejecución)
- ✅ Rekognition (IA — dos APIs)
- ✅ DynamoDB (almacenamiento)
- ✅ S3 (imágenes)
- ✅ IAM (permisos)

**Conceptos cubiertos (D4 — Responsible AI):**
- ✅ Seguridad: moderación automática.
- ✅ Inclusión: alt-text accesible.
- ✅ Human-in-the-loop: IA filtra, humano decide.
- ✅ Umbral como control de riesgo.
- ✅ Trade-off falsos positivos/negativos.

---

## Preguntas Frecuentes

### ¿Qué pasa si subo una imagen con contenido real inapropiado?

Rekognition lo detectaría y devolvería confianza > 60% → `FLAGGED` → va a revisión humana.

Probá si querés (pero no incluimos ejemplos por razones obvias).

### ¿Por qué `DetectLabels` de nuevo si ya lo hizo S01?

En S01 generamos `aiLabels` para búsqueda/filtrado.  
En S02 reutilizamos esos datos para construir alt-text descriptivo.

**Reutilización de datos:** Las etiquetas de S01 sirven para S02 sin llamar de nuevo (si las guardaste). Aquí hacemos otra llamada porque es más seguro.

### ¿El alt-text generado es perfecto?

No siempre. Rekognition puede no ver detalles:
- "Azul" vs. "Azul claro"
- "Vestido" vs. "Vestido de gasa"

Pero es mucho mejor que nada, y un humano puede refinarlo después.

### ¿Puedo customizar el formato del alt-text?

Sí. Dentro de `app.py` en S02, la función que construye alt-text es editable:

```python
alt_text = f"Imagen de producto que muestra: {', '.join(label_names)}."
```

Podrías hacer:
```python
alt_text = f"Prenda de moda con: {', '.join(label_names)}. Recomendado para..."
```

### ¿Cuánto cuesta S02?

- **Rekognition DetectModerationLabels:** ~$0.0015 por imagen.
- **Rekognition DetectLabels:** ~$0.001 por imagen.
- **Total por imagen:** ~$0.0025 USD.

Para 100 imágenes: ~$0.25 USD (centavos).

### ¿Qué pasa si la imagen es muy grande o en formato raro?

Rekognition soporta: JPEG, PNG, GIF, WebP.  
Límite: ~15 MB.

Si la imagen falla, Lambda devuelve error. Un sistema real comprimiría automáticamente.

---

## Siguientes Pasos

- **S03:** Análisis de Sentimiento en reseñas (Comprehend).
- **S04+:** Más servicios de IA.

Cada sesión agrega una Lambda nueva con su propia responsabilidad.

