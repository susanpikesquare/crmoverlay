import { Router } from 'express';
import { healthCheck, testEndpoint } from '../controllers/testController';

const router = Router();

// Health check route
router.get('/health', healthCheck);

// Test routes
router.post('/api/test', testEndpoint);
router.get('/api/test', testEndpoint);

export default router;
