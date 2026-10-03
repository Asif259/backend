import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, LoginResponse, RegisterResponse } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

/**
 * Auth endpoints are rate-limited with the 'auth' throttler:
 * max 10 requests per minute per IP.
 *
 * This protects against:
 * - Brute-force password attacks on /login
 * - Account-enumeration via /register
 * - Credential-stuffing attacks
 *
 * The ThrottlerGuard runs before the JWT guard so the limit applies
 * to all requests, including those with invalid credentials.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ auth: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }
}
