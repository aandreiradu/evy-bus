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
