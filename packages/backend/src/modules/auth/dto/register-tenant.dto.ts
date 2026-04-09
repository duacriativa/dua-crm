import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  brandName: string;

  @IsString()
  ownerName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
