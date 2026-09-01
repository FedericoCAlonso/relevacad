/**
 * View: Material Design 3 Theme Configuration
 * Paleta de colores tonales y especificaciones de elevación y radios según Material You / MD3.
 */

import { createTheme } from '@mui/material/styles';

export const material3Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00629e',       // M3 Key Primary
      light: '#cce5ff',      // Primary Container
      dark: '#004975',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#526070',
      light: '#d5e4f7',
      dark: '#3b4857',
      contrastText: '#ffffff'
    },
    error: {
      main: '#ba1a1a',
      light: '#ffdad6',
      dark: '#93000a',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f8f9fa',    // M3 Surface Background
      paper: '#ffffff'       // M3 Surface
    },
    text: {
      primary: '#191c1e',
      secondary: '#41474d'
    },
    divider: '#e0e3e7'
  },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    h5: {
      fontWeight: 600,
      letterSpacing: -0.2
    },
    h6: {
      fontWeight: 600,
      letterSpacing: -0.1
    },
    subtitle1: {
      fontWeight: 500
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 16 // Radio estándar M3 para tarjetas y contenedores
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20, // Botones M3 tipo píldora
          padding: '8px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12)'
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #00629e 0%, #004e7e 100%)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.04)',
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
          fontWeight: 500
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#191c1e',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.92rem',
          minHeight: 48
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
            borderRadius: 10
          }
        }
      }
    }
  }
});
