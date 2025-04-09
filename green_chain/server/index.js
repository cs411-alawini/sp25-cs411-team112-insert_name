const express = require('express');

const app = express();
const PORT = 3007;

app.use(express.json());

app.get('/api/', (req, res) => {
    res.send('API of GreenChain');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
