import { Snackbar, Alert } from '@mui/material'

const AppNotification = ({
  snackbarOpen,
  snackbarMessage,
  snackbarSeverity,
  handleSnackbarClose
}) => {
  return (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={6000}
      onClose={handleSnackbarClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
        {snackbarMessage}
      </Alert>
    </Snackbar>
  )
}

export default AppNotification
