import { z } from 'zod';

export const phoneRegex = /^1[3-9]\d{9}$/;

export const emailSchema = z
  .string()
  .trim()
  .email('邮箱格式不正确')
  .max(120, '邮箱长度不能超过 120 个字符')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,20}$/, '密码需 8-20 位，且同时包含字母和数字');

export const nicknameSchema = z
  .string()
  .trim()
  .regex(/^[一-龥A-Za-z0-9_]{2,12}$/, '昵称需 2-12 个字符，支持中英文、数字、下划线');

const codeSchema = z.string().regex(/^\d{6}$/, '验证码为 6 位数字');
const accountTypeSchema = z.enum(['phone', 'email']);

function checkAccount(data, ctx) {
  if (data.accountType === 'phone') {
    if (!phoneRegex.test(data.account)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['account'],
        message: '手机号格式不正确',
      });
    }
    return;
  }

  if (!emailSchema.safeParse(data.account).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['account'],
      message: '邮箱格式不正确',
    });
  }
}

export const sendCodeSchema = z
  .object({
    accountType: accountTypeSchema,
    account: z.string().trim().min(1, '请输入手机号或邮箱'),
    purpose: z.enum(['register', 'reset_password', 'login']).default('register'),
  })
  .superRefine(checkAccount);

export const registerSchema = z
  .object({
    accountType: accountTypeSchema,
    account: z.string().trim().min(1, '请输入手机号或邮箱'),
    code: codeSchema,
    password: passwordSchema,
    nickname: nicknameSchema.optional(),
    agreed: z
      .boolean()
      .optional()
      .refine((value) => value === true, '请先阅读并同意用户协议和隐私政策'),
  })
  .superRefine(checkAccount);

export const loginSchema = z.object({
  account: z.string().trim().min(1, '请输入手机号或邮箱'),
  password: z.string().min(1, '请输入密码'),
  rememberMe: z.boolean().optional().default(false),
});

export const loginCodeSchema = z
  .object({
    accountType: accountTypeSchema,
    account: z.string().trim().min(1, '请输入手机号或邮箱'),
    code: codeSchema,
  })
  .superRefine(checkAccount);

export const resetPasswordSchema = z
  .object({
    accountType: accountTypeSchema,
    account: z.string().trim().min(1, '请输入手机号或邮箱'),
    code: codeSchema,
    password: passwordSchema,
  })
  .superRefine(checkAccount);
