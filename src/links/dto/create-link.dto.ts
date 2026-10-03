import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
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

/**
 * Reserved route segments that must never become short codes.
 *
 * Security rationale: A user who registers the alias "auth" would receive
 * all traffic intended for POST /auth/login — a realistic confused-deputy
 * attack and a data-poisoning risk. We reject all system paths at the DB
 * input layer so the redirect controller can never shadow an API route.
 */
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

/**
 * Allowed URL schemes.
 *
 * We only allow http/https. Schemes like javascript:, data:, file:,
 * and vbscript: can execute code in the browser or leak local files
 * when the redirect target is opened by a user.
 */
const ALLOWED_URL_SCHEMES = /^https?:\/\//i;

/** Rejects any URL whose scheme is not http or https. */
@ValidatorConstraint({ name: 'isSafeUrl', async: false })
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

/** Rejects short codes that conflict with reserved application routes. */
@ValidatorConstraint({ name: 'isNotReservedAlias', async: false })
class IsNotReservedAliasConstraint implements ValidatorConstraintInterface {
  validate(alias: unknown, _args: ValidationArguments): boolean {
    if (typeof alias !== 'string') return true; // let other validators handle type
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

export class CreateLinkDto {
  /**
   * Destination URL.
   *
   * Two-layer validation:
   * 1. @IsUrl ensures structural validity (hostname, format).
   * 2. @IsSafeUrl ensures only http/https schemes are accepted.
   *
   * Together they reject javascript:alert(1), data:text/html,<script>...,
   * file:///etc/passwd, and vbscript:msgbox(1).
   */
  @IsNotEmpty()
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
  originalUrl!: string;

  /**
   * Optional custom short code (alias).
   *
   * Constraints:
   * - 3–50 characters (short enough to type, long enough to be meaningful)
   * - Only alphanumeric, hyphens, underscores — no spaces, no special chars
   * - Must not match a reserved system route
   *
   * The uniqueness check (ConflictException) is handled in LinksService.create().
   */
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
}
