import z from 'zod';

export const createQueueSchema = z.object({
  queueName: z.string().min(1, { message: 'Queue name is required' }),
  successURL: z.string().url({ message: 'Invalid success URL' }),
  errorURL: z.string().url({ message: 'Invalid error URL' }),
});

export type CreateQueueDTO = z.infer<typeof createQueueSchema>;
