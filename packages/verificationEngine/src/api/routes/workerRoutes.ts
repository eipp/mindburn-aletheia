import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateJwt } from '../middleware/authenticateJwt';
import { errorHandler } from '../middleware/errorHandler';
import { WorkerController } from '../controllers/workerController';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('workerRoutes');

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
});

// Request validation schemas
const registerWorkerSchema = z.object({
  body: z.object({
    walletAddress: z.string().min(1),
    identityData: z.object({
      name: z.string().min(1),
      documentId: z.string().min(1),
    }),
  }),
});

const updateStatusSchema = z.object({
  params: z.object({
    workerId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']),
  }),
});

const reassessSkillsSchema = z.object({
  params: z.object({
    workerId: z.string().min(1),
  }),
  body: z.object({
    taskType: z.string().min(1),
  }),
});

export function createWorkerRoutes(controller: WorkerController): Router {
  const router = Router();

  // Apply security middleware
  router.use(helmet());
  router.use(limiter);

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Worker management endpoints
  router.post(
    '/workers',
    authenticateJwt,
    validateRequest(registerWorkerSchema),
    async (req, res, next) => {
      try {
        const result = await controller.registerWorker(req.body);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/workers/:workerId', authenticateJwt, async (req, res, next) => {
    try {
      const result = await controller.getWorker(req.params.workerId);
      if (!result) {
        res.status(404).json({ message: 'Worker not found' });
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/workers/:workerId/onboarding/complete', authenticateJwt, async (req, res, next) => {
    try {
      const result = await controller.completeOnboarding(req.params.workerId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/workers/:workerId/status',
    authenticateJwt,
    validateRequest(updateStatusSchema),
    async (req, res, next) => {
      try {
        const result = await controller.updateWorkerStatus(req.params.workerId, req.body.status);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/workers/:workerId/skills/reassess',
    authenticateJwt,
    validateRequest(reassessSkillsSchema),
    async (req, res, next) => {
      try {
        const result = await controller.reassessWorkerSkills(
          req.params.workerId,
          req.body.taskType
        );
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Apply error handling middleware last
  router.use(errorHandler);

  return router;
}
