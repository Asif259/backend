import { IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({ require_protocol: true }, { message: 'originalUrl must be a valid URL' })
  originalUrl!: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'shortCode may only contain letters, numbers, hyphens, and underscores',
  })
  shortCode?: string;
}
