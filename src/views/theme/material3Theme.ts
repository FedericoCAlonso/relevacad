/**
 * View: Material Design 3 Theme Configuration (IEBA Series)
 * Paleta de colores tonales cálidos y especificaciones según pwaCotizadorIeba (Seed: #755B00).
 */

import { createTheme } from '@mui/material/styles';

export const material3Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#755b00',       // IEBA Primary Seed (Oro Cálido / Ámbar profesional)
      light: '#ffdf97',      // Primary Container
      dark: '#594400',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#695e40',       // IEBA Secondary (Oliva Cálido)
      light: '#f1e2bd',      // Secondary Container
      dark: '#392f15',
      contrastText: '#ffffff'
    },
    success: {
      main: '#486548',       // IEBA Tertiary (Verde Salvia / Tierra)
      light: '#cbebc6',
      dark: '#1b361c',
      contrastText: '#ffffff'
    },
    error: {
      main: '#ba1a1a',
      light: '#ffdad6',
      dark: '#93000a',
      contrastText: '#ffffff'
    },
    background: {
      default: '#fff8f1',    // M3 Neutral-99 (Calidez Crema / Marfil IEBA)
      paper: '#ffffff'       // Surface
    },
    text: {
      primary: '#1f1b13',    // Neutral-10
      secondary: '#635e53'   // Neutral-40
    },
    divider: '#e8e2d4'       // Neutral-Variant-90 (Borde sutil cálido)
  },
  typography: {
    fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h5: {
      fontWeight: 700,
      letterSpacing: -0.3
    },
    h6: {
      fontWeight: 700,
      letterSpacing: -0.2
    },
    subtitle1: {
      fontWeight: 600
    },
    subtitle2: {
      fontWeight: 600
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 16 // Radio estándar M3 para tarjetas y contenedores (16px)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20, // Botones M3 tipo píldora
          padding: '8px 20px',
          boxShadow: 'none',
          fontFamily: '"Outfit", sans-serif',
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12)'
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #755b00 0%, #594400 100%)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e8e2d4',
          boxShadow: '0px 1px 3px rgba(117, 91, 0, 0.04)',
          transition: 'all 0.2s ease-in-out'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontFamily: '"Outfit", sans-serif'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#fff8f1',
          color: '#1f1b13',
          borderBottom: '1px solid #e8e2d4',
          boxShadow: '0 1px 3px rgba(117, 91, 0, 0.05)'
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.92rem',
          minHeight: 48,
          fontFamily: '"Outfit", sans-serif'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small'
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': {
              borderColor: '#e8e2d4'
            },
            '&:hover fieldset': {
              borderColor: '#755b00'
            }
          }
        }
      }
    }
  }
});
