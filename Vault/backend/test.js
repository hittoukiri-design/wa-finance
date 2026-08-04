const express = require('express');
const app = express();
app.listen(5000, () => console.log('listening on 5000')).on('error', (err) => console.log('ERROR:', err.message));
