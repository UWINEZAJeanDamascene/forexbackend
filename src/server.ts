import { createApp } from './app';
import { env, logEnvStatus } from './config/env';
import { initializeBacktestWorker } from './services/backtestService';

const app = createApp();

logEnvStatus(env);

app.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
  console.log(`[backend] allowing requests from ${env.frontendUrl}`);
  initializeBacktestWorker();
});
