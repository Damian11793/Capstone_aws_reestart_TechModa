# 💸 Resumen de Costos - TechModa Capstone

**Fecha**: 2026-09-23  
**Stack**: techmoda-ai-capstone  
**Región**: us-east-1

---

## 📊 Precios Actuales (Septiembre 2026)

### Bedrock (Modelos de IA)

| Modelo | Input | Output | Caso de Uso |
|--------|-------|--------|------------|
| **Claude Haiku 4.5** | $0.80/1M tokens | $4/1M tokens | ✅ S6, S8 (recomendado) |
| Claude Sonnet 5 | $3/1M tokens | $15/1M tokens | Análisis complejos |
| Claude Opus 5 | $15/1M tokens | $75/1M tokens | Tareas premium |
| **Titan Embeddings v2** | $0.02/1M | — | ✅ S7, S8 (búsqueda) |
| **Bedrock Guardrails** | $0.04–0.1/1M eval | — | ✅ S8, S9 (content filtering) |

### AWS Services Core

| Servicio | Componente | Precio | Límite Free Tier |
|----------|-----------|--------|------------------|
| **Lambda** | Invocación | $0.20/1M | 1M/mes ✅ |
| | Duración | $0.0000166667/GB-s | 400k GB-s/mes ✅ |
| **DynamoDB** | Lectura | $0.25/1M | 2.5M reads/mes ✅ |
| | Escritura | $1.25/1M | 1M writes/mes ✅ |
| | Almacenamiento | $0.25/GB-mes | 25 GB ✅ |
| **S3** | Almacenamiento | $0.023/GB-mes | 5 GB ✅ |
| **CloudWatch Logs** | Ingesta | $0.50/GB | 5 GB/mes ✅ |
| | Almacenamiento | $0.03/GB-mes | — |
| **CloudTrail** | Eventos | Gratis (5 trails) | — ✅ |
| **CloudFormation** | Stack deployment | Gratis | — ✅ |
| **IAM** | Roles & policies | Gratis | — ✅ |

### Vision & NLP Services

| Servicio | Precio | Caso de Uso |
|----------|--------|------------|
| **Rekognition** (DetectLabels) | $0.001/imagen | S1 - Auto-label |
| **Rekognition** (Moderation) | $0.0006/imagen | S2 - Content moderation |
| **Comprehend** (Sentiment) | $0.0001/unidad | S3 - Sentiment analysis |
| **Translate** | $0.015/millón caracteres | S4 - Traducción |
| **Polly** | $0.00004/caracteres | S5 - Text-to-speech |

---

## 💰 Estimaciones por Escenario

### Escenario 1: Desarrollo & Testing (ACTUAL)
```
Lambda:           100 invocaciones          ~$0.00002
DynamoDB:         220 reads + 25 writes    ~$0.00009
Bedrock Claude:   ~5k in + 3k out tokens  ~$0.016
Bedrock Guardrails: 10 evaluaciones       ~$0.0004
Titan Embeddings: 500 vectores            ~$0.00001
CloudWatch Logs:  0.1 MB                  ~$0.00005
S3 Frontend:      <100 MB                 ~$0.00023
─────────────────────────────────────────────────
TOTAL:                                    ~$0.02 USD
```

**Con Free Tier**: $0.00 (todo cubierto por 12 meses)

### Escenario 2: Demo Portfolio (50 conversaciones)
```
Lambda:           100 invocaciones         $0.00002
Bedrock Claude:   50 calls × 600 tokens   ~$0.12
Bedrock Guardrails: 50 evaluaciones      ~$0.002
Titan Embeddings: 250 vectores           ~$0.000005
─────────────────────────────────────────────────
TOTAL:                                    ~$0.30 USD
```

### Escenario 3: Uso en Producción (10k conversaciones/mes)
```
Lambda:             10k calls              ~$0.002
Bedrock Claude:     10k × 600 tokens      $48–72/mes
Bedrock Guardrails: 10k evaluaciones     $0.4–1/mes
Titan Embeddings:   5k vectores          ~$0.0001/mes
DynamoDB:           Escalada de datos     ~$1–2/mes
CloudWatch Logs:    Observabilidad        ~$1–2/mes
S3/Frontend:        Hosting               ~$0.5/mes
─────────────────────────────────────────────────
TOTAL:                                    $52–79/mes
```

### Escenario 4: Post-Proyecto (Cleanup)
```
Ejecutar: sam delete --stack-name techmoda-ai-capstone

COSTO: $0.00 (sin recursos activos)
```

---

## 🎯 Desglose por Sesión de IA

| Sesión | Servicio | Costo por Uso |
|--------|----------|--------------|
| S1 | Rekognition (Labels) | $0.001/img |
| S2 | Rekognition (Moderation) | $0.0006/img |
| S3 | Comprehend (Sentiment) | $0.0001/texto |
| S4 | Translate | $0.015/1M chars |
| S5 | Polly (TTS) | $0.00004/char |
| S6 | Bedrock Claude | $0.80 in + $4 out per 1M |
| S7 | Bedrock Embeddings | $0.02/1M |
| **S8** | **Claude + Guardrails + Embeddings** | **$0.01–0.02/conversación** |
| S9 | Bedrock Guardrails (eval) | $0.04–0.1/1M |
| S10 | CloudWatch + CloudTrail | ~$0 (Free Tier) |

---

## 💡 Recomendaciones de Optimización

### ✅ Lo que ya está optimizado
- **Modelo**: Haiku 4.5 (30x más barato que Opus)
- **Sin API Gateway**: Function URLs directas (menor costo)
- **DynamoDB On-demand**: PAY_PER_REQUEST (no pagues por capacidad no usada)
- **IAM Mínimo Privilegio**: S10 (sin riesgos de escalada de permisos)

### 🔮 Optimizaciones Futuras
1. **Prompt Caching** (en Bedrock): 90% descuento en tokens reutilizados
2. **Batch Embeddings**: 50% descuento en vectores (volumen)
3. **DynamoDB Reserved Capacity**: Si pasas a 100k+ ops/mes
4. **CloudFront CDN**: Para frontend (reduce tráfico S3)

---

## ⚠️ Factores de Riesgo (Costos Inesperados)

| Riesgo | Señal de Alerta | Mitigation |
|--------|-----------------|-----------|
| **Bucle infinito en Lambda** | Bedrock facturación sube 10x | CloudWatch alarm en $5 |
| **Logs no rotados** | CloudWatch storage → $GB/mes | Set retention: 7 días |
| **DynamoDB sin límites** | Escrituras descontroladas | Throttling automático (on-demand) |
| **X-Ray siempre ON** | $5/1M trazas | Desactivar en prod si no necesitas |
| **Bedrock Guardrails mal configurado** | Evaluación 10x más cara | Usar el guardián preconfigurado |

---

## 📋 Verificar Costos en AWS

```bash
# 1. Habilitar Cost Allocation Tags
aws ce list-cost-allocation-tags

# 2. Ver reporte de costos (última semana)
aws ce get-cost-and-usage \
  --time-period Start=2026-09-16,End=2026-09-23 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table

# 3. Proyectar gasto mensual actual
aws ce get-cost-forecast \
  --time-period Start=2026-09-23,End=2026-09-30 \
  --metric BLENDED_COST \
  --granularity MONTHLY

# 4. Ver alarma de billing
aws cloudwatch describe-alarms --alarm-names AiCostAlarm
```

---

## 🚀 Estado Actual del Stack

**Costos Mensales Estimados**: ~$0.02 USD (ambos dentro de Free Tier)

**Recursos Desplegados**:
- ✅ Frontend React (S3 + CloudFront)
- ✅ 9 Lambdas Python 3.12 (mínimo privilegio)
- ✅ DynamoDB ProductsTable
- ✅ CloudWatch + CloudTrail logging
- ✅ Bedrock Guardrails habilitado (S8, S9)

**Próximos Pasos**:
1. Ejecutar RAGAS evaluation (50 preguntas) → ~$0.05
2. Demostrar 50 conversaciones portfolio → ~$0.30 adicional
3. Post-proyecto: `sam delete` → $0.00

---

**Últimas actualizaciones**: 
- Precios verificados con AWS Pricing (Sept 2026)
- Consumo estimado basado en pruebas locales
- Free Tier aplica por 12 meses desde creación de cuenta

