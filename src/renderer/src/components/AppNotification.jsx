import { Snackbar, Alert } from '@mui/material'

const AppNotification = ({ notification, handleSnackbarClose }) => {
  const { open, message, severity } = notification
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={handleSnackbarClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={handleSnackbarClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  )
}

export default AppNotification
