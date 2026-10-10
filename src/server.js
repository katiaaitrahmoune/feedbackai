const app = require('./app');
const env = require('./env');

app.listen(env.port, () => console.log(`Server on ${env.port}`));