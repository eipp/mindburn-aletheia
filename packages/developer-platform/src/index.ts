import express from 'express';
import { Task, TaskStatus } from '@mindburn/shared';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Developer platform listening on port ${port}`);
});