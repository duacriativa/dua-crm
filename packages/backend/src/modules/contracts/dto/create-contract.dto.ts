import { ContractServiceType, ContractStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class CreateContractDto {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  contactId?: string;
  asaasCustomerId?: string;
  serviceType: ContractServiceType;
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
  description?: string;
  totalValue: number;
  monthlyValue: number;
  installments?: number;
  signedAt: string;   // ISO date string
  startsAt: string;
  endsAt?: string;
  clicksignDocId?: string;
  notes?: string;
  cancellationReason?: string;
}
