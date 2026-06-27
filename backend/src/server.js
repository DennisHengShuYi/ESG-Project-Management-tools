import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import governanceRoutes from './routes/governance.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
