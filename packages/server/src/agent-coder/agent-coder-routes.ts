import express from 'express';
import { agentCoderService } from './agent-coder-service';

const router = express.Router();

router.post('/agent-coder', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await agentCoderService.processCodeRequest(req.body);

    stream.on('data', (data) => {
      // Assuming data is a buffer or string. Convert to string if necessary.
      const message = data.toString();
      // Format the data for server-sent events
      // If the message is not a final task result, wrap it in a 'streamData' field
      // This is a placeholder logic, actual implementation depends on the service output format
      let formattedMessage;
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'taskResult') {
          formattedMessage = `data: ${JSON.stringify(parsedMessage)}\n\n`;
        } else {
          formattedMessage = `data: ${JSON.stringify({ streamData: parsedMessage })}\n\n`;
        }
      } catch (e) {
        // Handle cases where the message is not JSON
        formattedMessage = `data: ${JSON.stringify({ streamData: message })}\n\n`;
      }
      res.write(formattedMessage);
    });

    stream.on('end', () => {
      res.end();
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).send('Error processing request');
    });

  } catch (error) {
    console.error('Agent Coder route error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
