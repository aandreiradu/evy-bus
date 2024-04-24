import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export interface CreateQueueArgs extends AWS.SQS.Types.CreateQueueRequest {
  userId: string;
}

export type QueueToken = {
  queueURL: string;
  queueToken: string;
};

export type UserQueueTokensResponse = {
  id: string;
  queuesTokens: QueueToken[];
};

export type SaveQueueTokenURLArgs = {
  userId: string;
  queueTokens: QueueToken[];
};
