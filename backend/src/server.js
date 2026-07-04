import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import governanceRoutes from './routes/governance.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();

// Allow requests from local dev and any origin specified via environment variable.
// The browser sends an OPTIONS preflight before POST/PUT/DELETE — without a
// proper CORS config that preflight gets a 405, which then causes the actual
// request to fail with an empty body and "Unexpected end of JSON input".
const allowedOrigins = [
  'http://localhost:5173',  // Vite default
  'http://localhost:3000',
  ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin server calls)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Respond 204 to all preflight OPTIONS requests so the browser doesn't get 405.
app.options('*', cors());

app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
