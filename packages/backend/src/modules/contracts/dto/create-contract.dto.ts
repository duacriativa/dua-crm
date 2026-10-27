import { ContractServiceType, ContractStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

// Todo campo precisa de decorator: o ValidationPipe global usa
// forbidNonWhitelisted, então campo sem decorator derruba a requisição (400).
export class CreateContractDto {
  @IsString()
  clientName: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  asaasCustomerId?: string;

  @IsEnum(ContractServiceType)
  serviceType: ContractServiceType;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  totalValue: number;

  @IsNumber()
  monthlyValue: number;

  @IsOptional()
  @IsInt()
  installments?: number;

  @IsString()
  signedAt: string; // ISO date string

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  clicksignDocId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
