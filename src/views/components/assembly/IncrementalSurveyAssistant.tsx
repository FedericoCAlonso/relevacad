/**
 * View Component: IncrementalSurveyAssistant (Material 3 Mobile-First UX)
 * Asistente interactivo de relevamiento incremental para "Croquizador":
 * - Muestra la incertidumbre geométrica y error de cierre de ciclos en tiempo real.
 * - Sirve la pregunta de mayor impacto calculada por el solver de mínimos cuadrados.
 * - Permite confirmar datos faltantes con 1 solo tap (presets rápidos o teclado numérico).
 * - Re-ejecuta el solver y actualiza el plano de planta de forma reactiva.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  TextField,
  Collapse,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  AutoAwesome as AssistantIcon,
  CheckCircle as ValidIcon,
  WarningAmber as WarningIcon,
  HelpOutline as QuestionIcon,
  Close as CloseIcon,
  KeyboardArrowDown as CollapseIcon,
  KeyboardArrowUp as ExpandIcon,
  Done as ConfirmIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';

export const IncrementalSurveyAssistant: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    solverResult,
    activeQuestion,
    questionsQueue,
    isAssistantOpen,
    toggleAssistantOpen,
    answerIncrementalQuestion
  } = useSurveyViewModel();

  const [inputValue, setInputValue] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Sincronizar input con el valor estimado de la pregunta activa
  useEffect(() => {
    if (activeQuestion) {
      setInputValue(activeQuestion.currentEstimatedValue.toString());
    }
  }, [activeQuestion]);

  if (!isAssistantOpen) {
    // Botón flotante para abrir el asistente cuando está minimizado
    return (
      <Paper
        elevation={4}
        onClick={() => toggleAssistantOpen(true)}
        sx={{
          position: 'absolute',
          bottom: isMobile ? 80 : 20,
          right: 20,
          zIndex: 1200,
          p: 0.8,
          px: 1.6,
          borderRadius: 4,
          bgcolor: '#0f172a',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          '&:hover': { bgcolor: '#1e293b' }
        }}
      >
        <AssistantIcon sx={{ color: '#38bdf8', fontSize: 20 }} />
        <Typography variant="body2" fontWeight={700} fontSize="0.82rem">
          Asistente Geométrico
        </Typography>
        {questionsQueue.length > 0 && (
          <Chip
            label={questionsQueue.length}
            size="small"
            color="warning"
            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }}
          />
        )}
      </Paper>
    );
  }

  const handleConfirm = (val?: number) => {
    if (!activeQuestion) return;
    const num = val !== undefined ? val : parseFloat(inputValue);
    if (!isNaN(num) && num > 0) {
      answerIncrementalQuestion(activeQuestion, num);
    }
  };

  const maxErrorCm = Math.round(solverResult.maxCycleErrorMeters * 100);
  const isOptimal = solverResult.isUnderAcceptableThreshold;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        bottom: isMobile ? 74 : 20,
        left: isMobile ? 12 : 24,
        right: isMobile ? 12 : 'auto',
        width: isMobile ? 'auto' : 440,
        zIndex: 1200,
        borderRadius: 3.5,
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 12px 36px -4px rgba(15, 23, 42, 0.22)'
      }}
    >
      {/* 🧭 HEADER: Diagnóstico de Precisión y Cerrado de Ciclos */}
      <Box
        sx={{
          p: 1.5,
          px: 2,
          bgcolor: isOptimal ? '#f0fdf4' : '#fffbeb',
          borderBottom: '1px solid',
          borderColor: isOptimal ? '#bbf7d0' : '#fde68a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AssistantIcon sx={{ color: isOptimal ? '#16a34a' : '#d97706', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.85rem">
            Asistente Incremental
          </Typography>
          <Chip
            icon={isOptimal ? <ValidIcon sx={{ fontSize: '14px !important' }} /> : <WarningIcon sx={{ fontSize: '14px !important' }} />}
            label={isOptimal ? `±${maxErrorCm}cm (Óptimo)` : `±${maxErrorCm}cm (${questionsQueue.length} pend.)`}
            size="small"
            color={isOptimal ? 'success' : 'warning'}
            variant="filled"
            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
          />
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)} sx={{ p: 0.4 }}>
            {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={() => toggleAssistantOpen(false)} sx={{ p: 0.4 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* 📝 CONTENIDO: Pregunta de Mayor Impacto / Estado Óptimo */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: 2, pt: 1.5 }}>
          {activeQuestion ? (
            <Stack spacing={1.5}>
              {/* Contexto del tramo y ambientes conectados */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={0.3}>
                  <QuestionIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                  <Typography variant="caption" fontWeight={700} color="#0284c7" textTransform="uppercase" letterSpacing={0.5}>
                    {activeQuestion.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={700} color="#0f172a" fontSize="0.95rem">
                  {activeQuestion.promptText}
                </Typography>
                <Typography variant="caption" color="#64748b" display="block" mt={0.3}>
                  💡 {activeQuestion.rationale}
                </Typography>
              </Box>

              {/* ⚡ Presets rápidos de 1-Tap para Celular */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="#475569" mb={0.5} display="block">
                  Medida rápida sugerida:
                </Typography>
                <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5 }}>
                  {activeQuestion.quickPresets.map((preset) => (
                    <Chip
                      key={preset}
                      label={`${preset.toFixed(2)}m`}
                      size="small"
                      clickable
                      onClick={() => handleConfirm(preset)}
                      variant={parseFloat(inputValue) === preset ? 'filled' : 'outlined'}
                      color={parseFloat(inputValue) === preset ? 'primary' : 'default'}
                      sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Input numérico directo con botón de confirmación */}
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ step: 0.05, min: 0.2, max: 20 }}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  sx={{ width: 120 }}
                  InputProps={{
                    endAdornment: <Typography variant="caption" color="#64748b" fontWeight={700}>m</Typography>,
                    sx: { fontWeight: 700, fontSize: '0.9rem', height: 38 }
                  }}
                />

                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<ConfirmIcon />}
                  onClick={() => handleConfirm()}
                  sx={{ flex: 1, height: 38, fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
                >
                  Confirmar Medida
                </Button>
              </Stack>
            </Stack>
          ) : (
            // 🎉 Estado cuando no quedan preguntas pendientes o se alcanzó precisión óptima
            <Stack spacing={1} alignItems="center" textAlign="center" py={1}>
              <ValidIcon sx={{ fontSize: 36, color: '#16a34a' }} />
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                ¡Plano Geométricamente Cerrado!
              </Typography>
              <Typography variant="caption" color="#64748b" maxWidth={320}>
                Todos los ciclos y paredes coinciden con un error menor a ±5cm. El plano está validado y listo para trazar la instalación eléctrica.
              </Typography>
            </Stack>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
