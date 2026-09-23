# S11 · Integración final, demo, documentación y cleanup

**Duración:** ~60 min · **Servicio:** — (cierre) · **Dominio AIF-C01:** repaso de los 5 dominios
**Estado:** 🟡 Guía detallada + scripts (`demo.sh` listo; `scripts/delete-all.sh` ya existe en el repo).

> 🔌 **Cómo se expone todo:** cada feature tiene su **Lambda Function URL** (no API Gateway) y su propio
> **rol de mínimo privilegio creado por SAM** — ver [`docs/IAM.md`](../../docs/IAM.md). El CRUD usa la Function URL
> del **router** (output `ApiUrl`); cada función de IA tiene su propia Function URL (`EnrichLabelsUrl`,
> `ModerateImageUrl`, `AnalyzeSentimentUrl`, `TranslateCatalogUrl`, `SynthesizeVoiceUrl`,
> `GenerateDescriptionUrl`, `IndexEmbeddingsUrl`, `SemanticSearchUrl`, `ShoppingAssistantUrl`).

---

## 🎯 Objetivo

Cerrar el capstone: **ver todo TechModa AI funcionando de punta a punta**, preparar una **demo** presentable,
**documentar** el proyecto y hacer el **cleanup responsable** para no dejar costos corriendo. Esta sesión
también es tu **repaso integral** para el examen: cada feature mapea a un dominio.

---

## 🧩 Prerequisitos

- Idealmente **S1–S8 desplegadas** (y el índice de S7 construido). S9/S10 son deseables para la narrativa de gobernanza.

---

## 🧠 El concepto: del prototipo al producto responsable

Una solución de IA no es solo "que funcione el modelo". El examen evalúa que entiendas el **ciclo completo**:

1. **Capacidad** (D1–D3): el servicio correcto para cada tarea.
2. **Responsabilidad** (D4): moderación, accesibilidad, guardrails, sesgo, privacidad.
3. **Gobernanza** (D5): IAM, logging, costos, cumplimiento.
4. **Operación**: demo reproducible, documentación, y **apagar lo que no se usa** (FinOps).

### Mapa final feature ↔ dominio (úsalo como repaso)
| Feature | Servicio | Dominio |
|---------|----------|---------|
| Etiquetado de imágenes (S1) | Rekognition | D1 |
| Moderación + alt-text (S2) | Rekognition | D4 |
| Sentimiento (S3) | Comprehend | D1 |
| Traducción (S4) | Translate | D1 |
| Voz/accesibilidad (S5) | Polly | D1+D4 |
| Descripciones generadas (S6) | Bedrock | D2 |
| Búsqueda semántica/RAG (S7) | Bedrock embeddings | D3 |
| Asistente de compras (S8) | Bedrock RAG | D2+D3 |
| Guardrails/sesgo/privacidad (S9) | Bedrock Guardrails | D4 |
| IAM/logging/costos (S10) | gobernanza | D5 |

---

## 🚶 Paso a paso

### 1. Demo end-to-end

**Tu stack:** `techmoda-ai-jorge-damian-diaz-v2` (us-east-1)

**URLs de demo:**
- **API Router (CRUD):** `https://75eeu36ari7wdkar7iysizrvmi0mlzez.lambda-url.us-east-1.on.aws/`
- **S1 EnrichLabels:** `https://6fln2uj55fza7fvuf5fcvgcz6e0lftep.lambda-url.us-east-1.on.aws/`
- **S2 ModerateImage:** `https://nyilv5eaydnyrtpj2eoxtu6y3e0hzage.lambda-url.us-east-1.on.aws/`
- **S3 AnalyzeSentiment:** `https://is74o5mes2qews6ev5ik35vbo40dofva.lambda-url.us-east-1.on.aws/`
- **S4 TranslateCatalog:** `https://du5bvzdorupllbxr4p5vtkd4am0xzlwb.lambda-url.us-east-1.on.aws/`
- **S5 SynthesizeVoice:** `https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws/`
- **S6 GenerateDescription:** `https://3ch2cxnbjidwrkx3uwp3gdglz40wucty.lambda-url.us-east-1.on.aws/`
- **S7 SemanticSearch:** `https://7bl6pw3bs6glpqzaw574vpuudu0mbsxb.lambda-url.us-east-1.on.aws/`
- **S8 ShoppingAssistant:** `https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws/`

**Ejecutar la demo:**
```bash
STACK_NAME=techmoda-ai-jorge-damian-diaz-v2 \
  bash sessions/S11-integracion-demo-cleanup/demo.sh
```

El script resuelve automáticamente las Function URLs desde los outputs de CloudFormation y recorre las 8 features en orden, imprimiendo cada resultado. Ideal para grabar o presentar.

### 2. (Opcional) Integración en el frontend
El frontend base (React) ya consume la API. Mejoras sugeridas para la demo visual (no obligatorias):
- **Barra de búsqueda semántica** que llame a `GET /search?q=`.
- **Widget de chat** que llame a `POST /assistant`.
- Mostrar `aiDescription`, `altText` (en el `alt=""` de la imagen) y un botón "🔊 escuchar" con `audioUrl`.

> El objetivo del capstone es la **integración de IA**, no el pulido visual: con la demo por API alcanza
> para evidenciar cada dominio.

### 3. Documentar

**Tu stack:**
- **ApiUrl (Router):** `https://75eeu36ari7wdkar7iysizrvmi0mlzez.lambda-url.us-east-1.on.aws/`
- **FrontendUrl:** `http://techmoda-ai-jorge-damian-diaz-v2-frontend.s3-website-us-east-1.amazonaws.com`
- **ProductsTable:** `techmoda-ai-jorge-damian-diaz-v2-Products`
- **Region:** `us-east-1`

**Modelos de Bedrock usados:**
- **S6 (GenerateDescription):** `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- **S7 (Embeddings):** `amazon.titan-embed-text-v2:0`
- **S8 (ShoppingAssistant):** `us.anthropic.claude-haiku-4-5-20251001-v1:0` + Guardrails

**Capturar costos (tokens):**
```bash
# Ver los últimos logs de S6 (GenerateDescription)
aws logs tail /aws/lambda/techmoda-ai-jorge-damian-diaz-v2-GenerateDescription --follow

# Ver los últimos logs de S8 (ShoppingAssistant)
aws logs tail /aws/lambda/techmoda-ai-jorge-damian-diaz-v2-ShoppingAssistant --follow

# Ver logs de Bedrock invocation logging
aws logs tail /techmoda/techmoda-ai-jorge-damian-diaz-v2/bedrock-invocations --follow
```

Anotá el `usage.inputTokens` + `usage.outputTokens` de cada invocación como evidencia de FinOps (D5).

### 4. 🔴 Cleanup responsable (OBLIGATORIO)

**Tu stack:** `techmoda-ai-jorge-damian-diaz-v2`

```bash
# 1) Deshabilitar logging de Bedrock (si lo activaste en S10)
aws bedrock delete-model-invocation-logging-configuration --region us-east-1 || true

# 2) Borrar el guardrail (si lo creaste en S9)
# Nota: ver el ID en Bedrock console o con:
# aws bedrock list-guardrails --region us-east-1
# Luego: aws bedrock delete-guardrail --guardrail-identifier <id> --region us-east-1

# 3) Vaciar buckets (frontend + audio) y borrar el stack completo
bash scripts/delete-all.sh
```

`scripts/delete-all.sh` vacía los buckets S3 antes de eliminar el stack (CloudFormation no borra buckets
con objetos). Verificá al final que el stack ya no aparece:

```bash
aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 2>&1 | grep -q "does not exist" \
  && echo "✓ Stack eliminado" || echo "⚠ Revisá el estado del stack"
```

**Verificar que no quedan recursos:**
```bash
# Buckets de tu stack
aws s3 ls | grep techmoda-ai-jorge-damian

# Lambdas de tu stack
aws lambda list-functions --region us-east-1 | grep techmoda-ai-jorge-damian
```

Ambos deben retornar vacío ✓

---

## ✅ Checklist de validación (cierre del capstone)

**Stack:** `techmoda-ai-jorge-damian-diaz-v2`

- [ ] `demo.sh` corre las 8 features sin errores de permisos.
  ```bash
  STACK_NAME=techmoda-ai-jorge-damian-diaz-v2 bash sessions/S11-integracion-demo-cleanup/demo.sh
  ```
- [ ] Cada dominio AIF-C01 (D1–D5) está evidenciado:
  - [ ] **D1** (Foundation Models): S1, S3, S4, S5 (Rekognition, Comprehend, Translate, Polly)
  - [ ] **D2** (Generative): S6 (Bedrock descripción)
  - [ ] **D3** (RAG): S7 (embeddings), S8 (semantic search)
  - [ ] **D4** (Responsible AI): S2 (moderación), S9 (guardrails)
  - [ ] **D5** (Governance): S10 (IAM, logging, costos)
- [ ] El logging de Bedrock y el guardrail fueron eliminados (si se crearon).
  ```bash
  aws bedrock get-model-invocation-logging-configuration --region us-east-1 # Debe estar vacío
  ```
- [ ] `scripts/delete-all.sh` dejó la cuenta sin recursos del capstone.
- [ ] Verificación final:
  ```bash
  aws s3 ls | grep techmoda-ai-jorge-damian  # ← debe estar vacío
  aws lambda list-functions --region us-east-1 | grep techmoda-ai-jorge-damian  # ← debe estar vacío
  ```

---

## 📝 Qué entra en el examen (repaso integral)

- **Elegir el servicio correcto** por modalidad (imagen/texto/voz/generación).
- **Generativa (52%)**: FMs, prompt engineering, RAG, embeddings, alucinaciones, fine-tuning vs. RAG.
- **Responsible AI**: sesgo, seguridad, privacidad, transparencia, accesibilidad, HITL, guardrails.
- **Gobernanza**: IAM mínimo privilegio, logging, costos, cumplimiento, responsabilidad compartida.

---

## 💸 Costo + 🧹 Cleanup

**Costo:** $0 tras el cleanup. Mientras el stack vive, el costo en reposo es mínimo (Lambda/DynamoDB
on-demand no cobran sin tráfico); el costo real es **por invocación** de los servicios de IA.

**Ver el costo final de tu stack:**
```bash
# En AWS Console: Billing → Cost Allocation Tags → Filtra por Project=techmoda-ai-capstone
# O via CLI:
aws ce get-cost-and-usage \
  --time-period Start=2026-09-01,End=2026-09-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filter.json

# Donde filter.json tiene:
# { "Tags": { "Key": "Project", "Values": ["techmoda-ai-capstone"] } }
```

**Cleanup obligatorio:**
```bash
cd /workshop/techmoda-ai-capstone
bash scripts/delete-all.sh
```

**Verificar que todo fue borrado:**
```bash
aws cloudformation describe-stacks --stack-name techmoda-ai-jorge-damian-diaz-v2 --region us-east-1 2>&1 | head -3
# Debe mostrar: "Stack with id techmoda-ai-jorge-damian-diaz-v2 does not exist"
```
