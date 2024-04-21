import z from 'zod';

export const createUserSchema = z
  .object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'First name is required' }),
    email: z.string().email({ message: 'Invalid email' }),
    password: z
      .string()
      .min(1, { message: 'Password si required' })
      .max(36, { message: 'Password cannot exceed 36 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: `Passwords don't match`,
  });

export type CreateUserDTO = z.infer<typeof createUserSchema>;
