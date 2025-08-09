import { Paper, Box, Tooltip, IconButton, Typography, TextField, Button } from '@mui/material'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

const ChatInput = ({
  input,
  setInput,
  handleKeyPress,
  handleSend,
  isLoading,
  chat,
  selectedPdf,
  handleOpenPdfFile
}) => {
  return (
    <Paper
      elevation={2}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90vw',
        maxWidth: '90vw',
        backgroundColor: 'background.paper',
        padding: '1rem',
        borderRadius: '8px 8px 0 0',
        boxShadow: 1
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Attach PDF file">
            <IconButton
              component="label"
              size="small"
              onClick={handleOpenPdfFile}
              sx={{ color: 'grey.600' }}
              aria-label="Attach PDF file"
            >
              <AttachFileIcon />
            </IconButton>
          </Tooltip>
          {selectedPdf && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PictureAsPdfIcon fontSize="small" sx={{ color: 'grey.600' }} />
              <Typography variant="caption" color="grey.600">
                {selectedPdf.fileName}
              </Typography>
            </Box>
          )}
        </Box>

        <Box display="flex" gap={1}>
          <TextField
            fullWidth
            placeholder="Type your message here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            variant="outlined"
            size="small"
            multiline
            maxRows={4}
            sx={{
              '& .MuiOutlinedInput-input::placeholder': {
                color: 'text.secondary'
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={isLoading || chat.length - 1 >= 20}
            sx={{ minWidth: '80px' }}
          >
            {isLoading ? '...' : 'Send'}
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
          Disclaimer: AI-generated content may contain inaccuracies or outdated information. Always
          verify with trusted sources/healthcare professionals.
        </Typography>
      </Box>
    </Paper>
  )
}

export default ChatInput
