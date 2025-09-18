require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { startWatcher, getLastTarget } = require('./watcher');
const { sendTelegram } = require('./telegram');
const { executorExecute, getPositions } = require('./executor');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('GROUK Sniper MVP running'));

app.post('/execute', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).send({ error: 'token required' });
  try {
    const result = await executorExecute(token);
    return res.send(result);
  } catch (e) {
    console.error('Execute error', e);
    await sendTelegram('Executor error: ' + e.message);
    return res.status(500).send({ error: e.message });
  }
});

app.get('/positions', (req, res) => {
  res.send(getPositions());
});

app.listen(PORT, async () => {
  console.log('Server listening on', PORT);
  await startWatcher();
});
