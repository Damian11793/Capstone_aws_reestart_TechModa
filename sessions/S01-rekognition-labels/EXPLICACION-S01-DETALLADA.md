# S01 — Explicación Detallada: Auto-etiquetado de Imágenes con Rekognition

> Esta guía está hecha para quienes recién empiezan con IA en AWS. Si ya conocés los conceptos, saltá a la sección que necesites.

---

## 📚 Tabla de Contenidos

1. [¿Qué es S01?](#qué-es-s01)
2. [Los Servicios AWS Involucrados](#los-servicios-aws-involucrados)
3. [La Arquitectura en Detalle](#la-arquitectura-en-detalle)
4. [Flujo Paso a Paso](#flujo-paso-a-paso)
5. [Los Permisos IAM (Mínimo Privilegio)](#los-permisos-iam-mínimo-privilegio)
6. [Qué Pasó Cuando Ejecutamos los Comandos](#qué-pasó-cuando-ejecutamos-los-comandos)
7. [Conceptos Clave para el Examen](#conceptos-clave-para-el-examen)

---

## ¿Qué es S01?

**S01 es la primera sesión de IA del capstone.** Toma un **producto de TechModa** (una prenda de ropa), le saca una **foto**, y automáticamente **genera etiquetas** (labels) que describen qué hay en la imagen: "Ropa", "Vestido", "Color azul", etc.

**Antes de S01:** Los productos necesitaban etiquetas escritas a mano.  
**Después de S01:** El sistema detecta automáticamente etiquetas al subir la imagen.

### ¿Para qué sirve?

- **Búsqueda mejorada:** Un cliente busca "vestido rojo" y encuentra todos los vestidos etiquetados automáticamente.
- **Filtros de catálogo:** "Mostrar solo ropa deportiva" funciona porque Rekognition detectó esa etiqueta.
- **Control de calidad:** Si la foto es borrosa o no muestra ropa, Rekognition lo va a notar (baja confianza).

---

## Los Servicios AWS Involucrados

### 1. **Amazon Rekognition** — Visión Artificial Preentrenada

**¿Qué es?**
Es un servicio de AWS que **ya tiene un modelo entrenado** para analizar imágenes. No necesitás entrenar nada; solo le pasás una imagen y te devuelve lo que ve.

**¿Qué hace Rekognition?**
- `DetectLabels`: Identifica objetos, escenas, conceptos. ("Veo una Persona, un Vestido, Flores...")
- `DetectModerationLabels`: Detecta contenido inapropiado. (Lo verás en S02.)
- `DetectText`: Lee texto dentro de imágenes.
- `DetectFaces`: Detecta rostros y sus características.

**Para S01 usamos: `DetectLabels`**

**Costo:** Se cobra **por imagen procesada**. Una imagen cuesta ~$0.001–$0.002 USD (centavos).

**¿Por qué NO entrenar un modelo propio?**
- Entrenamiento requiere **miles de fotos etiquetadas** (dataset).
- Requiere **GPUs caras** y horas de cómputo.
- Rekognition ya está entrenado con **millones de imágenes** y es más preciso.

### 2. **AWS Lambda** — Código Ejecutable bajo Demanda

**¿Qué es?**
Un servicio que ejecuta código **solo cuando se lo pide**, sin que tengas que administrar servidores.

**¿Cómo funciona?**
1. Alguien llama a la Lambda (vía HTTP, una cola de mensajes, etc.).
2. AWS inicia la función en menos de 1 segundo.
3. Tu código corre.
4. Termina y se apaga.
5. Pagas solo por el tiempo que estuvo corriendo.

**Para S01 usamos:**
- **Lenguaje:** Python 3.12
- **Qué hace:** Lee un producto de DynamoDB → llama a Rekognition → escribe las etiquetas de vuelta.
- **URL pública:** Lambda Function URL (sin API Gateway).

**Ventaja:** Pago por uso. Si nadie etiqueta imágenes, **no pago nada**. Si 1.000 personas lo hacen, se escala solo.

### 3. **Amazon DynamoDB** — Base de Datos NoSQL

**¿Qué es?**
Una base de datos administrada donde guardamos **productos** y sus **etiquetas**.

**Estructura:**
```
ProductoID: 8e701adc-af8d-4882-994d-6e2237e98ec4
  ├─ name: "Tenis blancos minimalistas"
  ├─ price: 74.5
  ├─ imageUrl: "s3://bucket/assets/tenis.jpg"
  ├─ stock: 25
  └─ aiLabels: ["Footwear", "Shoe", "Apparel", "White"]  ← Lo que Rekognition detectó
```

**¿Por qué DynamoDB y no SQL?**
- DynamoDB es **serverless**: No administrás servidores.
- Escala automáticamente.
- Pago por lectura/escritura (bajo volumen = gratis).

### 4. **Amazon S3** — Almacenamiento de Archivos

**¿Qué es?**
Un depósito de archivos en la nube. Guardamos las **imágenes de los productos** acá.

**Para S01:**
- Subimos la imagen a S3.
- Rekognition la lee desde S3 (no la descargamos localmente).
- La Lambda tiene permiso de leer solo del bucket de TechModa.

---

## La Arquitectura en Detalle

### Diagrama del Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO (vos)                           │
│  Ejecutas: curl POST /products/{id}/labels                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         LAMBDA FUNCTION URL (EnrichLabelsFunction)              │
│  ├─ Lenguaje: Python 3.12                                       │
│  ├─ Trigger: HTTP POST a /products/{id}/labels                 │
│  └─ Rol IAM: Mínimo privilegio (solo lo que necesita)           │
└────────┬──────────────────────┬──────────────────────┬──────────┘
         │                      │                      │
         ▼ Lee                  ▼ Lee imagen           ▼ Escribe
    ┌─────────────┐      ┌────────────────┐    ┌─────────────┐
    │  DynamoDB   │      │   S3 Bucket    │    │  DynamoDB   │
    │  (productos)│      │  (imágenes)    │    │  (labels)   │
    └─────────────┘      └────────────────┘    └─────────────┘
                               │
                               │ Pasa a Rekognition
                               ▼
                      ┌──────────────────────┐
                      │  Amazon Rekognition  │
                      │  (DetectLabels)      │
                      └──────────────────────┘
                               │
                               │ Devuelve etiquetas
                               ▼
                        ["Clothing", "Dress", ...]
```

### ¿Quién Habla con Quién?

1. **Vos** → Lambda (HTTP POST)
2. **Lambda** → DynamoDB (busca el producto)
3. **Lambda** → S3 (obtiene la URL de la imagen)
4. **Lambda** → Rekognition (analiza la imagen)
5. **Lambda** → DynamoDB (guarda las etiquetas)

**Importante:** La Lambda es la **orquestadora**. Todo pasa dentro de ella.

---

## Flujo Paso a Paso

### 1. **Preparación: Agregar la Lambda al Template**

**¿Qué hicimos?**
Abrimos `template.yaml` y pegamos la definición de `EnrichLabelsFunction`. Este archivo es como el "plano" de toda la infraestructura.

**¿Qué significa cada parte?**

```yaml
EnrichLabelsFunction:
  Type: AWS::Serverless::Function           # Es una Lambda
  Properties:
    FunctionName: !Sub ${AWS::StackName}-EnrichLabels
                                             # Nombre: techmoda-ai-jorge-...-EnrichLabels
    CodeUri: sessions/S01-rekognition-labels/functions/enrich-labels
                                             # Código: dónde está app.py
    Handler: app.lambda_handler              # Función: app.py, función lambda_handler()
    Runtime: python3.12                      # Lenguaje: Python 3.12
    Environment:
      Variables:
        LABEL_MIN_CONFIDENCE: "80"           # Solo etiquetas con confianza >= 80%
        LABEL_MAX_LABELS: "15"               # Máximo 15 etiquetas
    FunctionUrlConfig:
      AuthType: NONE                         # Sin autenticación (abierto)
      Cors: [...]                            # Permite llamadas desde navegador
```

### 2. **Deploy: Construir y Desplegar**

**Comando:**
```bash
sam build
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 ...
```

**¿Qué pasó?**
- `sam build`: Empaquetó el código Python + dependencias.
- `sam deploy`: Creó la Lambda en AWS, asignó un rol IAM, expuso la Function URL.

**Resultado:** Una URL pública que podés llamar:
```
https://abc123def456.lambda-url.us-east-1.on.aws/products/{id}/labels
```

### 3. **Ejecutar: Llamar a la Lambda**

**Comando:**
```bash
curl -X POST "https://.../products/8e701adc.../labels"
```

**¿Qué pasó adentro?**

#### Paso 3a: Lambda recibe la solicitud
```
Event (JSON): {
  "requestContext": { "http": { "method": "POST", "path": "/products/8e701adc.../labels" } },
  "body": null
}
```

#### Paso 3b: Lambda extrae el productId
```python
productId = "8e701adc-af8d-4882-994d-6e2237e98ec4"  # Del path
```

#### Paso 3c: Lambda consulta DynamoDB
```python
response = dynamodb.get_item(
    TableName='techmoda-ai-jorge-damian-diaz-v2-Products',
    Key={'productId': {'S': productId}}
)
product = response['Item']  # Obtiene: {"name": "...", "imageUrl": "s3://...", ...}
```

#### Paso 3d: Lambda valida que hay imagen
```python
if 'imageUrl' not in product or not product['imageUrl']:
    raise Exception("El producto no tiene una imageUrl válida")
```

#### Paso 3e: Lambda llama a Rekognition
```python
rekognition_client.detect_labels(
    Image={'S3Object': {'Bucket': 'techmoda-ai-jorge-damian-diaz-v2-frontend', 'Name': 'assets/...'}},
    MinConfidence=80,
    MaxLabels=15
)
```

**¿Qué hace Rekognition internamente?**
1. Lee la imagen desde S3.
2. Pasa la imagen por su modelo neuronal (entrenado con millones de fotos).
3. Devuelve objetos detectados + confianza (0–100%).

**Respuesta de Rekognition:**
```json
{
  "Labels": [
    {"Name": "Animal", "Confidence": 99.31},
    {"Name": "Insect", "Confidence": 99.31},
    {"Name": "Invertebrate", "Confidence": 99.31},
    {"Name": "Ant", "Confidence": 95.9}
  ]
}
```

#### Paso 3f: Lambda filtra por confianza
```python
labels = [L["Name"] for L in response["Labels"] if L["Confidence"] >= 80]
# Resultado: ["Animal", "Insect", "Invertebrate", "Ant"]
```

#### Paso 3g: Lambda guarda en DynamoDB
```python
dynamodb.update_item(
    TableName='techmoda-ai-jorge-damian-diaz-v2-Products',
    Key={'productId': {'S': productId}},
    UpdateExpression='SET aiLabels = :labels',
    ExpressionAttributeValues={':labels': {'SS': labels}}
)
```

El producto ahora tiene: `aiLabels: ["Animal", "Insect", "Invertebrate", "Ant"]`

#### Paso 3h: Lambda devuelve respuesta al usuario
```json
{
  "productId": "8e701adc...",
  "imageSource": "s3",
  "minConfidence": 80.0,
  "labels": [
    {"name": "Animal", "confidence": 99.31},
    ...
  ]
}
```

---

## Los Permisos IAM (Mínimo Privilegio)

### ¿Qué es IAM?

**IAM = Identity and Access Management.** Es el servicio de AWS que controla **quién puede hacer qué**.

En este capstone, cada Lambda **declara explícitamente qué permisos necesita**. AWS le crea un **rol de mínimo privilegio**.

### Los 3 Permisos de S01

```yaml
Policies:
  # 1. Leer y escribir en DynamoDB
  - DynamoDBCrudPolicy:
      TableName: !Ref ProductsTable

  # 2. Llamar a Rekognition DetectLabels
  - Statement:
      - Effect: Allow
        Action: rekognition:DetectLabels
        Resource: "*"

  # 3. Leer imágenes del bucket (solo de este stack)
  - Statement:
      - Effect: Allow
        Action: s3:GetObject
        Resource: !Sub arn:${AWS::Partition}:s3:::${AWS::StackName}-*/*
```

### ¿Por Qué Esto es Seguro?

**Imagina:** La Lambda está "hackeada" y alguien toma control. ¿Qué puede hacer?

| Permiso | ¿Qué PUEDE hacer? | ¿Qué NO puede hacer? |
|---------|-------------------|---------------------|
| DynamoDB CRUD | Leer/escribir la tabla de productos | Acceder a otras tablas de tu cuenta |
| Rekognition DetectLabels | Analizar imágenes | Entrenar modelos, borrar modelos |
| S3 GetObject (stack-*) | Leer imágenes del bucket `techmoda-ai-*` | Acceder a otros buckets, subir archivos |

**Resultado:** Aunque la Lambda esté comprometida, el daño es limitado. Esto es **mínimo privilegio**.

### ¿Por Qué `Resource: "*"` para Rekognition?

Rekognition **no soporta ARNs específicos de recursos**. No podés decir "solo analizar imágenes de este bucket". Por eso AWS recomienda:
- Limitar por **acción** (`DetectLabels`, no `rekognition:*`).
- Confiar en el **bucket S3** como control de acceso (la Lambda solo puede leer del bucket del stack).

---

## Qué Pasó Cuando Ejecutamos los Comandos

### Paso 1: Subir Imagen a S3

```bash
aws s3 cp /tmp/test-image.jpg s3://techmoda-ai-jorge-damian-diaz-v2-frontend/assets/test-image.jpg
```

**¿Qué pasó?**
- AWS S3 creó un objeto en el bucket `techmoda-ai-jorge-damian-diaz-v2-frontend`.
- Ruta: `assets/test-image.jpg`.
- Tamaño: ~varios KB (depende de la foto).
- URL accesible: `s3://techmoda-ai-jorge-damian-diaz-v2-frontend/assets/test-image.jpg`.

### Paso 2: Actualizar Producto

```bash
curl -X PUT "https://.../products/8e701adc.../label" \
  -d '{"imageUrl": "s3://techmoda-ai-jorge-damian-diaz-v2-frontend/assets/test-image.jpg"}'
```

**¿Qué pasó?**
- El router CRUD (S0) recibió la solicitud PUT.
- Actualizó el producto en DynamoDB: `imageUrl` → `s3://...test-image.jpg`.

### Paso 3: Llamar a S01 (Rekognition)

```bash
curl -X POST "https://.../products/8e701adc.../labels"
```

**¿Qué pasó?** (Ya explicado arriba en detalle.)

**Resultado:**
```json
{
  "labels": [
    {"name": "Animal", "confidence": 99.31},
    {"name": "Insect", "confidence": 99.31},
    ...
  ]
}
```

### Paso 4: Verificar DynamoDB

```bash
aws dynamodb get-item --table-name techmoda-ai-jorge-damian-diaz-v2-Products \
  --key '{"productId":{"S":"8e701adc..."}}'
```

**¿Qué pasó?**
- AWS DynamoDB buscó el producto.
- Devolvió: `aiLabels: ["Animal", "Insect", "Invertebrate", "Ant"]`.

---

## Conceptos Clave para el Examen

### 1. **Inferencia vs. Entrenamiento**

| Aspecto | S01 | Si Fuera Entrenamiento |
|--------|-----|------------------------|
| ¿Qué haces? | Pasás imágenes a un modelo ya hecho | Crearías un modelo propio |
| Dataset | No necesita | Miles de imágenes etiquetadas |
| Tiempo | Segundos | Horas/días |
| Costo | Centavos por imagen | Centavos por GPU-hora |
| Precisión | Alta (AWS lo entrenó bien) | Depende de tu dataset |

**S01 = INFERENCIA** (usar un modelo existente).

### 2. **Confianza y Umbrales**

Rekognition devuelve:
```json
{"Name": "Clothing", "Confidence": 87.5}
```

**Confianza** = probabilidad (0–100%) de que el sistema está seguro.

**Umbral** = decisión: "¿Aceptar solo si confidence > X?"

En S01: `MinConfidence: 80` → Solo etiquetas con ≥80% confianza.

**Trade-off:**
- Umbral alto (95%) → Pocas etiquetas, pero muy precisas.
- Umbral bajo (60%) → Muchas etiquetas, pero ruidosas.

### 3. **Servicio Administrado vs. DIY**

| Rakognition (Administrado) | SageMaker Propio |
|---------------------------|-----------------|
| AWS lo mantiene | Vos lo mantienes |
| Modelo ya entrenado | Entrenarías el tuyo |
| Escalable automáticamente | Escalas manualmente |
| Pagás por uso | Pagás por instancia |
| Bajo costo para bajo volumen | Alto costo fijo |

**Para moda, Rekognition es la opción correcta** (administrado + preentrenado).

### 4. **Arquitectura Serverless**

S01 usa:
- **Lambda** (sin servidores): Código bajo demanda.
- **DynamoDB** (sin servidores): Base de datos bajo demanda.
- **Rekognition** (servicio administrado): No hay infra.
- **S3** (sin servidores): Almacenamiento bajo demanda.

**Resultado:** Escalas automáticamente, pagas solo por lo que usas.

### 5. **Mínimo Privilegio**

Cada Lambda lleva:
```yaml
Policies:
  - DynamoDBCrudPolicy: [solo esta tabla]
  - rekognition:DetectLabels [solo esta acción]
  - s3:GetObject: [solo este bucket]
```

**Para el examen:** Esto es **D5 (Security, 20%)**. Si ves "¿qué permisos debe tener?", la respuesta es siempre la **mínima necesaria**.

---

## Resumen: De Principio a Fin

1. **Creaste una Lambda** (Python) que orquesta el análisis.
2. **Deployaste con SAM** (AWS te creó el rol IAM).
3. **Subiste una imagen** a S3.
4. **Actualizaste un producto** con la URL.
5. **Llamaste a Rekognition** desde la Lambda.
6. **Rekognition analizó** la imagen (modelo preentrenado).
7. **Guardaste las etiquetas** en DynamoDB.
8. **Verificaste** que todo funcionó.

**Servicios usados:**
- ✅ Lambda (ejecución)
- ✅ Rekognition (IA/visión)
- ✅ DynamoDB (almacenamiento)
- ✅ S3 (imágenes)
- ✅ IAM (permisos)
- ✅ CloudFormation (infraestructura como código)

**Conceptos cubiertos:**
- ✅ Inferencia (usar IA preentrenada)
- ✅ Confianza/umbrales
- ✅ Servicio administrado
- ✅ Mínimo privilegio
- ✅ Arquitectura serverless

---

## Preguntas Frecuentes

### ¿Qué pasa si subo una foto que no es de ropa?

Rekognition la analiza igual. Devolvería etiquetas como `["Animal", "Insect"]` (como pasó con nuestra hormiga). El control de calidad depende de:
- Confianza: Si no ve bien, baja la confianza.
- Revisión humana: Un moderador podría revisar antes de que se publique.

### ¿Puedo usar Rekognition desde mi laptop?

Sí, necesitarías las credenciales AWS y:
```python
import boto3
rekognition = boto3.client('rekognition')
rekognition.detect_labels(Image={'S3Object': {...}})
```

Pero en S01 lo hacemos desde Lambda porque es más seguro (el rol IAM controla qué puede hacer).

### ¿Qué pasa si la imagen es muy grande?

Rekognition tiene límites (máximo ~15 MB). Para imágenes más grandes, comprimirlas antes. En la práctica, las fotos de catálogo suelen ser <5 MB.

### ¿Rekognition se entrena con mis imágenes?

No. AWS usa tus imágenes solo para analizar. No entrena con ellas (a menos que optes explícitamente en los settings).

### ¿Cuánto cuesta S01?

- **Rekognition DetectLabels:** ~$0.001–$0.002 por imagen.
- **Lambda:** ~$0.0000002 por ms (muy barato).
- **DynamoDB:** ~$0.25 por millón de escrituras (muy barato).
- **S3:** Gratis si estás dentro del free tier.

**Para etiquetar 100 imágenes:** ~$0.15 USD (centavos).

---

## Siguientes Pasos

- **S02:** Moderación de imágenes (detectar contenido inapropiado).
- **S03:** Análisis de sentimiento en reseñas (Comprehend).
- **S04+:** Más servicios de IA.

Cada sesión agrega una Lambda nueva con su propia Function URL y permisos.

