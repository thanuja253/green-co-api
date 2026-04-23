import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as https from 'node:https';

export type IfscLookupDetails = {
  ifsc_code: string;
  bank_name: string;
  branch_name: string;
  address: string;
  city: string;
  district: string;
  state: string;
};

export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
}

export async function lookupIfscDetails(rawIfsc: string): Promise<IfscLookupDetails> {
  const ifsc = String(rawIfsc || '').trim().toUpperCase();
  if (!ifsc) {
    throw new BadRequestException('ifsc code is required');
  }
  if (!isValidIfsc(ifsc)) {
    throw new BadRequestException('invalid ifsc format');
  }

  const providerPayload = await new Promise<any>((resolve, reject) => {
    const req = https.get(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        if ((res.statusCode || 500) >= 400) {
          return reject(new NotFoundException('Invalid IFSC code'));
        }
        try {
          return resolve(JSON.parse(raw || '{}'));
        } catch {
          return reject(
            new ServiceUnavailableException('Unable to parse IFSC response from provider'),
          );
        }
      });
    });

    req.setTimeout(7000, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', () => {
      reject(new ServiceUnavailableException('IFSC lookup service is unavailable'));
    });
  });

  return {
    ifsc_code: ifsc,
    bank_name: providerPayload?.BANK || '',
    branch_name: providerPayload?.BRANCH || '',
    address: providerPayload?.ADDRESS || '',
    city: providerPayload?.CITY || '',
    district: providerPayload?.DISTRICT || '',
    state: providerPayload?.STATE || '',
  };
}
