import { createApp } from './app';
import { env, logEnvStatus } from './config/env';

const app = createApp();

logEnvStatus(env);

app.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
  console.log(`[backend] allowing requests from ${env.frontendUrl}`);
});
