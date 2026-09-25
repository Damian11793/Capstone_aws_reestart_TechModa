# 📊 Dashboard de Análisis de Sentimientos

## ¿Qué es?

Nueva pestaña en el frontend que muestra **análisis en tiempo real de los sentimientos de los usuarios** mientras interactúan con el ChatBot usando **AWS Comprehend**.

---

## ¿Dónde se ve?

Abre el frontend y verás 3 pestañas:
1. 🛍️ **Productos** — Catálogo de moda
2. 💭 **Sentimientos** ← **NUEVA** (análisis Comprehend)
3. 📊 **Evaluación** — Resultados RAGAS

---

## ¿Qué muestra?

### 1️⃣ **Estadísticas Generales** (tarjetas)
```
Total Mensajes    | 😊 Positivos | 😞 Negativos | 😐 Neutral | ⭐ Score Promedio
     25           |      12      |      5       |     8      |      87%
```

Cada métrica muestra:
- **Conteo absoluto**
- **Porcentaje relativo**

### 2️⃣ **Distribución de Sentimientos** (Pie Chart)
Gráfico circular mostrando:
- 🟢 **Positivos** (verde)
- 🔴 **Negativos** (rojo)
- ⚪ **Neutral** (gris)
- 🟡 **Mixtos** (ámbar)

### 3️⃣ **Tendencia de Scores** (Bar Chart)
Gráfico de barras con los últimos 20 mensajes:
- Eje X: Hora del mensaje
- Eje Y: Confianza (0–100%)
- Cada barra = puntuación de confianza del análisis

### 4️⃣ **Historial Detallado** (Tabla)
Últimos 50 mensajes con:

| Hora | Sentimiento | Score | Mensaje |
|------|-------------|-------|---------|
| 14:30:45 | 😊 POSITIVE | 95% | "Me encanta este producto" |
| 14:32:12 | 😞 NEGATIVE | 87% | "No me gusta nada" |
| 14:33:50 | 😐 MIXED | 72% | "Está bien, nada especial" |

---

## 🔄 Cómo Funciona

### Flujo

```
1. Usuario escribe en ChatBot
    ↓
2. Mensaje se envía a S8 (Claude)
    ↓
3. En paralelo → S3 (Comprehend) analiza sentimiento
    ↓
4. Se recibe:
   - Respuesta del chatbot
   - Análisis de sentimiento (tipo + puntuación)
    ↓
5. Se guarda en localStorage:
   {
     timestamp: "2026-09-23T14:30:45.123Z",
     message: "Me encanta este producto",
     sentiment: "POSITIVE",
     score: 0.95
   }
    ↓
6. Dashboard lee localStorage y renderiza gráficos
```

### Storage

- **Dónde**: `localStorage` del navegador (no se pierde al recargar)
- **Clave**: `sentiment_history` (array de objetos)
- **Persistencia**: Mientras la pestaña esté abierta (se limpia si haces "Limpiar")

---

## 🎯 Botones de Acción

### 📥 Descargar JSON
```bash
Descarga un archivo JSON con todo el historial:

sentiment-analysis-2026-09-23.json
{
  "timestamp": "2026-09-23T14:30:45.123Z",
  "message": "...",
  "sentiment": "POSITIVE",
  "score": 0.95
}
```

Sirve para:
- ✅ Análisis posterior
- ✅ Reportes
- ✅ Integración con BI

### 🗑️ Limpiar
- Borra todo el historial de `localStorage`
- Resetea todas las gráficas
- **No se puede deshacer**

---

## 📈 Interpretación de Datos

### Scores de Confianza

| Rango | Significado |
|-------|------------|
| **90–100%** | Muy seguro (sentimiento claro) |
| **70–89%** | Seguro (sentimiento probable) |
| **50–69%** | Dudoso (podría ser mixto) |
| **<50%** | Muy dudoso (ambiguo) |

### Distribución Ideal

Para un **buen servicio al cliente**:
- ✅ Positivos: **>60%**
- ⚠️ Negativos: **<15%**
- ⚠️ Neutral: **20–30%**
- ⚠️ Mixtos: **<5%**

Si ves muchos negativos o mixtos → revisar:
1. ¿El chatbot responde bien?
2. ¿Hay productos fuera de stock?
3. ¿El catálogo necesita actualización?

---

## 🔧 Casos de Uso

### 1. Monitoreo de Satisfacción
```
Cada día, revisar:
- % de positivos vs negativos
- Score promedio
- Últimos mensajes negativos
```

### 2. Entrenamiento del Modelo
```
Si ves muchos NEUTRAL o MIXED:
- Analizar los mensajes
- Mejorar el system prompt del chatbot
- Agregar más productos al catálogo
```

### 3. Reportes a Stakeholders
```
Descargar JSON → Importar a Excel/Tableau
→ Crear dashboard ejecutivo

"En los últimos 100 mensajes:
- 78% positivos (tendencia al alza)
- Score promedio: 0.91 (muy bueno)
- 0 mensajes muy negativos"
```

---

## 🔐 Privacidad

- ✅ **Sin datos en servidor**: Los sentimientos se guardan en `localStorage` (navegador)
- ✅ **No se envían a AWS**: Solo el análisis (ya hecho por Comprehend)
- ⚠️ **Datos locales**: Se pierden si limpias caché del navegador
- ✅ **Exportable**: Descarga JSON si quieres hacer backup

---

## 📝 Ejemplo de Uso

### Paso 1: Abre el ChatBot
```
1. Abre la página → Frontend carga
2. Click en botón flotante 💬
3. Envía 5-10 mensajes de prueba
```

### Paso 2: Ve a Sentimientos
```
1. Click en pestaña "💭 Sentimientos"
2. Verás gráficos actualizados en tiempo real
```

### Paso 3: Analiza
```
- ¿Qué sentimiento predomina?
- ¿El score promedio es alto?
- ¿Hay un patrón en los mensajes negativos?
```

### Paso 4: Exporta (opcional)
```
Click en "📥 Descargar JSON"
→ Guarda analysis-FECHA.json
→ Úsalo en Excel/Tableau/reportes
```

---

## 🐛 Troubleshooting

### P: No veo datos en el dashboard
**R**: Los sentimientos solo se guardan cuando envías mensajes en el ChatBot. Envía primero uno o dos mensajes.

### P: Los datos desaparecieron
**R**: Probablemente limpiaste localStorage. Usa "Limpiar" solo si realmente quieres borrar.

### P: ¿Por qué algunos mensajes no tienen sentimiento?
**R**: Si Comprehend falla (p.ej., timeout), el mensaje se muestra sin análisis. Reinenta.

### P: ¿Puedo exportar a otra herramienta?
**R**: Sí, el JSON es estándar. Puedes abrir en:
- Excel: Pega el JSON
- Google Sheets: Importa CSV (convierte primero)
- Tableau/Power BI: Conecta con JSON API

---

## 🔗 Servicios AWS Usados

| Servicio | Función |
|----------|---------|
| **Comprehend** (S03) | Análisis de sentimiento |
| **Lambda** | Ejecuta análisis |
| **localStorage** | Almacena historial local |

**Costo**: ~$0.0001 por análisis de sentimiento

---

## 📚 Documentación Relacionada

- [ChatBot.tsx](frontend/src/components/ChatBot.tsx) — Componente de chat (integración S3)
- [SentimentAnalysis.tsx](frontend/src/components/SentimentAnalysis.tsx) — Dashboard (esta pestaña)
- [COSTOS-RESUMEN.md](COSTOS-RESUMEN.md) — Precios de S03 Comprehend
- [S03 GUIA](sessions/S03-analisis-sentimientos-comprehend/GUIA.md) — Sesión de IA original

---

**¡Disfruta analizando sentimientos! 📊**
