# ⚡ RelevaCAD

> **PWA Profesional para Relevamiento Topológico, Geometría Paramétrica y Diseño Electromecánico según Norma AEA 90364-771**

🌐 **Demo en vivo (GitHub Pages):** [https://FedericoCAlonso.github.io/relevacad/](https://FedericoCAlonso.github.io/relevacad/)

---

## 📐 Flujo de Trabajo en 3 Fases

```
 ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
 │   FASE 1: TOPOLOGÍA       │ ──▶  │  FASE 2: PARAMETRIZACIÓN  │ ──▶  │  FASE 3: ENSAMBLAJE 2D    │
 │                           │      │                           │      │                           │
 │ • Nodos de Ambientes      │      │ • Medidas Interiores      │      │ • Espesor de Muros (10cm) │
 │ • Puntos de Ingreso       │      │ • 4 Paredes Independientes│      │ • Aberturas CAD Reales    │
 │ • Red Eléctrica AEA       │      │ • Diagonal / Falsa Escuad.│      │ • Snapping Magnético      │
 │ • Modo "Conectar Cadena"  │      │ • Bloqueo de Ángulos 90°  │      │ • Toolbar Compacta        │
 └───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

---

## ✨ Características Principales

### 🏛️ 1. Fase Topológica y Red Eléctrica
- **Capas Visuales Exclusivas:** Alternancia limpia entre *🏛️ Arquitectura* (solo recintos y aberturas orientadas $N, S, E, O$) y *⚡ Cañerías y Bocas* (tendido electromecánico).
- **Modo Conexión en Cadena (*Click-to-Connect*):** Trazado ultra-rápido de cañerías haciendo clic en secuencia sobre los nodos con asignación automática de conductores.
- **Iluminación Bidireccional de Subárboles:** Al tocar cualquier boca o tablero, se rastrea aguas arriba hacia el tablero alimentador y aguas abajo hacia todas las subramas del circuito, atenuando el resto de la instalación al $15\%$.
- **Notación Reglamentaria AEA:** Simbología normalizada en cañerías (`C1-IUG [ || o- T ' ] • Ø19`).
- **Inspector de Cañería:** Cálculo en tiempo real del **Factor de Ocupación AEA 90364-771** ($\le 35\%$), soporte multicircuito y caídas de tensión.

### 📐 2. Fase de Parametrización & Falsa Escuadra
- **Dimensionamiento por Paredes Independientes:** Longitudes individuales ($L_N, L_S, L_E, L_O$) tomadas desde el interior de los ambientes con distanciómetro láser.
- **Triangulación y Falsa Escuadra:** Verificación por diagonal ($D_{\text{SO}\rightarrow\text{NE}}$) con cálculo trigonométrico exacto por ley de cosenos y cálculo de superficie por fórmula de Gauss (Shoelace).
- **Restricciones Angulares:** Candados para fijar vértices a $90^\circ$ o dejarlos libres.

### 🏗️ 3. Fase de Ensamblaje 2D CAD
- **Muros con Espesor Real:** Renderizado de muros perimetrales e interiores ($7, 10, 15, 20\,\text{cm}$, default $10\,\text{cm}$).
- **Interrupción de Mampostería en Aberturas:** Los vanos, puertas y ventanas abren el muro y dibujan los arcos de giro CAD normalizados.
- **Snapping Magnético 2D:** Guías de alineación ortogonal automáticas con umbral de captura de $15\,\text{px}$.

---

## 🛠️ Instalación y Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/FedericoCAlonso/relevacad.git
cd relevacad

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev

# 4. Compilar para producción
npm run build
```

---

## 🚀 Despliegue en GitHub Pages

Este proyecto incluye un **GitHub Actions Workflow** automatizado (`.github/workflows/deploy.yml`).

Para activarlo en el repositorio de GitHub:
1. Ve a tu repositorio en GitHub: **`Settings` ➔ `Pages`**.
2. En la sección **`Build and deployment` ➔ `Source`**, selecciona **`GitHub Actions`**.
3. Cada vez que hagas `git push origin main`, GitHub compilará y desplegará la aplicación automáticamente en:
   👉 **`https://FedericoCAlonso.github.io/relevacad/`**

---

## 📄 Licencia

MIT License - Desarrollado para relevamiento arquitectónico e ingeniería electromecánica.
