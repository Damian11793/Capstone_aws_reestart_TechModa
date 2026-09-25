#!/bin/bash
#
# Setup del entorno de desarrollo del capstone TechModa AI.
# Corre automáticamente al crear el devcontainer (postCreateCommand).
#
# No usa `set -e` a propósito: queremos ejecutar TODAS las verificaciones y
# mostrar un resumen completo, no abortar en la primera que falle.

echo "================================================"
echo "  TechModa AI Capstone — Setup del entorno"
echo "================================================"
echo ""

FALLAS=0
aviso()  { echo "  ⚠️  $1"; }
error()  { echo "  ❌ $1"; FALLAS=$((FALLAS+1)); }
ok()     { echo "  ✅ $1"; }

# ---------------------------------------------------------------- SAM CLI ----
if command -v sam >/dev/null 2>&1; then
    ok "SAM CLI ya instalado: $(sam --version 2>&1)"
else
    echo "Instalando AWS SAM CLI…"
    pip3 install --user --quiet aws-sam-cli
    grep -q '.local/bin' ~/.bashrc 2>/dev/null || \
        echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc
    export PATH="$PATH:$HOME/.local/bin"
    command -v sam >/dev/null 2>&1 \
        && ok "SAM CLI instalado: $(sam --version 2>&1)" \
        || error "No se pudo instalar SAM CLI"
fi

# ------------------------------------------------- Dependencias frontend ----
if [ -d frontend ]; then
    echo ""
    echo "Instalando dependencias del frontend…"
    (cd frontend && npm install --silent) \
        && ok "Frontend listo (npm run dev / npm test)" \
        || error "Falló npm install en frontend/"
fi

# ----------------------------------------------------- Verificaciones -------
echo ""
echo "Verificando versiones (deben coincidir con los Runtime de las Lambdas)"
echo "----------------------------------------------------------------------"

# Python: las 9 Lambdas de IA declaran Runtime: python3.12.
# Si la versión local es otra, `sam build` falla con:
#   PythonPipBuilder:Validation - Binary validation failed for python ...
#   did not satisfy constraints for runtime: python3.12
PY_REQ="3.12"
if command -v python3 >/dev/null 2>&1; then
    PY_VER="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
    if [ "$PY_VER" = "$PY_REQ" ]; then
        ok "Python $PY_VER (coincide con Runtime python3.12)"
    else
        error "Python $PY_VER, se necesita $PY_REQ — 'sam build' va a fallar en las Lambdas de IA.
      Arreglo: reconstruí el devcontainer (Dev Containers: Rebuild Container).
      El feature de Python está fijado en $PY_REQ en .devcontainer/devcontainer.json."
    fi
else
    error "No hay python3 en el PATH"
fi

# Node: las Lambdas CRUD declaran Runtime: nodejs22.x.
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR="$(node --version | sed 's/^v\([0-9]*\).*/\1/')"
    if [ "$NODE_MAJOR" -ge 22 ]; then
        ok "Node $(node --version) (coincide con Runtime nodejs22.x)"
    else
        aviso "Node $(node --version); las Lambdas usan nodejs22.x. El build igual funciona
      (solo copia el código), pero conviene alinear para probar local."
    fi
else
    error "No hay node en el PATH"
fi

command -v aws >/dev/null 2>&1 \
    && ok "AWS CLI: $(aws --version 2>&1)" \
    || error "No hay AWS CLI en el PATH"

# --------------------------------------------------------------- Resumen ----
echo ""
echo "================================================"
if [ "$FALLAS" -eq 0 ]; then
    echo "  ✅ Entorno listo"
else
    echo "  ❌ Entorno con $FALLAS problema(s) — resolvelos antes de seguir"
fi
echo "================================================"
echo ""
echo "Próximos pasos:"
echo "  1. Configurar credenciales AWS  ->  aws configure   (ver AWS_CREDENTIALS_SETUP.md)"
echo "  2. Validar que todo funciona    ->  bash scripts/validate-all.sh --static"
echo "  3. Desplegar                    ->  bash scripts/deploy-all.sh"
echo "  4. Empezar por la sesión S00    ->  sessions/S00-base/GUIA.md"
echo ""

exit 0
