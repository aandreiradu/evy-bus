import { String } from 'aws-sdk/clients/apigateway';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId: string;
  queueURL: string;
}

export interface CreateQueueArgs
  extends Pick<AWS.SQS.Types.CreateQueueRequest, 'Attributes'> {
  userId: string;
  queueName: string;
  tags?: string;
  successURL: string;
  errorURL: string;
}

export type SaveQueueArgs = {
  id: string;
  userId: string;
  queueToken: string;
  queueURL: string;
  successURL: string;
  errorURL: string;
};

export type PublishToEventsQueue = {
  correlationId: string;
  userId: string;
  queueToken: string;
  clientMessage: unknown;
};

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

export enum SubscriptionType {
  'BRONZE' = 'BRONZE',
  'SILVER' = 'SILVER',
  'GOLD' = 'GOLD',
}

export type BillingMessage = {
  userId: string;
  timestamp: number;
  subscriptionType: SubscriptionType;
};

export type EventQueueMessage = {
  correlationId: string;
  userId: string;
  clientMessage: Record<string, any>;
  successURL: string;
  errorURL: string;
};
