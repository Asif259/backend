import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity.js';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
