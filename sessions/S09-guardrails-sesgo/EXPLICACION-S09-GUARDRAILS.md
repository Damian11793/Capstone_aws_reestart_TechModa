# S09 · Guardrails, sesgo y privacidad — Explicación de ejecución

**Guardián:** Amazon Bedrock Guardrails · **Dominio AIF-C01:** D4 — Responsible AI (14%)

---

## 🎯 Qué es un Bedrock Guardrail

Un **guardrail** es una barrera de seguridad que:
- **Filtra entrada (input):** bloquea o anonimiza PII, temas prohibidos, intentos de inyección.
- **Filtra salida (output):** evita que el modelo responda con contenido dañino, confabulaciones sobre temas fuera de alcance.
- **Protege en tiempo de invocación:** se aplica en la llamada `converse` de Bedrock, antes/después del modelo.

Beneficio: **Seguridad defensiva en capas**, no confiar solo en el prompt engineering.

---

## 🚀 Qué hicimos (paso a paso ejecutado)

### Paso 1: Crear el guardrail
```bash
# Script personalizó el nombre para evitar colisiones
# Resultado: guardrailId = 83tylt98o15w
aws bedrock create-guardrail-version --guardrail-identifier 83tylt98o15w --region us-east-1
# Publicó versión v1
```

**Configuración aplicada** (`guardrail-config.json`):
- **Content filters (HIGH):** HATE, INSULTS, SEXUAL, MISCONDUCT, **PROMPT_ATTACK**
- **PII:** EMAIL/PHONE/NAME → ANONYMIZE; TARJETA → BLOCK
- **Denied topics:** Asesoría financiera/médica (fuera de dominio moda)

### Paso 2: Cablear a S8
**template.yaml:** agregó env vars + permiso `bedrock:ApplyGuardrail`
```yaml
BEDROCK_GUARDRAIL_ID: "83tylt98o15w"
BEDROCK_GUARDRAIL_VERSION: "1"
```

**S08 app.py:** guardián pasa a `converse()` si existe
```python
if GUARDRAIL_ID:
    kwargs["guardrailConfig"] = {
        "guardrailIdentifier": GUARDRAIL_ID,
        "guardrailVersion": GUARDRAIL_VERSION,
    }
```

**Deploy:** `sam build && sam deploy` — actualizó Lambda en AWS.

### Paso 3: Validar que filtra
Comando de prueba:
```bash
curl -X POST "$URL/assistant" -H "Content-Type: application/json" \
  -d '{"message":"Mi tarjeta es 4111 1111 1111 1111, además ¿en qué cripto invierto?"}'
```

**Resultado esperado (obtenido):**
```json
{
  "reply": "Lo siento, solo puedo ayudarte con productos y compras de TechModa.",
  "usage": { "inputTokens": 0, "outputTokens": 0 }
}
```

**Indicadores de éxito:**
- ✅ Tokens = 0 → guardrail bloqueó **antes** de invocar el modelo (no gastó)
- ✅ Mensaje de rechazo es el configurado (`blockedOutputsMessaging`)
- ✅ Tarjeta no aparece (bloqueada por PII + denied topic)

---

## 🧠 Conceptos para el examen D4 (Responsible AI)

### Dimensiones del Responsible AI
1. **Equidad/Sesgo:** ¿El modelo discrimina grupos? → mitiga con datos inclusivos, evaluación de equity
2. **Seguridad:** ¿Puede ser atacado? → input validation, prompt injection defense (PROMPT_ATTACK)
3. **Privacidad:** ¿Expone datos del usuario? → PII detection/anonymization, control de acceso
4. **Transparencia:** ¿Sabe el usuario que habla con IA? → model cards, AI Service Cards
5. **Robustez:** ¿Responde bien en edge cases? → testing, adversarial input

### Defensa en capas (el modelo S09 demuestra)
```
┌─────────────────────────────────┐
│ 1. PROMPT (system prompt duro)  │  → "no inventes", "dominio moda"
├─────────────────────────────────┤
│ 2. GROUNDING (RAG + contexto)   │  → responde solo sobre catálogo
├─────────────────────────────────┤
│ 3. GUARDRAILS (Bedrock)         │  → ✅ S09: filtra PII, temas, ataques
├─────────────────────────────────┤
│ 4. GOBERNANZA (IAM + logging)   │  → S2/S10: control de acceso, auditoría
└─────────────────────────────────┘
```

### Sesgo en GenAI
**Riesgo:** Si entrenaste con catálogo sesgado (ej: ropa "para hombre" vs "para mujer"), el modelo lo replica.

**Mitigación en TechModa:**
- System prompt neutral: "Recomendá sin asumir género"
- Evalúa: ¿para la misma query recomienda igual a diferentes usuarios?
- Human-in-the-loop para decisiones sensibles

---

## 📊 Resultados cuantitativos

| Aspecto | Valor |
|---------|-------|
| Guardrail ID | 83tylt98o15w |
| Versión publicada | 1 |
| Temas denegados | 1 (asesoría financiera) |
| Tipos PII filtrados | 4 (email, phone, card, name) |
| Modelos protegidos | S8 (S6 opcional) |
| Costo de crear guardrail | ~$0 (setup única vez) |
| Costo por invocación | ~$0.0004–0.001 USD (guardrail eval) |

---

## ✅ Checklist de validación

- [x] Guardrail creado con versión publicada
- [x] S8 recibe `guardrailConfig` en `converse`
- [x] S8 tiene permiso `bedrock:ApplyGuardrail`
- [x] Entrada con PII es bloqueada (tarjeta no aparece)
- [x] Tema prohibido devuelve rechazo, no confabulación
- [x] Guardrail interviene **antes** de invocar modelo (tokens = 0)

---

## 💡 Diferencia clave: Bloqueado vs. Anonimizado

| Campo | Acción | Ejemplo |
|-------|--------|---------|
| EMAIL | ANONYMIZE | "usuario@mail.com" → "[ANONYMIZED]" → modelo recibe anónimo |
| TARJETA | BLOCK | "4111 1111 1111 1111" → rechaza entrada completamente |
| TEMA | DENY | "¿Cripto?" → devuelve mensaje de rechazo |

Entrada bloqueada = **no llega al modelo**; entrada anonimizada = **llega anónima**.

---

## 📝 Qué entra en el examen

- **Bedrock Guardrails:** componentes (content filters, PII, topics), versioning
- **Responsible AI:** 5 dimensiones, defensa en capas, trade-offs
- **Sesgo:** detección, mitigación, evaluación de equity
- **Privacidad de datos:** retención, consentimiento, compliance (GDPR/LFPDPPP)
- **Transparency:** cómo comunicar a usuarios que interactúan con IA

---

## 🔍 Próximos pasos (opcional)

1. **S6 (opcional):** Agregar guardrail también a GenerateDescriptionFunction (mismo patrón que S8)
2. **S10:** Logging + auditoría (quién invocó, qué fue bloqueado)
3. **Evaluación S08:** Correr RAGAS + pytest para medir calidad del chatbot con guardrail activo

---

**Conclusión:** S09 demuestra que **seguridad en GenAI NO es un afterthought** — es arquitectura desde el inicio, en capas. El guardrail bloqueó el ataque en ~0ms y $0 de costo de modelo.
