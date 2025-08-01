import { createTheme } from '@mui/material'

// Define reusable design tokens
const designTokens = {
  borderRadius: 8,
  spacing: 8,
  typography: {
    fontFamily: "'Inter', sans-serif"
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            backgroundColor: theme.palette.background.paper,
            '&:hover': {
              backgroundColor: theme.palette.action.hover
            },
            '&.Mui-focused': {
              backgroundColor: theme.palette.action.selected
            }
          }
        })
      }
    }
  }
}

// Define semantic colors
const commonColors = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0'
  },
  chat: {
    user: {
      light: '#e3f2fd',
      dark: '#1e3a5f'
    },
    assistant: {
      light: '#f5f5f5',
      dark: '#2d2d2d'
    }
  }
}

export const lightTheme = createTheme({
  ...designTokens,
  palette: {
    mode: 'light',
    ...commonColors,
    background: {
      default: '#fafafa',
      paper: '#ffffff'
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)'
    }
  }
})

export const darkTheme = createTheme({
  ...designTokens,
  palette: {
    mode: 'dark',
    ...commonColors,
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)'
    }
  }
})
