# S07 · Búsqueda semántica / RAG sobre el catálogo (Bedrock embeddings) — Guía Detallada

**Nivel:** Intermedio-Avanzado · **Tiempo de lectura:** ~20 min · **Importancia:** 🔥 **28% del examen (D3)**

---

## ¿Qué es S07 y por qué es crítica?

Hasta ahora TechModa **busca por texto exacto** (si escribís "chaqueta", solo devuelve productos con la palabra "chaqueta"). S07 añade **búsqueda inteligente que entiende significado:** si buscás *"algo abrigado para el frío"*, te devuelve la chaqueta aunque no uses esa palabra.

**Impacto real:**
- 🔍 Búsqueda semántica (vs. keyword)
- 📚 Mecanismo de **RAG (Retrieval-Augmented Generation)** — crucial para chatbot (S08)
- 💡 Embeddings: el concepto más importante de D3

**Por qué importa para el examen:**
- **D3 (Applications):** 28% del examen. Embeddings + RAG es la base de aplicaciones modernas de IA.
- **Vector databases:** concepto fundamental en producción

---

## 🧠 Concepto clave: Embeddings

### ¿Qué es un embedding?

Un **embedding** es un **vector (lista de números)** que representa el **significado** de un texto.

```
Texto: "Chaqueta abrigada de invierno"
            ↓
Embedding: [-0.23, 0.45, -0.12, 0.89, ..., 0.04]  (1024 dimensiones, ej)
            ↑
         Vector numérico = "firma" del significado
```

**La magia:** textos con significado parecido producen vectores **cercanos en el espacio vectorial.**

```
"Chaqueta abrigada"      ← embedding A
    \
     \  (cercano)
      \
       → "Abrigo de invierno"  ← embedding B
       /  (cercano)
      /
     /
"Zapatos deportivos"     ← embedding C (lejano)
```

### Similitud Coseno: medir cercanía

Para medir qué tan similar es consulta A vs producto B, usamos **similitud coseno:**

```
similaridad = cos(ángulo entre vector A y vector B)

Rango: -1 (opuesto) a +1 (idéntico)
Práctica: 0.0 a 1.0 (normalizamos a positivo)
```

**Interpretación:**
- `score = 1.0` → textos idénticos en significado
- `score = 0.8` → muy parecidos
- `score = 0.5` → algo parecidos
- `score = 0.2` → poco parecidos
- `score = 0.0` → sin relación

---

## 🏗️ Arquitectura: Indexación + Búsqueda

```
┌─────────────────────────────────────────────────────────────┐
│           TechModa Catálogo (4 productos)                   │
│  - Vestido midi floral                                      │
│  - Chaqueta de mezclilla oversize                           │
│  - Zapatos deportivos                                       │
│  - Cinturón de cuero genuino                                │
└─────────────────────────────────────────────────────────────┘
             │
             ↓ (UNA SOLA VEZ)
    ┌────────────────────────────┐
    │   FASE 1: INDEXACIÓN       │
    │  (IndexEmbeddings Lambda)  │
    └────────────────────────────┘
             │
    Para cada producto:
    1. Lee atributos (name, category, price, aiLabels de S1)
    2. Arma "documento" (texto a vectorizar)
    3. Llama a Bedrock.embed_text()
    4. Recibe vector (1024 dimensiones)
    5. Guarda en DynamoDB: { productId, embedding, embeddingDim }
             │
             ↓
    ┌────────────────────────────┐
    │    DYNAMODB (indexado)     │
    │  Producto A → embedding A  │
    │  Producto B → embedding B  │
    │  Producto C → embedding C  │
    │  Producto D → embedding D  │
    └────────────────────────────┘

=====================================================================

    ┌────────────────────────────┐
    │   FASE 2: BÚSQUEDA         │
    │  (Por cada consulta)       │
    └────────────────────────────┘
             │
    Consulta: "algo abrigado para el frío"
             │
    1. Embede la consulta → embedding Q
    2. Calcula coseno(Q, embedding A)
    3. Calcula coseno(Q, embedding B)
    4. Calcula coseno(Q, embedding C)
    5. Calcula coseno(Q, embedding D)
    6. Ordena por score descendente
    7. Retorna top 5 (configurable)
             │
             ↓
    Resultado:
    - Chaqueta: 0.62 ✅ (más parecido)
    - Abrigo (si existiera): 0.59
    - Vestido: 0.41
    - Zapatos: 0.28
    - Cinturón: 0.15 (menos parecido)
```

---

## 🔄 Flujo de código paso a paso

### FASE 1: IndexEmbeddings

**Archivo:** `sessions/S07-bedrock-rag-busqueda/functions/index-embeddings/app.py`

#### Paso 1: Leer todos los productos
```python
def lambda_handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(PRODUCTS_TABLE)
    
    # Scan sin filtro = trae todo
    response = table.scan()
    items = response.get('Items', [])
```

#### Paso 2: Para cada producto, armar documento
```python
for item in items:
    product_id = item['productId']
    name = item.get('name', '')
    category = item.get('category', '')
    price = item.get('price', '')
    ai_labels = item.get('aiLabels', [])  # de S1
    
    # Documento = concatenación de atributos
    document = f"{name} {category} {price} {' '.join(ai_labels)}"
    # Ejemplo: "Chaqueta de mezclilla oversize Chaquetas 89.0 oversize denim jacket"
```

#### Paso 3: Embeder con Bedrock
```python
bedrock = boto3.client('bedrock-runtime')

response = bedrock.invoke_model(
    modelId=BEDROCK_MODEL_ID,  # "amazon.titan-embed-text-v2:0"
    contentType='application/json',
    body=json.dumps({'inputText': document})
)

embedding_response = json.loads(response['body'].read())
embedding = embedding_response['embedding']  # lista de 1024 números
```

#### Paso 4: Guardar embedding en DynamoDB
```python
table.update_item(
    Key={'productId': product_id},
    UpdateExpression='SET #emb = :embedding, embeddingDim = :dim',
    ExpressionAttributeNames={'#emb': 'embedding'},
    ExpressionAttributeValues={
        ':embedding': json.dumps(embedding),  # guardamos como string JSON
        ':dim': len(embedding)
    }
)
```

#### Paso 5: Retornar resultado
```python
return _response(200, {
    'indexed': len(indexed_ids),
    'skipped': len(items) - len(indexed_ids),
    'total': len(items),
    'model': BEDROCK_MODEL_ID
})
```

### FASE 2: SemanticSearch

**Archivo:** `sessions/S07-bedrock-rag-busqueda/functions/semantic-search/app.py`

#### Paso 1: Recibir query
```python
def lambda_handler(event, context):
    # event['queryStringParameters']['q'] = "algo abrigado para el frío"
    query = event.get('queryStringParameters', {}).get('q', '')
    
    if not query:
        return _response(400, {'error': 'q (query) requerido'})
```

#### Paso 2: Embeder la consulta
```python
bedrock = boto3.client('bedrock-runtime')

response = bedrock.invoke_model(
    modelId=BEDROCK_MODEL_ID,
    contentType='application/json',
    body=json.dumps({'inputText': query})
)

query_embedding = json.loads(response['body'].read())['embedding']
```

#### Paso 3: Leer todos los productos (con embedding)
```python
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(PRODUCTS_TABLE)

response = table.scan()
items = response.get('Items', [])

# Filtrar solo productos que ya tienen embedding
indexed_items = [item for item in items if 'embedding' in item]
```

#### Paso 4: Calcular similitud coseno para cada uno
```python
def cosine_similarity(vec_a, vec_b):
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    magnitude_a = (sum(a**2 for a in vec_a)) ** 0.5
    magnitude_b = (sum(b**2 for b in vec_b)) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)

# Calcular score para cada producto
results = []
for item in indexed_items:
    product_embedding = json.loads(item['embedding'])
    score = cosine_similarity(query_embedding, product_embedding)
    
    results.append({
        'productId': item['productId'],
        'name': item.get('name', ''),
        'category': item.get('category', ''),
        'price': item.get('price', 0),
        'score': score
    })
```

#### Paso 5: Ordenar por score descendente + limitar
```python
results.sort(key=lambda x: x['score'], reverse=True)
top_k = 5
results = results[:top_k]
```

#### Paso 6: Retornar
```python
return _response(200, {
    'query': query,
    'results': results
})
```

---

## 🌍 Ejemplo real: búsqueda semántica

**Catálogo indexado:**
```json
[
  {
    "productId": "8e701adc-af8d-4882-994d-6e2237e98ec4",
    "name": "Vestido midi floral",
    "category": "Vestidos",
    "price": 59.9,
    "embedding": "[-0.234, 0.456, ...]"  (1024 dims)
  },
  {
    "productId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Chaqueta de mezclilla oversize",
    "category": "Chaquetas",
    "price": 89.0,
    "embedding": "[0.123, -0.456, ...]"  (1024 dims)
  },
  ...
]
```

**Consulta 1: "algo abrigado para el frío"**
```bash
SEARCH_URL=...
curl -s "${SEARCH_URL%/}/search?q=algo%20abrigado%20para%20el%20frío" | python3 -m json.tool
```

**Resultado:**
```json
{
  "query": "algo abrigado para el frío",
  "results": [
    {
      "productId": "a1b2c3d4-...",
      "name": "Chaqueta de mezclilla oversize",
      "category": "Chaquetas",
      "price": 89.0,
      "score": 0.62  ✅ Primero (más relevante)
    },
    {
      "productId": "8e701adc-...",
      "name": "Vestido midi floral",
      "category": "Vestidos",
      "price": 59.9,
      "score": 0.41  (menos relevante)
    }
  ]
}
```

**Observación:** Sin indexación con embeddings, una búsqueda keyword por "abrigado" no devolvería la chaqueta (porque el nombre es "Chaqueta de mezclilla oversize", no contiene la palabra "abrigado"). Con embeddings, el modelo **entiende el significado** y la encontramos.

---

## 📚 Conceptos clave: RAG

### ¿Qué es RAG?

**RAG = Retrieval-Augmented Generation**

```
Flujo tradicional (sin RAG):
┌─────────────────────────────────────┐
│ LLM recibe consulta del usuario      │
│ LLM genera respuesta de su memoria   │
│ (puede alucinar si no sabe bien)    │
└─────────────────────────────────────┘

Flujo con RAG (lo que hace S08 + S07):
┌──────────────────────────────────────────────┐
│ 1. Consulta del usuario                      │
│ 2. Retriever (S07) busca documentos          │
│    relacionados usando embeddings            │
│ 3. Los documentos se pasan al LLM como       │
│    contexto ("tu fuente de verdad")          │
│ 4. LLM genera respuesta basada en contexto   │
│    (mucho menos riesgo de alucinación)       │
└──────────────────────────────────────────────┘
```

**Ventaja:** el LLM responde sobre **hechos reales del catálogo**, no sobre lo que cree recordar.

### Embeddings ≠ Generación

| Aspecto | Embeddings | Generación |
|---|---|---|
| **Qué hace** | Vectoriza texto | Genera texto |
| **Entrada** | Texto | Texto + instrucción |
| **Salida** | Vector (ej 1024 nums) | Texto legible |
| **Modelo** | Titan Embeddings V2 | Claude/Titan Text |
| **Uso** | Búsqueda, similitud | Q&A, resumen, chat |
| **S07** | ✅ Aquí | No |
| **S06** | No | ✅ Aquí |

---

## 🔐 IAM: mínimo privilegio + lectura vs escritura

**IndexEmbeddings:**
```yaml
Policies:
  - DynamoDBCrudPolicy:  # Necesita ESCRIBIR embeddings
      TableName: !Ref ProductsTable
  - Statement:
      Action: bedrock:InvokeModel
      Resource: arn:...bedrock:*::foundation-model/*
```

**SemanticSearch:**
```yaml
Policies:
  - DynamoDBReadPolicy:  # Solo LEE (no escribe nada)
      TableName: !Ref ProductsTable
  - Statement:
      Action: bedrock:InvokeModel
      Resource: arn:...bedrock:*::foundation-model/*
```

**Diferencia:** el buscador **solo lee** el catálogo indexado. No puede modificar nada. Es un principio de seguridad: privilegio mínimo.

---

## 💾 Vector Store: DynamoDB vs Producción

### En S07 (educativo): DynamoDB
```
DynamoDB: {
  productId: "abc",
  name: "Chaqueta",
  embedding: JSON.stringify([0.23, -0.45, ..., 0.89])
}
```

Ventajas: simplicidad, no necesita servicio adicional.
Desventajas: escala limitada, búsqueda lenta a 10M+ items.

### En producción: Vector Database
```
OpenSearch, Aurora pgvector, Bedrock Knowledge Bases, Pinecone, Weaviate
  → índices optimizados para búsqueda vectorial
  → fast approximate nearest neighbor (ANN)
  → millones de vectores en milisegundos
```

**Para el examen:** saber que existen, que S07 es educativo, que en prod se usan.

---

## 📊 Performance y limitaciones (por qué no escala infinitamente)

### Problema 1: Scan completo en cada búsqueda

La función `SemanticSearch` hace un **full table scan** de DynamoDB:

```python
response = table.scan()  # ← Lee TODOS los productos cada vez
```

| Catálogo | Tiempo aprox | Costo |
|---|---|---|
| 10 productos | < 100 ms | negligible |
| 1,000 productos | < 1 seg | centavos |
| 100,000 productos | > 60 seg | timeout Lambda + costo mensual prohibitivo |

**Para el examen:** saber que esto es una limitación del enfoque educativo; en producción se usa un
**vector database con índices** (OpenSearch, Aurora pgvector) que devuelve top-K en milisegundos.

### Problema 2: Re-indexación

Si los productos cambian (precios, nombre, nuevas etiquetas), los embeddings se vuelven obsoletos.
Solución naive: re-embeder todo. Solución real: actualizar solo el producto que cambió, o re-indexar
bajo demanda con SQS batch.

**Para el examen:** embeddings se indexan una sola vez; cambios en el catálogo necesitan re-indexación
(es el costo de mantenimiento).

---

## 🚀 Producción: Bedrock Knowledge Bases

Para aplicaciones de verdad, Amazon ofrece **Bedrock Knowledge Bases**, que te abstrae el almacén
vectorial completo:

```
Tu código → Bedrock Knowledge Bases (servicio gestionado)
              ↓
           Automáticamente:
           - particiona documentos
           - calcula embeddings
           - almacena en vector DB interno
           - ejecuta búsqueda semántica
           - retorna top-K relevantes
```

**Ventajas:**
- Sin infraestructura que administrar
- Escala automática
- Soporta muchos formatos (PDF, DOCX, web, etc.)

**Para el examen:** saber que existen y que son la solución de producción para RAG sin gestionar BD
vectorial propia.

---

## ❓ FAQ

### P1: ¿Qué pasa si no indexo antes de buscar?
R: `SemanticSearch` devuelve `results: []` y un mensaje de hint. El buscador valida que haya embeddings.

### P2: ¿Cuánto tiempo tarda indexar 100k productos?
R: Depende de concurrencia. Lambda de S07 indexa 1 producto por invocación. Para 100k, necesitarías loops o SQS batch. Para el examen es suficiente saber que es "un problema de escala" que se resuelve con arquitectura más compleja.

### P3: ¿Se puede cambiar a otro modelo de embeddings?
R: Sí, cambias `BEDROCK_MODEL_ID` a otro modelo de Bedrock (ej: Cohere Embed V3). Pero atención: diferentes modelos = diferentes dimensiones. Necesitarías re-indexar.

### P4: ¿La similitud coseno es la única métrica?
R: No, hay otras: distancia euclidiana, producto punto, etc. Coseno es la más común para embeddings de text porque es invariante a la magnitud (importa la dirección, no el tamaño del vector).

### P5: ¿Por qué embedding **strings** en DynamoDB vs arrays?
R: DynamoDB Number type solo soporta ±38 dígitos de precisión. Embeddings de 1024 dimensiones con decimales no caben. Se guardan como JSON string y se parsean en Lambda.

### P6: ¿Qué pasa si la consulta es muy larga?
R: Se embede todo. El embedding siempre devuelve un vector de dimensión fija (1024), sea consulta corta o larga. Pero el costo en tokens escala con longitud de entrada.

### P7: ¿Se pueden buscar imágenes también?
R: Para esto necesitarías un modelo de embeddings **multimodal** (Bedrock Titan Multimodal). S07 solo usa embeddings de texto.

### P8: ¿Es lo mismo que búsqueda full-text?
R: No. Full-text busca palabras clave. Embeddings buscan **significado**. Son complementarios.

---

## ✅ Checklist de validación

- [ ] Deploy exitoso sin errores
- [ ] Outputs `IndexEmbeddingsUrl` y `SemanticSearchUrl` en CloudFormation
- [ ] `POST /search/index` devuelve `indexed > 0`
- [ ] En DynamoDB, productos tienen atributo `embedding` (JSON string) y `embeddingDim: 1024`
- [ ] Una búsqueda devuelve resultados ordenados por `score` descendente (mayor primero)
- [ ] Consulta con sinónimos encuentra el producto correcto (sin palabra exacta)
- [ ] Buscar sin indexar primero devuelve error o `results: []`
- [ ] Top 5 resultados con puntuación hace sentido semánticamente

---

## 🔗 Integración: S07 + S08 (RAG completo)

Esta sesión construye la **mitad de RAG:** la recuperación (retrieval). La sesión S08 agrega la otra
mitad: generación.

```
Usuario: "¿Qué chaquetas tienen?"
         ↓
    S07 SemanticSearch
    ↓
    Devuelve: [Chaqueta de mezclilla (score 0.89), Abrigo de lana (score 0.76)]
         ↓
    S08 Bedrock Chat
    ↓
    "Tenemos dos opciones:
     1. Chaqueta de mezclilla oversize ($89)
     2. Abrigo de lana tejida ($120)"
```

S07 siempre corre primero (indexación de una sola vez). S08 depende de tener productos indexados.

---

## 🧹 Cleanup (si necesitas borrar S07)

```bash
# Quitar de template.yaml:
# - IndexEmbeddingsFunction
# - SemanticSearchFunction
# - IndexEmbeddingsUrl (output)
# - SemanticSearchUrl (output)

sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --no-confirm-changeset
```

---

## 🎓 Resumen: qué entrará en el examen

**D3 — Applications of Foundation Models (28%):**

✅ **Embeddings:** vectorización de significado, similitud coseno  
✅ **RAG:** retrieval (embeddings + búsqueda) + generation  
✅ **Vector stores:** dónde se guardan embeddings (DynamoDB educativo, producción vectorDB)  
✅ **Búsqueda semántica vs keyword:** diferencia y uso  
✅ **Múltiples FMs por tarea:** no un FM para todo  
✅ **Bedrock Knowledge Bases:** servicio de Bedrock para RAG  
✅ **Casos de uso:** Q&A sobre documentos, recomendaciones, búsqueda, resumen  
✅ **Indexación una sola vez:** no re-embeder cada búsqueda  

---

**Siguiente:** S08 · Bedrock + Chat (RAG generativa — responder preguntas sobre el catálogo)
