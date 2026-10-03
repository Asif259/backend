import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const RESERVED_ALIASES = new Set([
  'auth',
  'dashboard',
  'links',
  'analytics',
  'settings',
  'login',
  'register',
  'api',
  'health',
  'metrics',
  'admin',
  'static',
  'assets',
  'favicon',
  'robots',
  'sitemap',
]);

const ALLOWED_URL_SCHEMES = /^https?:\/\//i;

@ValidatorConstraint({ name: 'isSafeUrlUpdate', async: false })
class IsSafeUrlConstraint implements ValidatorConstraintInterface {
  validate(url: unknown, _args: ValidationArguments): boolean {
    if (typeof url !== 'string') return false;
    return ALLOWED_URL_SCHEMES.test(url);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'URL must use http:// or https:// scheme. javascript:, data:, file:, and vbscript: are not allowed.';
  }
}

function IsSafeUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeUrlConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isNotReservedAliasUpdate', async: false })
class IsNotReservedAliasConstraint implements ValidatorConstraintInterface {
  validate(alias: unknown, _args: ValidationArguments): boolean {
    if (typeof alias !== 'string') return true;
    return !RESERVED_ALIASES.has(alias.toLowerCase());
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'This alias is reserved and cannot be used as a short code.';
  }
}

function IsNotReservedAlias(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotReservedAliasConstraint,
    });
  };
}

export class UpdateLinkDto {
  @IsOptional()
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_valid_protocol: true,
    },
    { message: 'originalUrl must be a valid URL with http or https protocol' },
  )
  @IsSafeUrl({ message: 'Only http:// and https:// URLs are allowed' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  originalUrl?: string;

  @IsOptional()
  @IsString()
  @Length(3, 50, {
    message: 'Custom alias must be between 3 and 50 characters',
  })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Custom alias may only contain letters, numbers, hyphens, and underscores',
  })
  @IsNotReservedAlias()
  shortCode?: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
