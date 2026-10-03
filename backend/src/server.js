import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import packageRoutes from './routes/packages.js';
import ceoRoutes from './routes/ceo.js';
import partnerRoutes from './routes/partner.js';
import studentRoutes from './routes/student.js';
import instructorRoutes from './routes/instructor.js';
import courseRoutes from './routes/courses.js';
import liveRoutes from './routes/live.js';
import commerceRoutes from './routes/commerce.js';
import notificationRoutes from './routes/notifications.js';
import rewardRoutes from './routes/rewards.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()) || [],
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'skilllink-api' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/ceo', ceoRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard',dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`SkillLink API listening on port ${port}`);
});
