import { BadRequestException, Logger, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  private readonly logger: Logger = new Logger(ZodValidationPipe.name);

  constructor(private readonly schema: ZodSchema) {}

  async transform(value: any) {
    try {
      const parsedSchema = await this.schema.safeParseAsync(value);

      if (parsedSchema.success === false) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: parsedSchema.error.errors,
        });
      }

      return value;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate this request => ${JSON.stringify(
          value,
        )}; error: ${JSON.stringify(error)}`,
      );

      throw new BadRequestException({
        message: 'Validation failed',
        errors: JSON.stringify(error),
      });
    }
  }
}
