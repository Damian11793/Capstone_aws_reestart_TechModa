#!/usr/bin/env bash
# S9 · Crea el Bedrock Guardrail de TechModa a partir de guardrail-config.json.
# Devuelve el guardrailId y guardrailArn. Inyectá el ID como BEDROCK_GUARDRAIL_ID
# en las Lambdas S6/S8 (env var) y agregá el guardrailConfig a la llamada converse.
#
# Requiere permisos bedrock:CreateGuardrail en TU identidad de la CLI (a propósito NO
# están en el rol de ninguna Lambda: crear un guardrail es una tarea de administración,
# de una sola vez, no algo que la app haga en runtime).
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="$DIR/guardrail-config.json"

echo "→ Creando guardrail en ${REGION} desde ${CFG}"

# Extraemos los bloques de policy del JSON (quitando el campo _comment) y los pasamos
# como argumentos a la CLI. Para simplicidad usamos --cli-input-json.
TMP=$(mktemp)
python3 - "$CFG" "$TMP" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
cfg.pop("_comment", None)
json.dump(cfg, open(sys.argv[2], "w"))
PY

aws bedrock create-guardrail \
  --region "$REGION" \
  --cli-input-json "file://$TMP" \
  --query '{id:guardrailId, arn:guardrailArn, version:version}' \
  --output table

rm -f "$TMP"
echo "✓ Guardá el guardrailId → será BEDROCK_GUARDRAIL_ID en S6/S8."
echo "  Recordá publicar una versión:  aws bedrock create-guardrail-version --guardrail-identifier <id>"
