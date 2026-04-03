import '../api_internal/lib/load-env.ts';
import app from '../api/api.ts';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Scripture Habit Backend running locally on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
