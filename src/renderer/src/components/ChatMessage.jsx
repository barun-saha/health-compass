import { useState } from 'react'
import { Box, Paper, IconButton, Tooltip, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const ChatMessage = ({ msg }) => {
  const [tooltipText, setTooltipText] = useState('Copy message')
  
  // Function to copy text to clipboard
  const handleCopy = async () => {
    try {
      const result = await window.electronAPI.copyToClipboard(msg.content);
      if (result.success) {
        console.log('Message copied via IPC!');
        setTooltipText('Copied!')
        setTimeout(() => {
          setTooltipText('Copy message')
        }, 1500) // Revert after 1.5 seconds
      } else {
        console.error('Failed to copy via IPC:', result.error);
        setTooltipText('Failed to copy!')
        setTimeout(() => {
          setTooltipText('Copy message')
        }, 2000) // Give more time for error message
      }
    } catch (error) {
      console.error('Error calling copy IPC:', error);
    }
  };

  return (
    <Box display="flex" justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'} mb={1}>
      <Paper
        elevation={3}
        sx={{
          padding: '2px 8px',
          maxWidth: '80%',
          marginBottom: '8px',
          backgroundColor: msg.role === 'user' ? 'chat.user' : 'chat.assistant',
          position: 'relative' // Needed for absolute positioning of copy icon
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml={false}
          components={{
            table: ({ ...props }) => <table className="gfm-table" {...props} />
          }}
        >
          {msg.content}
        </ReactMarkdown>

        <Tooltip title={tooltipText} placement="bottom-end">
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              // Adjust positioning to be slightly inside or just outside the paper
              transform: 'translate(0%, 50%)', // Adjust to move below the paper
              backgroundColor: (theme) => theme.palette.background.paper, // Match paper background
              boxShadow: (theme) => theme.shadows[2], // Small shadow
              '&:hover': {
                backgroundColor: (theme) => theme.palette.action.hover
              }
            }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    </Box>
  )
}

export default ChatMessage
