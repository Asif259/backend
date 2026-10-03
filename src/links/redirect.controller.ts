import {
  Controller,
  Get,
  GoneException,
  NotFoundException,
  Param,
  Redirect,
} from '@nestjs/common';
import { LinksService } from './links.service.js';

@Controller()
export class RedirectController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Public short-link redirect.
   *
   * Security considerations:
   * - Non-existent codes return 404 (not 500/DB error) — no information leakage.
   * - Disabled links return 410 Gone — not 404, to distinguish "never existed"
   *   from "existed but turned off". The distinction helps legitimate users.
   * - Expired links return 410 Gone with a human-readable message.
   * - The redirect target (originalUrl) has already been validated as http/https
   *   at creation time, so no scheme-checking is needed here.
   * - No internal link data (userId, DB ids) is exposed in any error response.
   */
  @Get(':shortCode')
  @Redirect()
  async redirect(@Param('shortCode') shortCode: string) {
    const link = await this.linksService.findByShortCode(shortCode);

    if (!link) {
      throw new NotFoundException('Short link not found');
    }

    if (!link.isActive) {
      throw new GoneException('This link has been disabled');
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('This link has expired');
    }

    return { url: link.originalUrl, statusCode: 302 };
  }
}
