import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      createUser: vi.fn(),
    };

    jwtService = {
      signAsync: vi.fn().mockResolvedValue('mocked-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      (usersService.findByEmail as any).mockResolvedValue({ id: 'uuid', email: 'test@example.com' });

      await expect(
        authService.register({
          name: 'Asif',
          email: 'test@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password and create user when email is available', async () => {
      (usersService.findByEmail as any).mockResolvedValue(null);
      (usersService.createUser as any).mockImplementation((data: any) =>
        Promise.resolve({
          id: 'user-uuid',
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
        }),
      );

      const result = await authService.register({
        name: 'Asif',
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.message).toBe('Registration successful');
      expect(result.user).toEqual({
        id: 'user-uuid',
        name: 'Asif',
        email: 'test@example.com',
      });
      expect(usersService.createUser).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist', async () => {
      (usersService.findByEmail as any).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hash = await bcrypt.hash('CorrectPassword123!', 10);
      (usersService.findByEmail as any).mockResolvedValue({
        id: 'uuid',
        email: 'test@example.com',
        passwordHash: hash,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return token and safe user if credentials are valid', async () => {
      const password = 'StrongPassword123!';
      const hash = await bcrypt.hash(password, 10);
      (usersService.findByEmail as any).mockResolvedValue({
        id: 'uuid-123',
        name: 'Asif',
        email: 'asif@example.com',
        passwordHash: hash,
      });

      const result = await authService.login({
        email: 'asif@example.com',
        password,
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.user).toEqual({
        id: 'uuid-123',
        name: 'Asif',
        email: 'asif@example.com',
      });
    });
  });
});
