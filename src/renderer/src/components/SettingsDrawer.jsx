import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material'

const SettingsDrawer = ({ open, onClose, darkMode, toggleTheme, selectedLlm, handleLlmChange }) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 250, p: 2 }} role="presentation">
        <Typography variant="h6" gutterBottom>
          Settings
        </Typography>
        <List>
          <ListItem>
            <ListItemText primary="Theme" />
            <Switch checked={darkMode} onChange={toggleTheme} />
            <ListItemText primary={darkMode ? 'Dark' : 'Light'} sx={{ textAlign: 'right' }} />
          </ListItem>
          <ListItem>
            <FormControl fullWidth>
              <InputLabel id="llm-select-label">LLM Model</InputLabel>
              <Select
                labelId="llm-select-label"
                id="llm-select"
                value={selectedLlm}
                label="LLM Model"
                onChange={handleLlmChange}
              >
                <MenuItem value="gemma3n:e2b">gemma3n:e2b</MenuItem>
                <MenuItem value="gemma3n:e4b">gemma3n:e4b</MenuItem>
                <MenuItem value="gemma3:1b">gemma3:1b</MenuItem>
              </Select>
            </FormControl>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  )
}

export default SettingsDrawer
