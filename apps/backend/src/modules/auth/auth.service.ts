import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { parseDurationToMs } from './utils/duration.util';
import { generateOpaqueToken, hashToken } from './utils/token.util';

const BCRYPT_SALT_ROUNDS = 10;

export interface SanitizedUser {
  id: string;
  email: string;
  nombre: string;
  fechaNacimiento: Date;
  createdAt: Date;
}

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  fechaNacimiento: Date;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<SanitizedUser> {
    const existente = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existente) {
      throw new ConflictException({
        code: 'email_ya_registrado',
        message: 'Ya existe una cuenta con ese email.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        fechaNacimiento: new Date(dto.fechaNacimiento),
      },
    });

    return this.sanitizeUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: SanitizedUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      // Mismo mensaje exista o no el email, para no revelar qué cuentas existen.
      throw new UnauthorizedException({
        code: 'credenciales_invalidas',
        message: 'Email o contraseña incorrectos.',
      });
    }

    const tokens = await this.issueTokens(user.id, user.email);

    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'refresh_token_invalido',
        message: 'La sesión no es válida, inicia sesión de nuevo.',
      });
    }

    if (stored.revokedAt) {
      // Un token ya rotado (revocado) que se vuelve a usar es la señal
      // clásica de robo de refresh token — se cierran todas las sesiones
      // activas de ese usuario en vez de solo rechazar esta solicitud.
      await this.revokeAllUserRefreshTokens(stored.userId);
      throw new UnauthorizedException({
        code: 'refresh_token_reutilizado',
        message: 'Se detectó un uso inválido de la sesión; inicia sesión de nuevo.',
      });
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'refresh_token_expirado',
        message: 'La sesión expiró, inicia sesión de nuevo.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });

    if (!user) {
      throw new UnauthorizedException({
        code: 'refresh_token_invalido',
        message: 'La sesión no es válida, inicia sesión de nuevo.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Idempotente: si el token no existe, ya pertenece a otro usuario o ya
    // estaba revocado, igual se responde éxito — no hay nada más que hacer.
    if (stored && stored.userId === userId && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Se genera y guarda el token solo si el usuario existe, pero el
    // controlador siempre responde el mismo mensaje genérico — así no se
    // revela si un email está registrado o no.
    if (user) {
      const rawToken = generateOpaqueToken();
      const expiresInMs = parseDurationToMs(this.configService.get<string>('PASSWORD_RESET_EXPIRES_IN', '1h'));

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + expiresInMs),
        },
      });

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      // No existe envío de email real todavía (infraestructura de fases
      // futuras) — en desarrollo el link queda en el log del servidor.
      this.logger.log(`Link de recuperación de contraseña para ${user.email}: ${resetLink}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'token_invalido',
        message: 'El enlace de recuperación no es válido o ya expiró.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Cierra sesión en todos los dispositivos al cambiar la contraseña.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync({ sub: userId, email });

    const rawRefreshToken = generateOpaqueToken();
    const expiresInMs = parseDurationToMs(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private sanitizeUser(user: UserRecord): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      fechaNacimiento: user.fechaNacimiento,
      createdAt: user.createdAt,
    };
  }
}
