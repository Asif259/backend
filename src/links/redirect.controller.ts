import { Controller, Get, NotFoundException, Param, Redirect } from '@nestjs/common';
import { LinksService } from './links.service.js';

@Controller()
export class RedirectController {
  constructor(private readonly linksService: LinksService) {}

  @Get(':shortCode')
  @Redirect()
  async redirect(@Param('shortCode') shortCode: string) {
    const link = await this.linksService.findByShortCode(shortCode);
    if (!link) {
      throw new NotFoundException('Short link not found');
    }
    return { url: link.originalUrl, statusCode: 302 };
  }
}
