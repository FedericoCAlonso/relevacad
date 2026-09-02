/**
 * View: PresentationView (Fase 3: Presentación, Cómputo Métrico y Cotizador IEBA)
 * Lámina técnica formal de entrega:
 * - Plano arquitectónico-eléctrico limpio con cotas y simbología normalizada
 * - Membrete profesional de obra y ficha de cliente
 * - Cómputo métrico automatizado (m² de superficie, m lineales de canaleteado, bocas y cables)
 * - Botones de exportación: JSON Cotizador IEBA, Impresión/PDF y PNG HD
 */

import React, { useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  CloudDownload as ExportIcon,
  Print as PrintIcon,
  ElectricBolt as BoltIcon,
  SquareFoot as AreaIcon,
  Construction as ConstructionIcon,
  Cable as CableIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { isMetricRoom } from '@/models/RoomModel';

export const PresentationView: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const printRef = useRef<HTMLDivElement>(null);

  const {
    currentProjectName,
    clienteInfo,
    ubicacionObra,
    rooms,
    connections,
    electricalNodes,
    electricalTramos,
    exportProjectToCotizadorJSON
  } = useSurveyViewModel();

  // Cómputo Métrico de Superficies
  const metricRooms = useMemo(() => rooms.filter(isMetricRoom), [rooms]);

  const supCubierta = useMemo(
    () =>
      metricRooms
        .filter((r) => !r.tipoCubierta || r.tipoCubierta === 'cubierto')
        .reduce((sum, r) => sum + (r.dimensions?.width || 0) * (r.dimensions?.length || 0), 0),
    [metricRooms]
  );

  const supSemicubierta = useMemo(
    () =>
      metricRooms
        .filter((r) => r.tipoCubierta === 'semicubierto')
        .reduce((sum, r) => sum + (r.dimensions?.width || 0) * (r.dimensions?.length || 0), 0),
    [metricRooms]
  );

  const supTotal = supCubierta + supSemicubierta;

  // Cómputo de Metros Lineales de Muros y Canaleteado
  const wallMetrics = useMemo(() => {
    let metrosHueco = 0;
    let metrosPesado = 0;
    let metrosSeco = 0;

    connections.forEach((conn) => {
      const mat = conn.wallProperties?.materialType || 'ladrillo_hueco_8';
      const sRoom = rooms.find((r) => r.id === conn.sourceRoomId);
      const isHoriz = conn.sourceWall === 'north' || conn.sourceWall === 'south';
      const len = isHoriz ? (sRoom?.dimensions?.width || 3) : (sRoom?.dimensions?.length || 2.5);

      if (mat.includes('durlock')) metrosSeco += len;
      else if (mat.includes('medianera') || mat.includes('hormigon')) metrosPesado += len;
      else metrosHueco += len;
    });

    return {
      metrosHueco: Math.round(metrosHueco * 10) / 10,
      metrosPesado: Math.round(metrosPesado * 10) / 10,
      metrosSeco: Math.round(metrosSeco * 10) / 10,
      total: Math.round((metrosHueco + metrosPesado + metrosSeco) * 10) / 10
    };
  }, [connections, rooms]);

  // Conteo de Bocas por Tipo
  const nodeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    electricalNodes.forEach((n) => {
      counts[n.tipo] = (counts[n.tipo] || 0) + 1;
    });
    return counts;
  }, [electricalNodes]);

  // Metros de Cañería y Conductores
  const cableTotals = useMemo(() => {
    let totalMetrosCano = 0;
    let metrosFase = 0;
    let metrosNeutro = 0;
    let metrosTierra = 0;
    let metrosRetorno = 0;

    electricalTramos.forEach((t) => {
      totalMetrosCano += t.longitudMeters;
      (t.conductores || []).forEach((c) => {
        if (c.tipoConductor === 'fase') metrosFase += t.longitudMeters;
        else if (c.tipoConductor === 'neutro') metrosNeutro += t.longitudMeters;
        else if (c.tipoConductor === 'tierra_pe') metrosTierra += t.longitudMeters;
        else if (c.tipoConductor.includes('retorno')) metrosRetorno += t.longitudMeters;
      });
    });

    return {
      cano: Math.round(totalMetrosCano * 10) / 10,
      fase: Math.round(metrosFase * 10) / 10,
      neutro: Math.round(metrosNeutro * 10) / 10,
      tierra: Math.round(metrosTierra * 10) / 10,
      retorno: Math.round(metrosRetorno * 10) / 10,
      totalCable: Math.round((metrosFase + metrosNeutro + metrosTierra + metrosRetorno) * 10) / 10
    };
  }, [electricalTramos]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        p: isMobile ? 1.5 : 3,
        bgcolor: '#f1f5f9'
      }}
    >
      {/* Barra de Acciones de Exportación */}
      <Paper
        elevation={2}
        sx={{
          p: 1.5,
          mb: 2.5,
          borderRadius: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          bgcolor: '#ffffff'
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800} color="#0f172a" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem' }}>
            📄 Lámina de Presentación & Cómputo Técnico
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Relevamiento conforme a obra, balances métricos y exportador a Cotizador IEBA
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={exportProjectToCotizadorJSON}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Exportar JSON IEBA
          </Button>

          <Button
            variant="outlined"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Imprimir / PDF
          </Button>
        </Stack>
      </Paper>

      {/* Contenedor Imprimible (Lámina Técnica) */}
      <Paper
        ref={printRef}
        elevation={3}
        sx={{
          p: isMobile ? 2 : 4,
          bgcolor: '#ffffff',
          borderRadius: 4,
          maxWidth: 1100,
          mx: 'auto'
        }}
      >
        {/* Membrete Profesional */}
        <Box
          sx={{
            border: '2px solid #0f172a',
            borderRadius: 2,
            p: 2,
            mb: 3,
            bgcolor: '#fafafa'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={1.5}>
                IEBA • INSTALACIONES ELÉCTRICAS BUENOS AIRES
              </Typography>
              <Typography variant="h5" fontWeight={800} color="#0f172a" lineHeight={1.2}>
                {currentProjectName}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                📍 {ubicacionObra || 'Sin dirección especificada'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ borderLeft: { sm: '2px solid #e2e8f0' }, pl: { sm: 2 } }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Cliente:</strong> {clienteInfo.nombre || 'Cliente Particular'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Teléfono:</strong> {clienteInfo.telefono || '-'} | <strong>CUIT/DNI:</strong> {clienteInfo.cuitDni || '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Profesional:</strong> Federico C. Alonso • Electricista Matriculado
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR')} • <strong>Norma:</strong> AEA 90364-771
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Tarjetas de Resumen Ejecutivo */}
        <Grid container spacing={2} mb={3}>
          {/* Superficie */}
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <AreaIcon color="primary" fontSize="small" />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    SUPERFICIE TOTAL
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="#0f172a">
                  {Math.round(supTotal * 10) / 10} <Typography component="span" variant="body1">m²</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(supCubierta * 10) / 10}m² cub. • {Math.round(supSemicubierta * 10) / 10}m² semi.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Muros a Canaletear */}
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <ConstructionIcon color="secondary" fontSize="small" />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    MUROS / ROZADO
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="#0f172a">
                  {wallMetrics.total} <Typography component="span" variant="body1">m.l.</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {wallMetrics.metrosHueco}m liviano • {wallMetrics.metrosPesado}m pesado
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Bocas Eléctricas */}
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <BoltIcon color="warning" fontSize="small" />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    BOCAS ELÉCTRICAS
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="#0f172a">
                  {electricalNodes.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {nodeCounts['boca_iluminacion'] || 0} IUG • {nodeCounts['boca_tomacorriente'] || 0} TUG
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Cañerías y Cables */}
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <CableIcon color="info" fontSize="small" />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    CABLES ESTIMADOS
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="#0f172a">
                  {cableTotals.totalCable} <Typography component="span" variant="body1">m</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cableTotals.cano}m caño • {electricalTramos.length} tramos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabla de Ambientes Relevados */}
        <Typography variant="subtitle1" fontWeight={800} color="#0f172a" mb={1}>
          📐 Detalle de Locales y Medidas Arquitectónicas
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell><strong>Ambiente / Espacio</strong></TableCell>
                <TableCell align="center"><strong>Ancho</strong></TableCell>
                <TableCell align="center"><strong>Largo</strong></TableCell>
                <TableCell align="center"><strong>Superficie</strong></TableCell>
                <TableCell align="center"><strong>Cubierta</strong></TableCell>
                <TableCell align="center"><strong>Bocas</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room) => {
                const isMetric = isMetricRoom(room);
                const area = isMetric ? Math.round((room.dimensions?.width || 0) * (room.dimensions?.length || 0) * 10) / 10 : '-';
                const bocas = electricalNodes.filter((n) => n.roomId === room.id).length;

                return (
                  <TableRow key={room.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {isMetric ? '🏠' : '🧱'} {room.name}
                    </TableCell>
                    <TableCell align="center">{isMetric ? `${room.dimensions.width} m` : '-'}</TableCell>
                    <TableCell align="center">{isMetric ? `${room.dimensions.length} m` : '-'}</TableCell>
                    <TableCell align="center">{isMetric ? `${area} m²` : 'Referencia'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={room.tipoCubierta || 'cubierto'}
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {bocas > 0 ? (
                        <Chip size="small" color="primary" label={`${bocas} bocas`} sx={{ height: 22, fontSize: '0.7rem' }} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">0</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Cómputo de Circuitos y Tramos Eléctricos */}
        <Typography variant="subtitle1" fontWeight={800} color="#0f172a" mb={1}>
          ⚡ Tramos de Cañerías y Distribución de Circuitos
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell><strong>Tramo</strong></TableCell>
                <TableCell align="center"><strong>Circuito</strong></TableCell>
                <TableCell align="center"><strong>Longitud</strong></TableCell>
                <TableCell align="center"><strong>Diámetro</strong></TableCell>
                <TableCell align="center"><strong>Conductores Alojados</strong></TableCell>
                <TableCell align="center"><strong>Montaje</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {electricalTramos.map((tramo) => {
                const sNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
                const tNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);

                return (
                  <TableRow key={tramo.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {sNode?.etiqueta || 'Boca'} ➔ {tNode?.etiqueta || 'Boca'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={tramo.circuitoCodigo}
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell align="center">{tramo.longitudMeters} m</TableCell>
                    <TableCell align="center">Ø {tramo.diametroCañoMm} mm</TableCell>
                    <TableCell align="center">
                      {(tramo.conductores || []).map((c) => `${c.tipoConductor} ${c.seccionMm2}mm²`).join(' + ') || 'Sin conductores'}
                    </TableCell>
                    <TableCell align="center">{tramo.tipoMontaje}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pie de Firma Profesional */}
        <Box sx={{ mt: 4, pt: 2, borderTop: '1px dashed #cbd5e1' }}>
          <Grid container spacing={3}>
            <Grid item xs={6}>
              <Box sx={{ borderTop: '1px solid #0f172a', width: 220, pt: 1, mt: 4 }}>
                <Typography variant="caption" fontWeight={700} display="block">
                  Firma Conforme Propietario / Cliente
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Aceptación de relevamiento de locales
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} display="flex" justifyContent="flex-end">
              <Box sx={{ borderTop: '1px solid #0f172a', width: 220, pt: 1, mt: 4, textAlign: 'right' }}>
                <Typography variant="caption" fontWeight={700} display="block">
                  Federico C. Alonso
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  IEBA • Electricista Matriculado COPIME
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};
