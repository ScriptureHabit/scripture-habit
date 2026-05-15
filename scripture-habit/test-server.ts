import './api_internal/lib/load-env.js';
import app from './api/api.js';

const PORT = 5000;
const server = app.listen(PORT, () => {
    console.log(`TEST Server running on port ${PORT}`);
});
