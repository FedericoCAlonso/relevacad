/**
 * Utility: Cotizador IEBA Interoperability Exporter
 * Genera el payload de datos y cómputo métrico listo para ser importado
 * directamente por Cotizador IEBA para armar presupuestos de materiales y mano de obra.
 */

import { RelevamientoProyecto, CotizadorIebaExportPayload } from '@/models/ProjectModel';
import { isMetricRoom } from '@/models/RoomModel';
import { calculatePolygonArea, calculateRoomPolygon } from '@/viewmodels/utils/polygonSolver';
import { TABIQUE_MATERIAL_CATALOG } from '@/models/GraphModel';

/**
 * Calcula el cómputo métrico completo del relevamiento y genera el payload de exportación.
 */
export function generateCotizadorIebaPayload(project: RelevamientoProyecto): CotizadorIebaExportPayload {
  const metricRooms = project.rooms.filter(isMetricRoom);

  // 1. Superficie total construida (m²)
  let superficieTotalM2 = 0;
  metricRooms.forEach((room) => {
    const vertices = calculateRoomPolygon(room);
    const area = calculatePolygonArea(vertices);
    superficieTotalM2 += area;
  });

  // 2. Conteo de bocas y artefactos por tipo AEA
  let bocasIUG = 0;
  let bocasTUG = 0;
  let bocasTUE = 0;

  metricRooms.forEach((room) => {
    room.electricalAssets.forEach((asset) => {
      const type = asset.type;
      if (
        type === 'ceiling_light' ||
        type === 'wall_light' ||
        type === 'switch_1_module' ||
        type === 'switch_2_module' ||
        type === 'switch_combo'
      ) {
        bocasIUG += 1;
      } else if (type === 'single_outlet_10a') {
        bocasTUG += 1;
      } else if (type === 'double_outlet_10a') {
        bocasTUG += 2; // 2 módulos de toma
      } else if (type === 'outlet_20a') {
        bocasTUE += 1;
      } else {
        bocasTUG += 1;
      }
    });
  });

  // Nodos específicos (Cajas de paso, Tableros)
  let cajasDePaso = 0;
  let tablerosPrincipales = 0;
  let tablerosSeccionales = 0;

  project.electricalNodes.forEach((node) => {
    if (node.tipo === 'caja_paso_comun' || node.tipo === 'caja_derivacion') cajasDePaso += 1;
    else if (node.tipo === 'tablero_principal') tablerosPrincipales += 1;
    else if (node.tipo === 'tablero_seccional') tablerosSeccionales += 1;
  });

  const totalBocas = bocasIUG + bocasTUG + bocasTUE + project.electricalNodes.length;

  // 3. Cañerías y canalizaciones por diámetro
  let metrosCaneriaTotal = 0;
  const metrosCaneriaPorDiametro: Record<number, number> = {};

  project.electricalTramos.forEach((tramo) => {
    const diam = tramo.diametroCañoMm || 19;
    const len = tramo.longitudMeters || 2.0;
    metrosCaneriaTotal += len;
    metrosCaneriaPorDiametro[diam] = Number(((metrosCaneriaPorDiametro[diam] || 0) + len).toFixed(2));
  });

  // 4. Metros de conductores por sección (mm²)
  const metrosConductoresPorSeccion: Record<string, number> = {
    '1.5': 0,
    '2.5': 0,
    '4.0': 0,
    '6.0': 0
  };

  project.electricalTramos.forEach((tramo) => {
    const len = tramo.longitudMeters || 2.0;
    tramo.conductores.forEach((cond) => {
      const seccStr = cond.seccionMm2 ? cond.seccionMm2.toFixed(1) : '2.5';
      const key = seccStr === '1.5' ? '1.5' : seccStr === '2.5' ? '2.5' : seccStr === '4.0' ? '4.0' : '6.0';
      metrosConductoresPorSeccion[key] = Number(
        ((metrosConductoresPorSeccion[key] || 0) + len).toFixed(2)
      );
    });
  });

  // 5. Mapeo de Circuitos Detectados
  const circuitosMap = new Map<string, { codigo: string; tipo: string; bocasCount: number; longitudAproxMetros: number }>();

  project.electricalTramos.forEach((tramo) => {
    const cod = tramo.circuitoCodigo || 'C1-IUG';
    if (!circuitosMap.has(cod)) {
      const isIUG = cod.includes('IUG') || cod.includes('ILUM');
      const isTUE = cod.includes('TUE') || cod.includes('AA');
      const tipo = isIUG ? 'Iluminación (IUG)' : isTUE ? 'Tomas Especiales (TUE)' : 'Tomas Generales (TUG)';
      circuitosMap.set(cod, {
        codigo: cod,
        tipo,
        bocasCount: 0,
        longitudAproxMetros: 0
      });
    }

    const c = circuitosMap.get(cod)!;
    c.longitudAproxMetros += tramo.longitudMeters || 2.0;
  });

  // Contar bocas asociadas a circuitos
  metricRooms.forEach((r) => {
    r.electricalAssets.forEach((a) => {
      if (a.circuitCode && circuitosMap.has(a.circuitCode)) {
        circuitosMap.get(a.circuitCode)!.bocasCount += 1;
      }
    });
  });

  // 6. Muros y Tabiques por Material (para canaleteado y mano de obra de albañilería)
  const murosPorMaterialMap = new Map<string, {
    materialType: string;
    materialLabel: string;
    espesorCm: number;
    metrosLineales: number;
    metrosCuadrados: number;
    admiteCanaleteado: boolean;
    metodoCanaleteado: string;
  }>();

  project.connections.forEach((conn) => {
    const matType = conn.wallProperties?.materialType || 'ladrillo_hueco_8';
    const matMeta = TABIQUE_MATERIAL_CATALOG[matType] || TABIQUE_MATERIAL_CATALOG.ladrillo_hueco_8;
    const thCm = conn.wallProperties?.thicknessMeters
      ? Math.round(conn.wallProperties.thicknessMeters * 100)
      : Math.round(matMeta.defaultThicknessMeters * 100);

    const key = `${matType}-${thCm}`;
    if (!murosPorMaterialMap.has(key)) {
      murosPorMaterialMap.set(key, {
        materialType: matType,
        materialLabel: matMeta.label,
        espesorCm: thCm,
        metrosLineales: 0,
        metrosCuadrados: 0,
        admiteCanaleteado: matMeta.canChase,
        metodoCanaleteado: matMeta.chasingMethod
      });
    }

    const entry = murosPorMaterialMap.get(key)!;
    const srcRoom = metricRooms.find((r) => r.id === conn.sourceRoomId);
    const wallLen = srcRoom ? srcRoom.dimensions.width : 3.0;
    const wallH = srcRoom ? srcRoom.dimensions.height : 2.6;

    entry.metrosLineales += wallLen;
    entry.metrosCuadrados += Number((wallLen * wallH).toFixed(2));
  });

  return {
    version: '1.0.0',
    generator: 'RelevaCAD',
    exportedAt: new Date().toISOString(),
    proyecto: {
      id: project.id,
      nombre: project.nombre,
      ubicacion: project.ubicacion,
      descripcion: project.descripcion,
      rumboFrente: project.rumboFrente,
      azimutGrados: project.azimutGrados,
      cliente: {
        id: project.clienteId || `cli-${Date.now()}`,
        nombre: project.clienteNombre || 'Cliente sin asignar',
        telefono: project.clienteTelefono,
        email: project.clienteEmail,
        direccion: project.clienteDireccion,
        cuitDni: project.clienteCuitDni
      }
    },
    computoElectrico: {
      superficieTotalM2: Number(superficieTotalM2.toFixed(2)),
      cantidadAmbientes: metricRooms.length,
      totalBocas,
      bocasIUG,
      bocasTUG,
      bocasTUE,
      cajasDePaso,
      tablerosPrincipales,
      tablerosSeccionales,
      metrosCaneriaTotal: Number(metrosCaneriaTotal.toFixed(2)),
      metrosCaneriaPorDiametro,
      metrosConductoresPorSeccion,
      circuitosDetectados: Array.from(circuitosMap.values()),
      murosPorMaterial: Array.from(murosPorMaterialMap.values())
    },
    rawRelevamiento: project
  };
}

/**
 * Dispara la descarga del archivo `.ieba.json` en el navegador.
 */
export function downloadCotizadorIebaJSON(project: RelevamientoProyecto): void {
  const payload = generateCotizadorIebaPayload(project);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  const filenameSafe = (project.nombre || 'relevamiento').toLowerCase().replace(/[^a-z0-9]/gi, '_');
  
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${filenameSafe}.ieba.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
