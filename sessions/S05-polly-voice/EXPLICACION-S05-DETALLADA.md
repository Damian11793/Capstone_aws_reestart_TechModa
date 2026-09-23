# S05 · Descripción por voz / accesibilidad (Amazon Polly) — Guía Detallada

**Nivel:** Principiante · **Tiempo de lectura:** ~15 min

---

## ¿Qué es S05 y por qué importa?

Hasta ahora TechModa **vende por texto e imagen**. Pero hay personas que **no pueden leer bien** (discapacidad visual), y otras que **prefieren escuchar** (multitarea, accesibilidad). S05 convierte la descripción de cada producto en un **audio MP3 natural** con una voz neuronal.

**Impacto real:**
- 🎧 Personas ciegas pueden escuchar qué es lo que estás vendiendo
- 👂 Personas sordas pueden seguir leyendo (ya lo hacían)
- 🚗 Alguien manejando puede "escuchar" el catálogo sin apartar la vista
- ♿ **Accesibilidad real, no decorativa** — es una dimensión de Responsible AI (D4)

El audio **no queda público en S3** — se sirve por **URL prefirmada** (válida solo 1 hora), y **se borra automáticamente a los 7 días** (FinOps).

---

## 🏗️ Arquitectura: servicios y flujo

```
┌─────────────────────────────────────────────────────────────┐
│                     TechModa Frontend                        │
│  (usuario hace click en 🔊 "Escuchar descripción")          │
└─────────────────────────────────────────────────────────────┘
                            │ POST
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  SynthesizeVoiceFunction (Lambda Python)                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. Lee el producto de DynamoDB                          │ │
│  │ 2. Llama a Polly.synthesize_speech()                    │ │
│  │    - Texto: descripción del producto                    │ │
│  │    - Idioma: "es" o "en" (del body del request)        │ │
│  │    - Voz neuronal: "Lupe" (es) o "Joanna" (en)         │ │
│  │ 3. Sube el MP3 a S3 (bucket privado)                    │ │
│  │ 4. Genera URL prefirmada (válida 1 hora)                │ │
│  │ 5. Retorna { audioUrl, expiresIn: 3600 }               │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
    ┌────────┐          ┌────────┐        ┌─────────┐
    │ Polly  │          │   S3   │        │DynamoDB │
    │(síntesis)         │(audio) │        │(producto)
    └────────┘          └────────┘        └─────────┘
     - Engine: neural     - Privado          - Lee descripción
     - VoiceId: Lupe      - CORS NO          - Actualiza timestamps
     - OutputFormat: mp3  - URL prefirmada
```

---

## 🧠 Conceptos clave

### 1. **TTS vs. STT: Opuestos**

| | TTS | STT |
|---|---|---|
| **Qué hace** | Texto → Voz (synthesis) | Voz → Texto (transcription) |
| **Servicio AWS** | Polly | Transcribe |
| **Entrada** | "Zapatillas azules" | 🎙️ audio.mp3 |
| **Salida** | 🎧 mp3 audio | "Zapatillas azules" |
| **S05** | ✅ Aquí usamos Polly | No |

**Gotcha común en examen:** "Necesito convertir reseñas a voz" = Polly (TTS). "Necesito transcribir un video de demo" = Transcribe (STT). No confundirlos cuesta puntos.

### 2. **Voces neuronales vs. estándar**

```
Estándar: "Zapatillas azules." (robótico, sintético)
  └─ Barato, rápido, obvio que es IA

Neuronal: "Zapatillas azules..." (suena natural, con entonación)
  └─ Un poco más caro, suena como una persona real
```

Para e-commerce, **neuronal siempre es mejor** (experiencia de usuario). Polly te deja elegir per-invocación:
- `Engine="standard"` → más barato, suena menos natural
- `Engine="neural"` → más natural, costo medio

### 3. **URL prefirmada: patrón de seguridad**

¿Por qué no dejar el MP3 público en S3?
- ❌ Malo: cualquiera puede listar todos los audios, descargarlos, alojarlos en otro lado
- ✅ Bien: URL privada, válida 1 hora, imposible de adivinar

```python
presigned_url = s3_client.generate_presigned_url(
    'get_object',
    Params={'Bucket': AUDIO_BUCKET, 'Key': key},
    ExpiresIn=3600  # 1 hora
)
# Resultado: https://bucket.s3.amazonaws.com/audio/xyz.mp3?X-Amz-Signature=...
# Solo funciona 1 hora. Después: AccessDenied.
```

### 4. **SSML: control fino de la voz (opcional)**

Polly acepta **SSML** (Speech Synthesis Markup Language) para controlar pausas, énfasis, pronunciación:

```xml
<speak>
  Zapatillas <emphasis>premium</emphasis> de cuero genuino.
  <break time="500ms"/>
  Disponibles en azul y blanco.
</speak>
```

Para S05 mantenemos simple (sin SSML), pero es importante saber que existe.

### 5. **Regla de ciclo de vida: FinOps**

```yaml
LifecycleConfiguration:
  Rules:
    - ExpirationInDays: 7  # El MP3 se borra solo después de 7 días
```

¿Por qué? Porque el audio se regenera cada vez que el cliente lo pide (o lo cachea el navegador). No hay razón para guardar 1000 MP3s permanentemente — es desperdicio y $ innecesario.

---

## 🔄 Flujo de código paso a paso

**Archivo:** `sessions/S05-polly-voice/functions/synthesize-voice/app.py`

### Paso 1: Recibir el request
```python
def lambda_handler(event, context):
    # event.rawPath = "/products/8e701adc-af8d-4882-994d-6e2237e98ec4/voice"
    # event.body = '{"lang":"es"}'
    
    product_id = extract_id_from_path(event['rawPath'])  # 8e701adc-...
    body = json.loads(event['body'] or '{}')
    lang = body.get('lang', 'es')  # "es" o "en"
```

### Paso 2: Leer producto de DynamoDB
```python
response = dynamodb.get_item(
    TableName=PRODUCTS_TABLE,
    Key={'productId': {'S': product_id}}
)
product = response.get('Item', {})
description = product.get('description', {}).get('S', '')
```

### Paso 3: Elegir voz según idioma
```python
if lang == 'es':
    voice_id = 'Lupe'        # Voz femenina española neuronal
    engine = 'neural'
elif lang == 'en':
    voice_id = 'Joanna'      # Voz femenina americana neuronal
    engine = 'neural'
else:
    return _response(400, {'error': 'lang debe ser es o en'})
```

### Paso 4: Llamar a Polly.SynthesizeSpeech
```python
polly_client = boto3.client('polly')

response = polly_client.synthesize_speech(
    Text=description,
    OutputFormat='mp3',           # Formato de salida
    VoiceId=voice_id,             # 'Lupe' o 'Joanna'
    Engine=engine                 # 'neural' para naturalidad
)

audio_stream = response['AudioStream'].read()  # bytes del MP3
```

### Paso 5: Subir a S3
```python
s3_client = boto3.client('s3')
key = f"audio/{product_id}-{lang}.mp3"

s3_client.put_object(
    Bucket=AUDIO_BUCKET,
    Key=key,
    Body=audio_stream,
    ContentType='audio/mpeg'
)
```

### Paso 6: Generar URL prefirmada
```python
presigned_url = s3_client.generate_presigned_url(
    'get_object',
    Params={'Bucket': AUDIO_BUCKET, 'Key': key},
    ExpiresIn=3600  # Válida 1 hora
)
```

### Paso 7: Retornar respuesta
```python
return _response(200, {
    'productId': product_id,
    'lang': lang,
    'voice': voice_id,
    'audioUrl': presigned_url,
    'expiresIn': 3600
})
```

---

## 🌍 Ejemplo real: producto en español e inglés

**Producto en DynamoDB:**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "name": "Vestido midi floral",
  "description": "Vestido midi con estampado floral, manga corta, tela de gasa premium."
}
```

**CURL S05 (español):**
```bash
URL=$(aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='SynthesizeVoiceUrl'].OutputValue" --output text)

curl -s -X POST "${URL%/}/products/8e701adc-af8d-4882-994d-6e2237e98ec4/voice" \
  -H "Content-Type: application/json" -d '{"lang":"es"}' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
  "lang": "es",
  "voice": "Lupe",
  "audioUrl": "https://techmoda-ai-jorge-damian-diaz-v2-audio.s3.amazonaws.com/audio/8e701adc-af8d-4882-994d-6e2237e98ec4-es.mp3?X-Amz-Signature=...",
  "expiresIn": 3600
}
```

**Reproducir en navegador:**
1. Copia la URL del `audioUrl`
2. Pégala en una nueva pestaña → descarga o reproduce
3. Escuchas: "Vestido midi con estampado floral, manga corta, tela de gasa premium." (voz natural de Lupe)

**Con S04 (traducción) + S05 (voz):**
```bash
# Primero traducir a inglés (S04)
curl -s -X POST "${TRANSLATE_URL%/}/products/8e701adc-.../translate" \
  -d '{"target":"en"}' | jq .

# Luego generar voz inglesa (S05)
curl -s -X POST "${VOICE_URL%/}/products/8e701adc-.../voice" \
  -d '{"lang":"en"}' | jq .audioUrl | xargs curl -o producto-en.mp3
```

---

## 📚 Conceptos D1 del examen

### ✅ Qué evalúa D1 aquí

1. **Polly = TTS.** "Convertir descripción a voz" → Polly, no Bedrock (determinismo, costo). "Transcribir un podcast" → Transcribe, no Polly.

2. **Voces neuronales vs. estándar.** Saber que existen, cuándo usarlas (neuronales para UX, estándar para demo rápida).

3. **SSML opcional.** Que exista es suficiente para el examen; implementarlo es bonus.

4. **Accesibilidad como Responsible AI (D4).** TTS es un control de inclusión — amplía el acceso a personas con diferentes discapacidades. El examen toca esto.

5. **Seguridad de artefactos generados (D5).** URL prefirmada vs. bucket público — es el patrón seguro de entrega de contenido dinámico.

### ❌ Trampas comunes

- "Polly entiende el contenido" → **NO.** Polly **pronuncia**, no entiende. Eso es diferencia con Comprehend (que sí entiende).
- "URL prefirmada = acceso público" → **NO.** Es privado, temporal, imposible de adivinar.
- "Polly es igual que Bedrock para TTS" → **NO.** Polly es determinista y barato. Bedrock es más flexible pero más caro.

---

## 💸 Costos

| Servicio | Unidad | Costo aprox. |
|---|---|---|
| **Polly (voz neuronal)** | por millón de caracteres | $16 USD |
| **Polly (voz estándar)** | por millón de caracteres | $4 USD |
| **S3 almacenamiento** | por GB/mes | $0.023 USD |

**Cálculo para S05:**
- 100 productos × 200 caracteres c/u = 20,000 caracteres = **$0.32** (muy barato)
- Regla de ciclo de vida (borra a los 7 días) → no se acumula almacenamiento

**Capa gratuita:** Polly incluye 5 millones de caracteres/mes en capa gratuita los primeros 12 meses (verificar vigencia).

---

## ❓ FAQ

### P1: ¿Qué pasa si el producto no tiene descripción?
R: Polly recibe un string vacío y genera silencio (~1 segundo). Mejor validar primero:
```python
if not description.strip():
    return _response(400, {'error': 'producto sin descripcion'})
```

### P2: ¿Puedo generar audio en otros idiomas?
R: Sí, Polly soporta +40 idiomas. Pero mantuvimos ES/EN para el examen. Para agregar FR:
```python
elif lang == 'fr':
    voice_id = 'Celine'  # Voz francesa neuronal
```

### P3: La URL prefirmada expiró, ¿qué hago?
R: Vuelve a llamar a S05 — genera una URL nueva (válida 1 hora).

### P4: ¿Se puede cachear el MP3?
R: Sí. El frontend puede guardar la URL en localStorage y reutilizarla si no expiró. Polly garantiza que para el mismo texto siempre genera lo mismo (determinismo).

### P5: ¿Por qué 1 hora de expiración?
R: Compromiso: lo suficientemente larga para UX (usuario descarga/escucha), lo suficientemente corta para no quedar vulnerable indefinidamente si la URL se filtra.

### P6: ¿Polly maneja puntuación bien?
R: Sí, entiende comillas, puntos, guiones. SSML es si querés control fino (ej. "Pausa 1 segundo aquí").

### P7: ¿Se puede generar varias voces simultáneamente?
R: Sí, la Lambda es rápida (~2-3 seg). Si necesitás 1000 productos en paralelo, usa Step Functions o SQS.

### P8: ¿Diferencia entre Polly on-demand vs. Polly v2?
R: En S05 usamos on-demand (sin suscripción). V2 es para casos de altísimo volumen. Para el examen, on-demand es suficiente.

---

## 🔐 IAM: mínimo privilegio

**Políticas que SAM crea automáticamente:**

```yaml
Policies:
  - DynamoDBCrudPolicy:        # Lee productos (GetItem)
      TableName: !Ref ProductsTable
  - Statement:
      Action: polly:SynthesizeSpeech
      Resource: "*"             # Polly no admite ARN de recurso
  - S3CrudPolicy:               # PutObject + GeneratePresignedUrl
      BucketName: !Ref AudioBucket
```

**¿Por qué `Resource: "*"` en Polly?**
Polly es un servicio **gestionado** — no tiene "recursos" en ARN como un objeto S3 o tabla DDB. Solo ofrece acciones (`synthesize_speech`, etc.). AWS no permite ARNs de recurso para Polly.

**¿Qué permisos tiene la Lambda?**
- ✅ `polly:SynthesizeSpeech` en cualquier idioma/voz
- ✅ `s3:PutObject` en el bucket de audio
- ✅ `s3:GeneratePresignedUrl` (implícito en S3CrudPolicy)
- ✅ DynamoDB CRUD en ProductsTable
- ❌ Sin acceso a otros buckets, roles, datos del usuario, etc.

---

## ✅ Checklist de validación

Antes de marcar S05 como "completo":

- [ ] Deploy exitoso: `sam deploy` completó sin errores
- [ ] Output `SynthesizeVoiceUrl` aparece en CloudFormation
- [ ] Curl POST a `/products/<PRODUCT_ID>/voice` con `{"lang":"es"}` retorna JSON válido
- [ ] El `audioUrl` es una URL HTTPS válida (termina en `?X-Amz-...`)
- [ ] El MP3 se descarga/reproduce en navegador o reproductor
- [ ] El audio suena natural (voz Lupe, no robótica)
- [ ] `{"lang":"en"}` también funciona (voz Joanna)
- [ ] El bucket `<stack>-audio` existe y **NO es público**
- [ ] El objeto `audio/<PRODUCT_ID>-<lang>.mp3` está en S3
- [ ] Probaste en DynamoDB que el producto tiene los campos esperados
- [ ] La URL prefirmada **expira después de 1 hora** (prueba esperando)

---

## 🧹 Cleanup (si necesitas borrar S05)

```bash
# Vaciar bucket de audio (CloudFormation no borra buckets con objetos)
aws s3 rm s3://techmoda-ai-jorge-damian-diaz-v2-audio --recursive

# Quitar de template.yaml:
# - AudioBucket
# - SynthesizeVoiceFunction
# - SynthesizeVoiceUrl (output)

sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --no-confirm-changeset
```

---

## 🎓 Resumen: qué entrará en el examen

✅ **Polly = TTS** (texto → voz)  
✅ **Transcribe = STT** (voz → texto)  
✅ **Voces neuronales > estándar** para UX  
✅ **SSML** existe para control fino  
✅ **Accesibilidad** como Responsible AI  
✅ **URL prefirmada** = patrón seguro  
✅ **Determinismo:** Polly siempre genera lo mismo para el mismo input  
✅ **Composición de servicios:** S05 solo usa Polly, pero en apps reales se combina con S04 (traducción) + S05 (voz)

---

**Siguiente:** S06 · Bedrock (generación de texto con LLM)
