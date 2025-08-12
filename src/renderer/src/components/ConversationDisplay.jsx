import { Box } from '@mui/material'
import ChatMessage from './ChatMessage'
import PlanningStatus from './PlanningStatus'

const ConversationDisplay = ({ chat, isLoading, planningStatus, chatEndRef }) => {
  return (
    <Box
      sx={{
        mb: 1,
        height: 'calc(100vh - 250px)',
        overflowY: 'auto',
        paddingBottom: '20px'
      }}
    >
      {chat.slice(1).map((msg, idx) => (
        <ChatMessage key={msg.id ?? idx} msg={msg} />
      ))}

      {isLoading && <PlanningStatus planningStatus={planningStatus} />}

      <div ref={chatEndRef} />
    </Box>
  )
}

export default ConversationDisplay
