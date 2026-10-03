import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '../users/entities/user.entity.js';
import { LinksService, GetLinksParams } from './links.service.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { UpdateLinkDto } from './dto/update-link.dto.js';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Link creation is rate-limited to 30 requests/minute per IP.
   * This prevents programmatic link-spam while keeping the API comfortable
   * for normal users.
   *
   * ThrottlerGuard must be listed after JwtAuthGuard so only authenticated
   * users consume the throttle budget (unauthenticated requests are rejected
   * by JwtAuthGuard first with a 401).
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ links: { limit: 30, ttl: 60_000 } })
  create(
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const params: GetLinksParams = {
      search,
      status,
      sort,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    };
    return this.linksService.findAllByUser(user.id, params);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLinkDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.remove(id, user.id);
  }

  /**
   * Disable a link — stops it from redirecting without deleting it.
   *
   * Returns 404 if the link doesn't exist and 403 if the user doesn't own it.
   * Using POST (not DELETE) because the resource is not removed, only toggled.
   */
  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.setActive(id, user.id, false);
  }

  /** Re-enable a previously disabled link. */
  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.linksService.setActive(id, user.id, true);
  }
}
