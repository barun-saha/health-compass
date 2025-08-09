import { Box, Stack, CircularProgress, Typography } from '@mui/material';

const PlanningStatus = ({ planningStatus }) => {
  return (
    <Box display="flex" justifyContent="flex-start" mb={1}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          padding: '2px 8px',
          maxWidth: '80%',
          color: 'text.secondary',
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
  );
};

export default PlanningStatus
