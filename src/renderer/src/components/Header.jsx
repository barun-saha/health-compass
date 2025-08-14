import { Box, Typography, IconButton } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import healthCompassIcon from '../../../../resources/icon.png'

const Header = ({ toggleSettings }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img src={healthCompassIcon} alt="Health Compass Icon" style={{ height: '48px' }} />
        <Typography variant="h5">Health Compass</Typography>
      </Box>
      <IconButton onClick={toggleSettings} color="inherit">
        <SettingsIcon />
      </IconButton>
    </Box>
  )
}

export default Header
