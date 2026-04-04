import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express'; // Імпортуємо стандартний тип Request
import { JwtPayload } from '../modules/auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

export const GetCurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const user = request.user;

    if (!data) return user;

    return user[data];
  },
);
