import { Box, Typography, IconButton } from '@mui/material'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import healthCompassIcon from '../../../../resources/icon.png'

const Header = ({ darkMode, toggleTheme }) => {
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
      <IconButton onClick={toggleTheme} color="inherit">
        {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
      </IconButton>
    </Box>
  )
}

export default Header
