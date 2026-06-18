import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { Devvit } from '@devvit/public-api';

const app = new Hono();
const internal = new Hono();



Devvit.addSettings([
  {
    type: 'string',
    name: 'google_api_key',
    label: 'Google API Key',
    defaultValue: '',
    isSecret: true, 
    scope: 'app'    
  }
]);

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
