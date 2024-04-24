import { v4 as uuidv4 } from 'uuid';

export class UtilsService {
  generateQueueToken = (): string => uuidv4();
}
