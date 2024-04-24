import z from 'zod';

export const createQueueSchema = z.object({
  QueueName: z.string().min(1, { message: 'Queue name is required' }),
});

export type CreateQueueDTO = z.infer<typeof createQueueSchema>;
