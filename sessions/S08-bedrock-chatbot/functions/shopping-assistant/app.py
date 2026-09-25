"""
S8 · SHOPPING ASSISTANT  —  Asistente de compras conversacional (RAG sobre el catálogo).

Flujo:
  POST /assistant
    body: { "message": "busco algo para una boda de día",
            "history": [ {"role":"user","text":"..."}, {"role":"assistant","text":"..."} ] }

    1. RETRIEVAL: embebe el mensaje y recupera los productos más relevantes (reusa los
       embeddings creados en S7).
    2. AUGMENT: arma un contexto con esos productos (grounding).
    3. GENERATION: llama a un foundation model con un system prompt + el contexto + el
       historial, y devuelve una respuesta conversacional anclada SOLO en el catálogo.

Es el patrón RAG completo: Retrieval (S7) + Augmented Generation (S6) sobre datos propios.

Servicio de IA: Amazon Bedrock (embeddings + generación).
Dominio AIF-C01: D2 (GenAI / prompt engineering) + D3 (RAG / aplicaciones de FM).
"""

import json
import math
import os
import base64
import re
import urllib3

import boto3

PRODUCTS_TABLE = os.environ["PRODUCTS_TABLE"]
EMBED_MODEL_ID = os.environ.get("EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")
CHAT_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
TOP_K = int(os.environ.get("ASSISTANT_TOP_K", "3"))
MAX_TOKENS = int(os.environ.get("BEDROCK_MAX_TOKENS", "400"))
GUARDRAIL_ID = os.environ.get("BEDROCK_GUARDRAIL_ID")
GUARDRAIL_VERSION = os.environ.get("BEDROCK_GUARDRAIL_VERSION", "DRAFT")
S6_URL = os.environ.get("S6_URL")

SYSTEM_PROMPT = (
    "Eres el asistente de compras de TechModa, una tienda de moda. Respondé en español neutral, "
    "amable y conciso. Recomendá ÚNICAMENTE productos del CATÁLOGO que se te entrega como "
    "contexto; si nada encaja, decirlo con honestidad y sugerir refinar la búsqueda. No "
    "inventes productos, precios ni características que no estén en el contexto. Se amable en todo momento con el cliente"
)

bedrock = boto3.client("bedrock-runtime")
rekognition = boto3.client("rekognition")
table = boto3.resource("dynamodb").Table(PRODUCTS_TABLE)


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def _embed(text):
    resp = bedrock.invoke_model(
        modelId=EMBED_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({"inputText": text}),
    )
    return json.loads(resp["body"].read())["embedding"]


def _cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def _retrieve(query, k):
    q_vec = _embed(query)
    items = table.scan().get("Items", [])
    scored = []
    for item in items:
        emb = item.get("embedding")
        if not emb:
            continue
        try:
            vec = json.loads(emb)
        except (TypeError, json.JSONDecodeError):
            continue
        scored.append((_cosine(q_vec, vec), item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:k]]


def _detect_image_labels(image_base64):
    """Detecta labels en una imagen base64 usando Rekognition."""
    try:
        image_bytes = base64.b64decode(image_base64)
        result = rekognition.detect_labels(
            Image={"Bytes": image_bytes},
            MaxLabels=5,
            MinConfidence=70,
        )
        labels = [l["Name"] for l in result.get("Labels", [])]
        return labels
    except Exception as e:
        print(f"Rekognition error: {repr(e)}")
        return []


def _detect_description_intent(message):
    """Detecta si el usuario pide una descripción de un producto."""
    patterns = [
        r"dame\s+(?:una\s+)?descripción",
        r"cuentam[e]?\s+(?:más\s+)?sobre",
        r"cuéntam[e]?\s+(?:más\s+)?sobre",
        r"describe[a-z]*\s+",
        r"(?:qué\s+)?describe",
        r"(?:qué\s+)?puedo\s+saber\s+de\s+(?:esta?|la)",
        r"información\s+de",
        r"detalles?\s+de",
    ]
    msg_lower = message.lower()
    return any(re.search(p, msg_lower) for p in patterns)


def _generate_description(product_id, tone="elegante y cercano"):
    """Llama a S6 para generar descripción del producto."""
    if not S6_URL:
        return None
    try:
        http = urllib3.PoolManager()
        url = f"{S6_URL.rstrip('/')}/products/{product_id}/describe"
        resp = http.request(
            "POST",
            url,
            headers={"Content-Type": "application/json"},
            body=json.dumps({"tone": tone, "save": False}),
        )
        if resp.status == 200:
            data = json.loads(resp.data.decode("utf-8"))
            return data.get("description")
        else:
            print(f"S6 error ({resp.status}): {resp.data}")
            return None
    except Exception as e:
        print(f"S6 call error: {repr(e)}")
        return None


def _format_context(products, image_labels=None):
    if not products:
        return "(catálogo sin coincidencias relevantes)"
    lines = []
    for p in products:
        price = p.get("price", "")
        lines.append(
            f"- {p.get('name','')} | categoría: {p.get('category','')} | precio: {price} | "
            f"{p.get('description','')}"
        )
    context = "\n".join(lines)
    if image_labels:
        context = f"(Detectado en imagen: {', '.join(image_labels)})\n{context}"
    return context


def _build_messages(history, message, context_block):
    messages = []
    for turn in history or []:
        role = turn.get("role")
        text = turn.get("text") or turn.get("content")
        if role in ("user", "assistant") and text:
            messages.append({"role": role, "content": [{"text": text}]})
    # Mensaje actual con el contexto recuperado inyectado (grounding).
    user_text = (
        f"CATÁLOGO RELEVANTE:\n{context_block}\n\n"
        f"PREGUNTA DEL CLIENTE: {message}"
    )
    messages.append({"role": "user", "content": [{"text": user_text}]})
    return messages


def lambda_handler(event, context):
    print("Event:", json.dumps(event))

    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": json.dumps({}),
        }

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Body JSON inválido."})

    message = (body.get("message") or "").strip()
    image_base64 = body.get("image")

    if not message and not image_base64:
        return _response(400, {"error": "Enviá 'message' o 'image' con la consulta del cliente."})

    # Accept both 'history' (legacy) and 'conversationHistory' (new frontend format)
    history = body.get("conversationHistory") or body.get("history", [])

    # Detectar labels si hay imagen
    image_labels = []
    if image_base64:
        image_labels = _detect_image_labels(image_base64)
        if not message:
            message = f"Recomiéndame productos similares a: {', '.join(image_labels)}"
        print(f"Labels detectados: {image_labels}")

    try:
        products = _retrieve(message, TOP_K)

        # Si el usuario pide descripción, genérala con S6
        description_generated = None
        if products and _detect_description_intent(message):
            top_product = products[0]
            desc = _generate_description(top_product.get("productId"))
            if desc:
                description_generated = desc
                # Inyecta la descripción generada en el contexto
                product_with_desc = dict(top_product)
                product_with_desc["description"] = f"[Descripción generada por IA]: {desc}"
                products = [product_with_desc] + products[1:]

        context_block = _format_context(products, image_labels if image_labels else None)
        messages = _build_messages(history, message, context_block)
        kwargs = {
            "modelId": CHAT_MODEL_ID,
            "system": [{"text": SYSTEM_PROMPT}],
            "messages": messages,
            "inferenceConfig": {"maxTokens": MAX_TOKENS, "temperature": 0.5},
        }
        if GUARDRAIL_ID:
            kwargs["guardrailConfig"] = {
                "guardrailIdentifier": GUARDRAIL_ID,
                "guardrailVersion": GUARDRAIL_VERSION,
            }
        resp = bedrock.converse(**kwargs)
        reply = resp["output"]["message"]["content"][0]["text"].strip()
        usage = resp.get("usage", {})
    except Exception as e:  # noqa: BLE001
        print("Bedrock error:", repr(e))
        return _response(
            502,
            {
                "error": "Fallo del asistente",
                "detail": str(e),
                "hint": "¿Habilitaste los modelos en Bedrock y corriste POST /search/index (S7)?",
            },
        )

    response_data = {
        "reply": reply,
        "retrieved": [{"productId": p["productId"], "name": p.get("name", "")} for p in products],
        "model": CHAT_MODEL_ID,
        "usage": usage,
    }
    if description_generated:
        response_data["generated_description"] = description_generated

    return _response(200, response_data)

# CORS fix trigger v1
# CORS manual fix v2
# S08 Rekognition integration
