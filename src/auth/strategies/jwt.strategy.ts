import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // SUPER_ADMIN users don't have a tenantId — validate differently
    if (payload.isSuperAdmin || payload.role === 'SUPER_ADMIN') {
      return {
        id: payload.sub,
        username: payload.username,
        role: 'SUPER_ADMIN',
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
