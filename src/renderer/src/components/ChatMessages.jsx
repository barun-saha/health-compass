import { Box, Paper, Stack, CircularProgress, Typography } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const ChatMessages = ({ chat, isLoading, planningStatus, chatEndRef }) => {
  return (
    <Box
      sx={{
        mb: 1,
        height: 'calc(100vh - 250px)',
        overflowY: 'auto',
        paddingBottom: '32px'
      }}
    >
      {chat.slice(1).map((msg, idx) => (
        <Box
          key={idx}
          display="flex"
          justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
          mb={1}
        >
          <Paper
            elevation={3}
            sx={{
              padding: '2px 8px',
              maxWidth: '80%',
              marginBottom: '8px',
              backgroundColor: msg.role === 'user' ? 'chat.user' : 'chat.assistant'
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
          </Paper>
        </Box>
      ))}

      {isLoading && (
        <Box display="flex" justifyContent="flex-start" mb={1}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              padding: '2px 8px',
              maxWidth: '80%',
              color: 'text.secondary'
            }}
          >
            <CircularProgress size={20} />
            <Typography variant="body2">
              {planningStatus === 'planning'
                ? 'Planning to respond based on query...'
                : 'Generating response...'}
            </Typography>
          </Stack>
        </Box>
      )}

      <div ref={chatEndRef} />
    </Box>
  )
}

export default ChatMessages
