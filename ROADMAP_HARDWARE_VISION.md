# 📱 Roadmap de Innovación Hardware & Visión en Obra (RelevaCAD)

Este documento recopila las líneas de investigación e implementación para dotar a **RelevaCAD** de capacidades avanzadas de relevamiento en sitio aprovechando el hardware móvil nativo, bajo la filosofía de operación en obra **"One Eye, One Hand"** (mínima fricción, cero costo de APIs cloud y funcionamiento 100% offline).

---

## 1. 📐 Medición de Recintos y Distancias por Cámara (Sin LiDAR)

### Objetivo
Permitir al instalador relevar las longitudes de paredes interiores ($L_N, L_S, L_E, L_O$) y diagonales ($D_{SO \to NE}$) en la **Fase 2 (Parametrización)** caminando con el teléfono y marcando vértices en el espacio real, como alternativa al ingreso manual o al distanciómetro láser.

### Fundamento Técnico
- **Odometría Visual-Inercial (VIO)**: Fusión de la cámara web + acelerómetro y giroscopio (IMU) del dispositivo para estimar desplazamiento métrico 3D mediante triangulación continua.
- **WebXR Device API (`hit-test`)**:
  - Estándar web soportado en Android Chrome vía ARCore.
  - No requiere sensores LiDAR ni hardware propietario caro.
  - Precisión esperada: Margen de error de 3% a 6% en distancias residenciales estándar (suficiente para relevamiento eléctrico preliminar).
- **Fallback Monocular / Referencia Conocida**:
  - Detección de cajas estándar (caja rectangular 10×5 cm o caja octogonal 9×9 cm) mediante visión por computadora para calibrar escala en dispositivos sin WebXR completo.

### Flujo de Usuario Propuesto
1. Seleccionar pared a parametrizar (ej: Pared Norte).
2. El visor de cámara proyecta retícula de captura.
3. El usuario marca punto inicial en esquina inferior (pared-piso).
4. El usuario desplaza el teléfono al vértice opuesto y marca punto final.
5. El valor métrico ($3.45\,\text{m}$) se asigna automáticamente al campo correspondiente sin tocar teclado.

---

## 2. ⚡ Detección Local de Tableros Eléctricos (Edge AI sin APIs Pagas)

### Objetivo
Relevar el estado inicial del tablero eléctrico existente (módulos ocupados, reservas libres, presencia de disyuntor diferencial, estado general) mediante una foto tomada con el celular, sin depender de conexión a internet ni incurrir en costos de suscripciones a LLMs en la nube (OpenAI, Anthropic, etc.).

### Arquitectura Técnica
- **Motor de Inferencia**: **ONNX Runtime Web** ejecutado en el cliente vía WebAssembly (Wasm) o WebGPU.
- **Modelo de Detección**: **YOLOv8-nano / YOLOv11-nano** (~6 a 12 MB de peso):
  - Inferencia local en 40-80 ms por cuadro.
  - Conjunto acotado de clases de entrenamiento:
    - `termica_unipolar`
    - `termica_bipolar`
    - `termica_tetrapolar`
    - `disyuntor_diferencial`
    - `modulo_ciego / vacio`
    - `tipo_gabinete` (chapa embutir / PVC superficie)
- **OCR Local (Edge)**:
  - Lectura de serigrafías estándar (`C10`, `C16`, `C20`, `40A 30mA`) usando la Web API nativa `TextDetector` o Tesseract.js local para corroborar calibres de protecciones.

---

## 3. 🔄 Integración con el Cotizador IEBA (`pwaCotizadorIeba`)

### Objetivo
Conectar RelevaCAD como el "alimentador natural" del cotizador de presupuestos:
- Exportación directa de cómputo métrico (metros lineales de cañerías por diámetro, cantidad de bocas IUG/TUG/TUE por circuito, módulos de tablero requeridos).
- Generación con un solo clic de las partidas presupuestarias y Trabajos Tipo paramétricos en el Cotizador.
