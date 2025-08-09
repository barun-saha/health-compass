import { useState } from 'react'

export const useNotification = () => {
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  })

  const showNotification = (message, severity = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    })
  }

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setNotification((prev) => ({ ...prev, open: false }))
  }

  return { notification, showNotification, handleSnackbarClose }
}
