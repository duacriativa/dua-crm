import { ContractServiceType } from '@prisma/client';

export class CreateContractDto {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  contactId?: string;
  asaasCustomerId?: string;
  serviceType: ContractServiceType;
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
