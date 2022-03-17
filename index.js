const express = require('express');
const routes = require('./routes');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
