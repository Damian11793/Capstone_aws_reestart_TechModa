# S10 — Explicación Detallada: Gobernanza, IAM de Mínimo Privilegio, Logging y Control de Costos

> Esta guía está hecha para quienes quieren entender cómo **gobernar responsablemente** un stack de IA en AWS. Si ya conocés IAM y FinOps, saltá a la sección que necesites.

---

## 📚 Tabla de Contenidos

1. [¿Qué es S10?](#qué-es-s10)
2. [¿Por qué importa? (D5 del examen)](#por-qué-importa-d5-del-examen)
3. [Los 3 Pilares de la Gobernanza de IA](#los-3-pilares-de-la-gobernanza-de-ia)
4. [Pilar 1: IAM de Mínimo Privilegio](#pilar-1-iam-de-mínimo-privilegio)
5. [Pilar 2: Logging e Auditoría](#pilar-2-logging-e-auditoría)
6. [Pilar 3: Control de Costos (FinOps)](#pilar-3-control-de-costos-finops)
7. [Cómo Demostrarlo en un Portafolio](#cómo-demostrarlo-en-un-portafolio)
8. [Conceptos Clave para el Examen (D5)](#conceptos-clave-para-el-examen-d5)

---

## ¿Qué es S10?

**S10 es la sesión de Gobernanza del capstone.** No agrega una feature nueva de IA; en cambio, **cierra el círculo de seguridad** sobre todo lo que construimos.

En las sesiones S01–S09 hicimos:
- Lambdas que procesan imágenes, textos, voces.
- Llamadas a servicios de IA (Rekognition, Bedrock, Polly, etc.).
- Lecturas y escrituras en DynamoDB y S3.

**Pero: ¿quién puede hacer qué? ¿Registramos lo que pasó? ¿Cuánto cuesta realmente?**

**S10 responde esas tres preguntas:**

1. 🔐 **Mínimo privilegio:** Cada Lambda solo puede hacer lo que necesita (nada más).
2. 🔍 **Auditoría:** Cada invocación queda registrada (quién, qué, cuándo, resultado).
3. 💸 **FinOps:** Tags de costo + alarmas → transparencia + control.

---

## ¿Por qué importa? (D5 del examen)

El dominio **D5 — Security, Compliance & Governance** es el **14% del examen AIF-C01**.

**Lo que evalúa:**
- IAM de mínimo privilegio aplicado a IA.
- Quién puede invocar qué modelo.
- Dónde viven los datos y cómo se protegen.
- Auditoría y cumplimiento (quién hizo qué).
- Costos predecibles (FinOps de IA).
- Privacidad (GDPR/LGPD) y modelos responsables.

**El error típico:** "Creo un rol ancho `admin` y lo comparto entre todas las Lambdas."  
**Por qué está mal:** Si una Lambda se compromete, el atacante puede hacer **todo** (no solo etiquetado de imágenes, sino también borrar la BD, invocar otros modelos, etc.).

**La solución (S10):** Cada Lambda declara sus Policies; SAM le crea un rol de mínimo privilegio. Si se hackea la Lambda de etiquetado, solo puede etiqueta, nada más.

---

## Los 3 Pilares de la Gobernanza de IA

### Pilar 1: IAM de Mínimo Privilegio

**Principio:** Una función debe tener **la menor cantidad de permisos necesarios** para cumplir su tarea.

**Antes (Anti-patrón):**
```yaml
Role: arn:aws:iam::ACCOUNT:role/AdminRole
Policies:
  - PolicyDocument:
      Statement:
        - Effect: Allow
          Action: "*"
          Resource: "*"
```
❌ La Lambda puede hacer **cualquier cosa en la cuenta**. Desastre de seguridad.

**Después (Patrón correcto):**
```yaml
Policies:
  - DynamoDBReadPolicy:
      TableName: !Ref ProductsTable  # Solo esta tabla
  - Statement:
      - Effect: Allow
        Action:
          - rekognition:DetectLabels  # Solo esta acción
        Resource: "*"               # APIs Detect no admiten ARN específico
```
✅ La Lambda **solo puede leer DynamoDB** + **solo puede detectar labels** (no borrar, no crear modelos, nada más).

### En el Capstone

Aplicamos este patrón a **todas las Lambdas**:

| Lambda | Permisos |
|--------|----------|
| EnrichLabels (S01) | DynamoDB CRUD (tabla) + Rekognition:DetectLabels |
| ModerateImage (S02) | DynamoDB CRUD + Rekognition:DetectModerationLabels + S3:GetObject |
| AnalyzeSentiment (S03) | DynamoDB CRUD + Comprehend:DetectSentiment/DetectDominantLanguage |
| GenerateDescription (S06) | DynamoDB CRUD + Bedrock:InvokeModel (modelos específicos) + Bedrock:ApplyGuardrail |
| ShoppingAssistant (S08) | DynamoDB Read + Bedrock:InvokeModel + Bedrock:ApplyGuardrail |

**Ninguna Lambda tiene `*` de servicio.** Solo acciones específicas.

---

## Pilar 2: Logging e Auditoría

### ¿Qué se loguea?

**Nivel 1: CloudTrail (API calls)**
- ✅ Quién: IAM user/role
- ✅ Qué: Acción (iam:CreateRole, lambda:InvokeFunction, bedrock:InvokeModel)
- ✅ Cuándo: Timestamp
- ✅ Dónde: Región
- ❌ NO incluye el contenido (qué prompt envié, qué respuesta recibí)

**Nivel 2: Bedrock Model Invocation Logging (contenido)**
- ✅ Prompt completo
- ✅ Respuesta del modelo
- ✅ Tokens consumidos
- ✅ Latencia
- ✅ Costo
- 🔐 Sensible → guardado en CloudWatch Logs (cifrado)

### En S10 habilitamos:

```bash
aws bedrock put-model-invocation-logging-configuration \
  --logging-config cloudWatchConfig={logGroupName=/techmoda/bedrock-invocations, roleArn=...}
```

Resultado: **Cada invocación de Bedrock ahora queda registrada** en CloudWatch.

### Casos de Uso

- **Auditoría:** "¿Quién invocó este modelo a las 3 AM?"
- **Debugging:** "¿Qué prompt recibió el modelo?" (para investigar una respuesta mala)
- **Costos:** "¿Cuántos tokens consumieron todas las invocaciones?" (FinOps)
- **Cumplimiento:** Para GDPR/LGPD: "Prueba que borramos datos del cliente X"

---

## Pilar 3: Control de Costos (FinOps)

### Cost Allocation Tags

Agregamos tags a **todos los recursos:**

```yaml
Globals:
  Function:
    Tags:
      Project: techmoda-ai-capstone
      Module: ai-practitioner
      Environment: sandbox
```

Luego en AWS Billing → Cost Allocation Tags → **activamos** esos tags.

Resultado: En **Cost Explorer**, puedo filtrar por `Project=techmoda-ai-capstone` y ver:
- Costo de Bedrock
- Costo de DynamoDB
- Costo de Lambda
- Costo de CloudWatch Logs
- **Total de IA para este proyecto**

### Alarma de Billing

```yaml
AiCostAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    Threshold: 5  # USD
    MetricName: EstimatedCharges
```

**¿Qué hace?** Si el costo estimado de la cuenta supera $5, AWS me envía un email (o puede triggerear una acción).

**¿Por qué importa?** Imaginate que hay un bug y la Lambda invoca Bedrock 1.000 veces por segundo. Sin alarma, enteras la factura el mes siguiente. Con alarma, te avisamos en horas.

### FinOps de IA: Elección de Modelo

**Costo por token (aproximado, Bedrock):**

| Modelo | Input | Output |
|--------|-------|--------|
| Haiku | $0.00080 | $0.00240 |
| Sonnet | $0.00300 | $0.01500 |
| Opus | $0.01500 | $0.07500 |

**Estrategia:**
- ✅ Use **Haiku** para tareas simples (clasificación, extracción).
- ✅ Use **Sonnet** para análisis complejos (resumen, traducción).
- ❌ **No use Opus** para tareas triviales.

En el capstone, S06 y S08 usan **Haiku** → minimizamos costo.

---

## Cómo Demostrarlo en un Portafolio

### Artefacto 1: Matriz de IAM

```markdown
# Política de Mínimo Privilegio — TechModa Capstone

| Función | Acción | Recurso | Justificación |
|---------|--------|---------|---------------|
| EnrichLabels | rekognition:DetectLabels | * | API no admite ARN específico |
| EnrichLabels | dynamodb:GetItem, UpdateItem | arn:dynamodb:...Products | Solo tabla de productos |
| ShoppingAssistant | bedrock:InvokeModel | arn:bedrock:...claude-haiku-4-5 | Solo Haiku, no otros modelos |
| ShoppingAssistant | bedrock:ApplyGuardrail | arn:bedrock:...guardrail/xxx | Guardrail específico |
```

✅ Demuestra que **entendés el principio de mínimo privilegio**.

### Artefacto 2: Logs de Auditoría

```bash
# 1. Verificar CloudTrail
aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=ShoppingAssistant

# 2. Ver logs de Bedrock
aws logs tail /techmoda/bedrock-invocations --follow
```

✅ Demuestra que **capturaste y analizaste auditoría**.

### Artefacto 3: Reporte de Costos

```bash
# Generar reporte en Cost Explorer
# (desde consola AWS: Analytics → Cost Explorer)
# Filtrar por Tag: Project=techmoda-ai-capstone
# Agrupar por: Service
```

✅ Demuestra que **implementaste FinOps**.

### En la Entrevista

**Pregunta:** "¿Cómo garantizás que tus Lambdas no se pueden hackear entre sí?"

**Tu respuesta (con S10):**
> "Cada Lambda declara sus permisos en SAM. No comparto roles; SAM crea uno de mínimo privilegio por función. Si la Lambda de etiquetado se hackea, solo puede etiquetado, no puede tocar DynamoDB de otra Lambda ni invocar modelos premium. Además, cada invocación queda en CloudTrail + Bedrock logs para auditoría."

🎯 **Eso es D5 puro.**

---

## Conceptos Clave para el Examen (D5)

### 1. Modelo de Responsabilidad Compartida

| AWS (Responsable) | Vos (Responsable) |
|------------------|-----------------|
| Hardware | Datos que subes |
| Red | IAM policies |
| S3/DynamoDB encryption | Quién accede a qué |
| CloudTrail | Qué haces con los logs |

En IA: **AWS da el modelo (Claude, Haiku), vos das el prompt + responsable del resultado.**

### 2. IAM: Principios

- **Least Privilege:** Mínimo necesario.
- **Deny by Default:** Solo permite lo que explícitamente declaro.
- **Separation of Duties:** Cada rol hace una cosa.

### 3. CloudTrail vs. CloudWatch Logs

| Herramienta | Qué registra | Dónde | Para qué |
|------------|-------------|-------|---------|
| CloudTrail | API calls | Agregado en S3 | "¿Quién hizo qué?" |
| CloudWatch Logs | Aplicación + Bedrock invocations | Log group | "¿Qué pasó adentro?" + Debugging |

### 4. FinOps de IA

**Pilar 1: Visibilidad**
- ✅ Tags de costo
- ✅ Cost Explorer
- ✅ Logs de invocación (tokens consumidos)

**Pilar 2: Optimization**
- ✅ Elegir modelo correcto (Haiku << Sonnet)
- ✅ Batch processing (agrupar llamadas)
- ✅ Caché de resultados

**Pilar 3: Governance**
- ✅ Alarmas de billing
- ✅ Budgets por proyecto
- ✅ Revisión mensual

### 5. Privacidad & Compliance

- **GDPR (UE):** Derecho a borrar datos. CloudTrail + logs permiten auditar "¿borramos este cliente?"
- **LGPD (Brasil):** Similar a GDPR.
- **AUP de AWS:** No usar IA para deepfakes, spam, etc. → monitoreá logs.

---

## Comandos para Verificar

### 1. Auditar IAM

```bash
# ¿Tiene wildcard?
grep -rn "bedrock:\*" sessions/

# ¿Qué policies tiene una Lambda?
aws iam list-role-policies --role-name <rol-name>
aws iam get-role-policy --role-name <rol-name> --policy-name <policy-name>
```

### 2. Ver Logs

```bash
# CloudTrail
aws cloudtrail lookup-events --max-results 10

# Bedrock invocations
aws logs tail /techmoda/bedrock-invocations --follow

# CloudWatch de una Lambda
aws logs tail /aws/lambda/techmoda-ai-*-ShoppingAssistant --follow
```

### 3. Costos

```bash
# Tags habilitados?
aws ce list-cost-allocation-tags

# Reporte (requiere console para gráficos)
# Pero puedo usar CLI:
aws ce get-cost-and-usage \
  --time-period Start=2026-09-01,End=2026-09-30 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

---

## Resumen: S10 en 30 Segundos

| Pilar | Qué | Cómo | Para |
|------|-----|------|------|
| **IAM** | Mínimo privilegio por Lambda | Policies inline en SAM | Seguridad: si hackean una Lambda, solo hackean eso |
| **Logging** | Auditoría de invocaciones | CloudTrail + Bedrock logs | Compliance + debugging + costos |
| **FinOps** | Tags + alarmas | Cost Allocation Tags + CloudWatch Alarms | Presupuesto predecible + alerta temprana |

**Para el portafolio: Muestra la matriz de IAM + logs + reporte de costos.**  
**Para el examen: Memoriza D5 — Security, Compliance, Governance.**

---

## Gotchas & Errores Comunes

### ❌ Gotcha 1: Wildcard en Resource

```yaml
Resource: "*"  # ❌ Muy amplio
```

**Por qué es un problema:** Si el servicio **SÍ admite ARN específico (como Bedrock)**, estás rompiendo mínimo privilegio.

**Correcto:**
```yaml
Resource:
  - !Sub arn:${AWS::Partition}:bedrock:*::foundation-model/*
  - !Sub arn:${AWS::Partition}:bedrock:*:${AWS::AccountId}:inference-profile/*
```

### ❌ Gotcha 2: Olvidar de Activar Tags en Billing

Crearás los tags en SAM, pero **no aparecerán en Cost Explorer hasta que los actives en Billing → Cost Allocation Tags**.

**Solución:** Ir a consola → Billing → Cost Allocation Tags → marcar "User-Defined Tags" → "Activate".

### ❌ Gotcha 3: Alarma de Billing Sin Rol de Entrega (Bedrock Logging)

Si intentás loguear Bedrock sin crear el rol de entrega (`techmoda-ai-BedrockLogsDelivery`), Bedrock **no puede asumir el rol** → no escribe logs.

**Solución:** Crear el rol **antes** de habilitar logging.

---

## Próximos Pasos

- S11: Integración end-to-end + demo.
- Producción: Aplicar estos patterns a tus servicios reales.

**¿Preguntas?** Revisá `GUIA.md` de S10 o consultá la documentación oficial de IAM en AWS.
