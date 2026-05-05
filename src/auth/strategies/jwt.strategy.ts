import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { ROLES } from '../../common/constants/roles.constant';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not defined!');
    }
    super({
      jwtFromRequest: (req: Request) => {
        // Try cookie first, fall back to Authorization header
        if (req?.cookies?.auth_token) {
          return req.cookies.auth_token;
        }
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.isSuperAdmin || payload.role === ROLES.SUPER_ADMIN) {
      return {
        id: payload.sub,
        username: payload.username,
        role: ROLES.SUPER_ADMIN,
        tenantId: '',
        isSuperAdmin: true,
      };
    }

    // Regular tenant user validation
    const user = await this.usersService.findOne(payload.sub, payload.tenantId || '');
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
    };
  }
}
