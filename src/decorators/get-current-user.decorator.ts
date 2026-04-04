import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayloadWithRt } from '../modules/auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayloadWithRt;
}

export const GetCurrentUser = createParamDecorator(
  (data: keyof JwtPayloadWithRt | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!data) return user;

    return user[data];
  },
);
