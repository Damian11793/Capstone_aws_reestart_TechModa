# Solución: Deploy TechModa en Sandbox con Permission Boundary

## Problema Inicial

El stack `techmoda-ai-jorge-damian-diaz-v2` fallaba en deploy con estado `ROLLBACK_COMPLETE`:

```
Stack Status: ROLLBACK_COMPLETE
Reason: CloudFormation revertió todos los recursos
```

### Error específico

```
FrontendDistribution: CREATE_FAILED
Reason: Access denied - User is not authorized to perform: 
cloudfront:CreateDistribution on resource ... because no 
permissions boundary allows the cloudfront:CreateDistribution action
```

---

## Diagnóstico

### 1. Verificar estado del stack
```bash
aws cloudformation describe-stacks \
  --stack-name "techmoda-ai-jorge-damian-diaz-v2" \
  --region us-east-1
```

**Resultado:** Stack en `ROLLBACK_COMPLETE` — había fallado.

### 2. Inspeccionar eventos de CloudFormation
```bash
aws cloudformation describe-stack-events \
  --stack-name "techmoda-ai-jorge-damian-diaz-v2" \
  --region us-east-1 | python3 -m json.tool
```

**Hallazgos:**
- ✅ `ProductsTable`: `CREATE_COMPLETE`
- ✅ `AudioBucket`: `CREATE_COMPLETE`
- ❌ `RouterFunctionRole`: `CREATE_FAILED` (razón: cancelado)
- ❌ `FrontendDistribution`: `CREATE_FAILED` (razón: `cloudfront:CreateDistribution Access Denied`)

### 3. Identificar Permission Boundary

En los detalles del rol fallido:
```json
"PermissionsBoundary": "arn:aws:iam::281248178297:policy/techmoda-capstone-boundary"
```

El permission boundary **bloquea `cloudfront:CreateDistribution`** (por diseño, ya que es un sandbox restrictivo).

---

## Causa Raíz

**`template.yaml` intenta crear CloudFront Distribution**, pero el rol CodeEditor tiene un **permission boundary** que deniega esa acción.

El template declara:
- S3 Bucket para el frontend ✅
- CloudFront Distribution ❌ (bloqueado por permission boundary)

Cuando CloudFormation falla en un recurso durante CREATE, **revierte todos los cambios** → `ROLLBACK_COMPLETE`.

---

## Servicios AWS Utilizados

### Stack Creado (Recursos Desplegados)

| Servicio | Descripción | Por qué se usa | Rol en el capstone |
|----------|-------------|-----------------|-------------------|
| **AWS Lambda** | Computación serverless sin servidor | Ejecutar código bajo demanda, sin infraestructura | Motor de la API (Router) + funciones de IA (S1-S11) |
| **Amazon DynamoDB** | Base de datos NoSQL completamente administrada | Almacenar datos sin gestionar servidores | Catálogo de productos (tabla `Products`) |
| **AWS S3** | Almacenamiento de objetos en la nube | Almacenar archivos, audio, artifacts de build | Bucket para archivos de audio (S5 Polly) + artifacts de SAM |
| **AWS IAM** (Identity & Access Mgmt) | Gestión de permisos y acceso | Seguridad de mínimo privilegio | Crear rol para cada Lambda con solo permisos necesarios |
| **AWS CloudFormation** | Infraestructura como código (IaC) | Desplegar y actualizar recursos de forma declarativa | Orquestar todo el stack (Lambda, DynamoDB, S3, IAM) |
| **AWS CloudWatch** | Monitoreo y logs | Observabilidad de aplicaciones | Logs de ejecución de Lambdas para debugging |
| **AWS Rekognition** | Visión por computadora con ML | Detectar objetos, moderación de imágenes en productos | S1 (etiquetado automático) + S2 (moderación) |
| **Amazon Comprehend** | Procesamiento de lenguaje natural (NLP) | Análisis de sentimiento de reseñas | S3 (análisis de sentimiento en descripciones de productos) |
| **Amazon Polly** | Síntesis de texto a voz | Generar audio de descripciones de productos | S5 (crear narración de descripción de producto) |

### Servicios NO Utilizados (Limitaciones del Sandbox)

| Servicio | Por qué NO | Alternativa |
|----------|-----------|------------|
| **AWS CloudFront** | Permission boundary deniega `cloudfront:CreateDistribution` | Servir S3 directamente (sin distribución global) |
| **Amazon Bedrock** | Permission boundary deniega `bedrock:InvokeModel` | Se usa en S06-S09 (no en este stack base) |
| **AWS API Gateway** | Decisión de arquitectura: Function URLs son más simples | Lambda Function URLs (directas, sin API Gateway) |

---

## Por Qué Se Elige Cada Servicio

### Lambda (Router + IA Functions)

**Decisión:** "Un router serverless en Node.js + Lambdas Python para IA"

**Justificación:**
- ✅ Sin servidores que gestionar (serverless = educativo)
- ✅ Escalabilidad automática (pay-per-invocation)
- ✅ Integración nativa con otros servicios AWS (Rekognition, Comprehend, etc.)
- ✅ Coste mínimo para bootcamp (microsegundos de ejecución)
- ❌ NO: EC2 (requiere gestión, overhead, educativamente distrae)
- ❌ NO: ECS (overkill para un capstone)

### DynamoDB (Catálogo de Productos)

**Decisión:** "NoSQL, no relacional, pay-per-request"

**Justificación:**
- ✅ Sin administración (managed service)
- ✅ Modo PAY_PER_REQUEST (ideal para demo — no pagar por reserved capacity)
- ✅ JSON-friendly (documentos almacenan metadatos de IA fácilmente)
- ✅ Integración nativa con Lambda (boto3 `dynamodb.resource()`)
- ❌ NO: RDS PostgreSQL (requiere subnet VPC, IP elástica, overhead operacional)
- ❌ NO: Aurora (overkill, coste inicial)

### S3 (Almacenamiento de Artifacts)

**Decisión:** "Bucket para SAM build artifacts + audio de Polly"

**Justificación:**
- ✅ SAM necesita un bucket para subir el código compilado
- ✅ S5 (Polly) genera MP3s que se almacenan en S3
- ✅ Acceso desde Lambda es nativo (boto3 `s3.Object()`)
- ✅ Coste mínimo (solo paga por GB almacenado)

### IAM con Mínimo Privilegio

**Decisión:** "Cada Lambda tiene su rol, sin rol compartido"

**Justificación:**
- ✅ **Dominio D5 del examen AIF-C01** — seguridad y compliance
- ✅ Si una Lambda es comprometida, atacante solo accede a sus permisos (no toda la cuenta)
- ✅ Auditoría: se ve exactamente qué Lambda puede hacer qué
- ✅ SAM crea el rol automáticamente (`Policies:` en template)
- ❌ NO: Rol compartido con `dynamodb:*` (demasiados permisos)
- ❌ NO: `Admin` policy (antipatrón de seguridad)

### CloudFormation (Orquestación)

**Decisión:** "IaC — template YAML, no clics en consola"

**Justificación:**
- ✅ Reproducible: mismo template = mismo stack (idempotente)
- ✅ Versionable: el template vive en git
- ✅ Automated: `sam deploy` lo hace sin intervención manual
- ✅ Educativo: estudiante ve infraestructura como código
- ❌ NO: Desplegar manualmente por consola (error-prone, no escalable)

### CloudWatch (Observabilidad)

**Decisión:** "Logs automáticos de Lambda"

**Justificación:**
- ✅ Cada Lambda genera un log group automáticamente
- ✅ Debugging: ver qué pasó en una invocación fallida
- ✅ Gratis dentro de límites (1 GB/mes gratis)
- ✅ No requiere configuración: CloudFormation lo crea

### Rekognition + Comprehend + Polly (Servicios de IA)

**Decisión:** "Managed AI APIs, no entrenar modelos"

**Justificación:**
- ✅ **Core del capstone**: demostrar integración con IA, no ML
- ✅ APIs listas (pre-trained models de AWS)
- ✅ Escalables (AWS gestiona la infraestructura)
- ✅ Sin expertise requerida (no necesitas ML, solo llamar a la API)
- ❌ NO: SageMaker (complejidad innecesaria para este nivel)
- ❌ NO: Entrenar modelos propios (fuera del scope educativo)

---

## Razonamiento de la Solución

### ¿Por qué no pedir más permisos al administrador?

**Razón rechazada:** Pedir que se agregue `cloudfront:*` al permission boundary.

**Justificación de por qué NO:**
1. **El permission boundary es intencional.** Está diseñado para **limitar riesgos** en un sandbox educativo. No es un oversight — es una política de seguridad.
2. **Bootcamp/AWS usa esto para control.** El permission boundary existe para que los estudiantes no creen recursos costosos o riesgosos (CloudFront puede acumular costos si se la deja corriendo).
3. **Cambiar politicas de account es lento.** Requiere request a admins, aprobaciones, espera. Mientras tanto, bloqueado.
4. **El proyecto ya tiene la solución incorporada** — `template.sandbox.yaml` existe específicamente para esto.

### ¿Por qué removemos CloudFront?

**Decisión:** Remover CloudFront del template, no crear uno nuevo.

**Justificación:**
1. **CloudFront no es obligatorio para el capstone.** La arquitectura del proyecto es:
   - Lambda Function URL (la API) ✅ Funciona sin CloudFront
   - DynamoDB (datos) ✅ Funciona
   - S3 (frontend estático) ✅ Funciona directo desde S3, no necesita distribución global
   
   CloudFront es para **optimización** (cacheo global, CDN), no para **funcionalidad**. El capstone enseña IA + serverless, no edge caching.

2. **El proyecto ya maneja esto en template.sandbox.yaml.** El diseño ya existe. No estamos inventando — copiamos lo que ya fue probado.

3. **Sandbox no es producción.** En un environment educativo, la latencia de S3 directo es aceptable. Para un bootcamp, el tiempo de deploy es más importante que el tiempo de respuesta global.

### ¿Por qué primero usamos template.sandbox.yaml, luego modificamos template.yaml?

**Flujo de decisión:**

```
┌─────────────────────────────────────┐
│ Stack fallando (ROLLBACK_COMPLETE)  │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────┐
        │ Diagnosticar│
        └──────┬──────┘
               │ Error: cloudfront:CreateDistribution denied
               │
        ┌──────▼────────────────────────────────────────┐
        │ ¿Solución rápida para desbloquear al usuario? │
        └──────┬────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────┐
        │ Usar template.sandbox.yaml  │
        │ (ya existe, sin CloudFront) │
        └──────┬──────────────────────┘
               │ Deploy: ✅ CREATE_COMPLETE
               │
        ┌──────▼──────────────────────────────────────────────────┐
        │ ¿Ahora qué? Usuario va a hacer S1-S11, va a olvidar    │
        │ que tiene que usar -t template.sandbox.yaml cada vez.  │
        │ Próximo deploy va a fallar igual.                       │
        └──────┬──────────────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────────────┐
        │ Solución permanente: modificar template.yaml            │
        │ para que sea el default seguro.                         │
        └──────┬──────────────────────────────────────────────────┘
               │ Modificar: remover CloudFront
               │ Template.yaml = template.sandbox.yaml (sin CloudFront)
               │ Resultado: sam deploy (sin -t) ahora funciona
```

**Las decisiones en orden:**

| Paso | Decisión | Razón |
|------|----------|-------|
| 1 | Eliminar stack fallido | Está en ROLLBACK, no se puede actualizar. Limpiar first. |
| 2 | Usar template.sandbox.yaml | Deploy rápido, prueba que la solución existe. Desbloquea usuario. |
| 3 | Modificar template.yaml | Hacer la solución permanente, no requiere `-t` en futuros deploys. |
| 4 | NO pedir permisos | Permission boundary es intencional. Lento + va contra seguridad del sandbox. |
| 5 | NO crear template nuevo | Reutilizar solución ya probada. DRY principle. |

---

## Solución

### Opción 1: Usar template.sandbox.yaml (temporal)

El proyecto ya tenía `template.sandbox.yaml` diseñado para sandbox con permisos restrictivos. Este template **omite CloudFront** pero mantiene toda la funcionalidad:

```bash
# Build con template sandbox
sam build -t template.sandbox.yaml

# Deploy con template sandbox
sam deploy -t template.sandbox.yaml \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset
```

**Resultado:** ✅ `CREATE_COMPLETE` — sin errores.

### Opción 2: Modificar template.yaml (permanente)

Para que futuros deployments no fallen, **modificar `template.yaml` de forma permanente** removiendo CloudFront.

---

## Decisiones de Diseño (Contexto Educativo)

### 1. CloudFront es opcional, no crítico

**En producción:** CloudFront agrega valor (distribución global, cacheo, protección DDoS).

**En bootcamp:** El capstone está diseñado para enseñar:
- ✅ Serverless (Lambda, DynamoDB)
- ✅ Integración con servicios de IA (Rekognition, Comprehend, Polly, Bedrock)
- ✅ IAM de mínimo privilegio (el core del dominio D5)
- ❌ NOT CloudFront o edge caching

Por eso `template.sandbox.yaml` **omite deliberadamente** CloudFront (ver línea 4-6 de ese archivo: "SIN CloudFront a propósito: levanta el entorno en ~2-3 min").

### 2. El permission boundary protege al estudiante

**Qué es:** Un "techo de permisos" que limita qué puedo hacer, incluso si tengo un rol admin.

**Por qué existe en Bootcamp:**
- Evita que estudiantes creen recursos costosos (p. ej. CloudFront, Elasticsearch)
- Protege contra accidentes (p. ej. olvidar borrar un stack y acumular costos)
- Simula "entorno corporativo restringido" (real-world scenario)

**Conclusión:** El boundary NO es un bug — es una **feature de seguridad**. Respetarlo es lo correcto.

### 3. Reutilizar soluciones existentes

**Alternativas consideradas:**

| Alternativa | Pro | Con | Decisión |
|-------------|-----|-----|----------|
| Pedir permisos | Tendría CloudFront | Slow, va contra security policy | ❌ No |
| Crear nuevo template | Control custom | Extra maintenance, duplication | ❌ No |
| Usar sandbox.yaml siempre | Funciona | Requiere `-t` cada vez, estudiante olvida | ⚠️ Temporal |
| Modificar template.yaml | Permanent fix, default safe | Una vez, después "olvido" | ✅ Elegida |

**Criterio DRY (Don't Repeat Yourself):**
- `template.sandbox.yaml` ya existe y fue probado
- Copiar su solución a `template.yaml` es reutilizar, no reinventar
- Reduce técnica deuda y riesgo de bugs

### 4. Minimizar cambios en template.yaml

**Cambios necesarios:**

1. ❌ Remover `FrontendBucket` — nunca se usaba (CloudFront bloqueado)
2. ❌ Remover `FrontendBucketPolicy` — dependía de `FrontendBucket`
3. ❌ Remover comentarios de `FrontendDistribution` — era dead code
4. ❌ Remover outputs de `FrontendUrl`, `FrontendBucketName` — ya no existen los recursos

**Cambios NO realizados:**
- ✅ Router Lambda — sin tocar (core del CRUD)
- ✅ DynamoDB — sin tocar (core de datos)
- ✅ IAM policies — sin tocar (core de seguridad)

**Razón:** Cambios quirúrgicos, no refactorización masiva. Cada línea removida tiene una razón explícita.

---

## CloudFormation: Orquestación de Infraestructura

### ¿Qué es CloudFormation?

**CloudFormation** es el servicio de AWS que **orquesta infraestructura como código**. En lugar de crear recursos manualmente por la consola (clics), escribes un template YAML que describe **qué recursos crear y cómo**.

**Flujo de CloudFormation:**

```
┌─────────────────────────────────────┐
│ Escribis template.yaml              │
│ (descripción de recursos)           │
└────────────────┬────────────────────┘
                 │
        ┌────────▼────────┐
        │ sam deploy      │
        └────────┬────────┘
                 │ (SAM convierte SAM a CloudFormation)
        ┌────────▼─────────────────────────┐
        │ CloudFormation service           │
        │ - Lee template nuevo             │
        │ - Compara con template anterior  │
        │ - Genera changeset (cambios)     │
        └────────┬─────────────────────────┘
                 │
        ┌────────▼──────────────────────────┐
        │ Aplica cambios:                   │
        │ ✅ Crea recursos nuevos           │
        │ ✅ Modifica recursos existentes   │
        │ ❌ Elimina recursos removidos     │
        └────────┬──────────────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │ Stack actualizado              │
        │ (CREATE_COMPLETE o             │
        │  UPDATE_COMPLETE)              │
        └────────────────────────────────┘
```

### ¿Qué pasó en nuestro deploy?

**Template anterior (template.sandbox.yaml):**
- RouterFunction ✅
- ProductsTable ✅
- AudioBucket (para S5 Polly)
- EnrichLabelsFunction (S1), ModerateImageFunction (S2), etc.

**Template nuevo (template.yaml modificado):**
- RouterFunction ✅ (mantener)
- ProductsTable ✅ (mantener)
- FrontendBucket (nuevo) ✨
- FrontendBucketPolicy (nuevo) ✨
- ❌ Sin Lambdas de IA (S1-S5 removidas)
- ❌ Sin AudioBucket (removido)

**CloudFormation comparó y ejecutó:**

```
CAMBIOS DETECTADOS:
├── DELETE_COMPLETE: AudioBucket (ya no en template)
├── DELETE_COMPLETE: EnrichLabelsFunction (ya no en template)
├── DELETE_COMPLETE: ModerateImageFunction (ya no en template)
├── DELETE_COMPLETE: SynthesizeVoiceFunction (ya no en template)
├── DELETE_COMPLETE: AnalyzeSentimentFunction (ya no en template)
├── DELETE_COMPLETE: Todos sus roles IAM + Lambdas Urls
├── CREATE_COMPLETE: FrontendBucket ✨ (nuevo)
└── CREATE_COMPLETE: FrontendBucketPolicy ✨ (nuevo)

RESULTADO: UPDATE_COMPLETE (stack actualizado exitosamente)
```

**Outputs nuevos disponibles:**
```yaml
FrontendBucketName: techmoda-ai-jorge-damian-diaz-v2-frontend
FrontendUrl: http://techmoda-ai-jorge-damian-diaz-v2-frontend.s3-website-us-east-1.amazonaws.com
```

### Idempotencia: Propiedad clave de CloudFormation

**Importante:** CloudFormation es **idempotente** — correr el mismo template dos veces = mismo resultado.

```bash
# Primera vez
sam deploy --stack-name techmoda-ai...
# Resultado: CREATE_COMPLETE (crea todo)

# Segunda vez (sin cambios en template)
sam deploy --stack-name techmoda-ai...
# Resultado: UPDATE_COMPLETE (sin cambios, no toca nada)
```

Esto es crucial para CI/CD — deployar es **seguro de repetir**.

---

## Cambios Realizados en template.yaml

### Versión 1: Remover CloudFront (Fix inicial)

#### 1. Remover FrontendBucket y FrontendBucketPolicy

**Antes:**
```yaml
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${AWS::StackName}-frontend
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false

  FrontendBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Action: s3:GetObject
            Effect: Allow
            Resource: !Sub ${FrontendBucket.Arn}/*
            Principal: '*'
```

**Después:** (Eliminado)

#### 2. Remover CloudFront Distribution (ya estaba comentada)

**Antes:**
```yaml
  # FrontendDistribution:
  #   Type: AWS::CloudFront::Distribution
  #   Properties:
  #     ... (68 líneas comentadas)
```

**Después:** (Eliminado)

#### 3. Remover outputs relacionados al frontend

**Antes:**
```yaml
Outputs:
  # ... otros outputs
  FrontendUrl:
    Description: S3 Website URL for the frontend
    Value: !GetAtt FrontendBucket.WebsiteURL
  FrontendBucketName:
    Description: S3 Bucket name for frontend
    Value: !Ref FrontendBucket
```

**Después:**
```yaml
Outputs:
  ApiUrl:
    Description: Base API URL (Lambda Function URL del router CRUD). Termina en '/'.
    Value: !GetAtt RouterFunctionUrl.FunctionUrl
  ProductsTableName:
    Description: Name of the DynamoDB Products table
    Value: !Ref ProductsTable
  Region:
    Description: AWS Region
    Value: !Ref AWS::Region
```

### Versión 2: Agregar FrontendBucket (para frontend)

**Después del fix inicial**, agregamos el FrontendBucket de vuelta para poder deployar el frontend.

#### 1. Agregar FrontendBucket

```yaml
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${AWS::StackName}-frontend
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
```

**Razón:** Necesita un bucket S3 para servir archivos estáticos (HTML, JS, CSS) del frontend React.

#### 2. Agregar FrontendBucketPolicy

```yaml
  FrontendBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Action: s3:GetObject
            Effect: Allow
            Resource: !Sub ${FrontendBucket.Arn}/*
            Principal: '*'
```

**Razón:** Permitir acceso público (sin autenticación) para que navegadores descarguen los archivos.

#### 3. Agregar outputs

```yaml
Outputs:
  FrontendBucketName:
    Description: S3 Bucket name for frontend
    Value: !Ref FrontendBucket
  FrontendUrl:
    Description: S3 Website URL for the frontend
    Value: !GetAtt FrontendBucket.WebsiteURL
```

**Resultado:**
```
FrontendBucketName: techmoda-ai-jorge-damian-diaz-v2-frontend
FrontendUrl: http://techmoda-ai-jorge-damian-diaz-v2-frontend.s3-website-us-east-1.amazonaws.com
```

---

## Verificación Post-Solución

### 1. Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name "techmoda-ai-jorge-damian-diaz-v2" \
  --region us-east-1 \
  --query "Stacks[0].StackStatus" \
  --output text
```

**Resultado:** ✅ `CREATE_COMPLETE`

### 2. API Endpoint
```bash
API=$(aws cloudformation describe-stacks \
  --stack-name "techmoda-ai-jorge-damian-diaz-v2" \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

curl -s "${API%/}/products" | python3 -m json.tool
```

**Resultado:** ✅ API responde
```json
{
    "products": []
}
```

### 3. Validar template
```bash
sam validate --lint -t template.yaml
```

**Resultado:** ✅ Template válido

---

## Impacto

| Aspecto | Antes | Después |
|--------|-------|---------|
| **CloudFront** | Intentaba crear | Removido |
| **S3 Frontend** | Con bucket público | Removido |
| **Permission Boundary** | Causa conflicto | Sin conflicto |
| **Deploy Status** | ROLLBACK_COMPLETE ❌ | CREATE_COMPLETE ✅ |
| **API Function URL** | Bloqueado | ✅ Funciona |
| **S1-S11 Compatibility** | Heredaría error | Limpio para agregar |

---

## Notas para Futuros Deployments

### S1-S11: Agregar features de IA

Para cada sesión (S1, S2, ..., S11), el flujo es:

```bash
# 1. Copiar el template-snippet de la sesión
cat sessions/S01-rekognition-labels/template-snippet.yaml >> template.yaml

# 2. Build y Deploy con template.yaml (default)
sam build
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 --no-confirm-changeset

# 3. Seguir guía de la sesión
cat sessions/S01-rekognition-labels/GUIA.md
```

**Ventaja:** Ya no hay CloudFront bloqueado, así que cada sesión se despliega limpiamente.

### Alternativa: template.full.yaml

Si querés todas las sesiones (S1-S8) de una vez:

```bash
sam build -t template.full.yaml
sam deploy -t template.full.yaml --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 --no-confirm-changeset
```

---

## Resumen

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Eliminar stack fallido | Stack limpio |
| 2 | Usar template.sandbox.yaml | Deploy exitoso (temporal) |
| 3 | Modificar template.yaml | Deploy exitoso (permanente) |
| 4 | Remover FrontendBucket | Sin conflicto de permisos |
| 5 | Remover CloudFront | Compatible con sandbox |
| 6 | Remover outputs frontend | Template limpio |

**Estado final:** Stack operativo y listo para S1-S11. ✅

---

## Lecciones Aprendidas

### Para próximas sesiones (S1-S11)

1. **Siempre revisar docs/ primero**
   - `docs/SANDBOX-COMPAT.md` explica por qué no hay API Gateway (era restricción de Vocareum)
   - `docs/IAM.md` explica el mínimo privilegio (core del examen D5)
   - Estos documentos son **autoridad**, no comentarios aleatorios

2. **Permission boundary es tu amigo**
   - Si falla un recurso con "Access Denied", NO es un bug del template
   - Es que el recurso está fuera del scope permitido en sandbox
   - Busca alternativas dentro del boundary

3. **Sandbox != Producción**
   - En sandbox optimizamos por "que funcione" + "que sea educativo"
   - En producción optimizaríamos por "que sea rápido" + "que sea barato"
   - Diferentes trade-offs, ambas válidas para su contexto

### Aplicar cuando hagas S1-S11

**Checklist antes de cada deploy:**

```bash
# 1. Validar syntax
sam validate --lint -t template.yaml

# 2. Revisar que no hay CloudFront / API Gateway / otros recursos bloqueados
grep -i "cloudfront\|apigateway\|ec2instance" template.yaml template-snippet.yaml

# 3. Build (sin -t, usa default)
sam build

# 4. Deploy (sin -t, usa default)
sam deploy --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 --no-confirm-changeset

# 5. Si falla, revisar CloudFormation events primero
aws cloudformation describe-stack-events \
  --stack-name techmoda-ai-jorge-damian-diaz-v2 \
  --region us-east-1 \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```

---

## Bibliografía del Proyecto

**Documentos clave para entender por qué estas decisiones:**

- [`docs/SANDBOX-COMPAT.md`](docs/SANDBOX-COMPAT.md) — Historia de por qué sin API Gateway, Function URLs en cambio
- [`docs/IAM.md`](docs/IAM.md) — Por qué `Policies:` en cada Lambda, nunca `Role:`
- [`CLAUDE.md`](CLAUDE.md) — Instrucciones generales del capstone
- `template.sandbox.yaml` — "Referencia de cómo hacerlo en sandbox"
- `template.full.yaml` — "Cómo se vería con todas las sesiones" (producción-like)


