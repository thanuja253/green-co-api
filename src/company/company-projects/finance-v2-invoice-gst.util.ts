import { BadRequestException } from '@nestjs/common';

/** Max GST rate (%) for Finance v2 line items. */
export const FINANCE_V2_MAX_GST_RATE = 28;

/**
 * When true (env FINANCE_V2_STRICT_STATE_CODES=true), taxable invoices must include
 * supplier and place-of-supply state codes. Default false keeps legacy clients working.
 */
export function financeV2StrictStateCodesEnabled(): boolean {
  return process.env.FINANCE_V2_STRICT_STATE_CODES === 'true';
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function isFinanceV2Taxable(
  invoiceType: 'proforma' | 'tax',
  sgstRate: number,
  cgstRate: number,
  igstRate: number,
): boolean {
  if (invoiceType === 'tax') return true;
  return sgstRate > 0 || cgstRate > 0 || igstRate > 0;
}

export function parseFinanceV2StateCode(
  raw: string | undefined | null,
  label: string,
): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  if (!/^\d{2}$/.test(s)) {
    throw new BadRequestException({
      status: 'error',
      message: `${label} must be exactly 2 digits (e.g. 09).`,
    });
  }
  const num = parseInt(s, 10);
  if (num < 1 || num > 38) {
    throw new BadRequestException({
      status: 'error',
      message: `${label} must be between 01 and 38.`,
    });
  }
  return s;
}

function assertRate(name: string, rate: number): void {
  if (!Number.isFinite(rate)) {
    throw new BadRequestException({ status: 'error', message: `${name} must be a valid number.` });
  }
  if (rate < 0 || rate > FINANCE_V2_MAX_GST_RATE) {
    throw new BadRequestException({
      status: 'error',
      message: `${name} must be between 0 and ${FINANCE_V2_MAX_GST_RATE}.`,
    });
  }
  const rounded = round2(rate);
  if (Math.abs(rounded - rate) > 1e-9) {
    throw new BadRequestException({
      status: 'error',
      message: `${name} must have at most 2 decimal places.`,
    });
  }
}

export type FinanceV2ComputedTax = {
  sgst_rate: number;
  cgst_rate: number;
  igst_rate: number;
  sgst_amt: number;
  cgst_amt: number;
  igst_amt: number;
  tax_amount: number;
  total_amount: number;
  transaction_type: 'intra' | 'inter' | null;
  is_intra_state: boolean | null;
};

/**
 * Validates GST rates and (when state codes are present) intra/inter rules.
 * Rates are percentages; monetary amounts are derived from payable_amount.
 */
export function computeAndValidateFinanceV2Gst(args: {
  payable_amount: number;
  sgst: number;
  cgst: number;
  igst: number;
  supplier_state_code: string | null;
  place_of_supply_state_code: string | null;
}): FinanceV2ComputedTax {
  const payable = round2(Number(args.payable_amount));
  if (!Number.isFinite(payable) || payable <= 0) {
    throw new BadRequestException({
      status: 'error',
      message: 'payable_amount must be greater than 0.',
    });
  }

  const sgstR = round2(Number(args.sgst));
  const cgstR = round2(Number(args.cgst));
  const igstR = round2(Number(args.igst));

  assertRate('SGST', sgstR);
  assertRate('CGST', cgstR);
  assertRate('IGST', igstR);

  const supplier = args.supplier_state_code;
  const place = args.place_of_supply_state_code;
  const haveBoth = supplier !== null && place !== null;
  const haveAny = supplier !== null || place !== null;

  if (haveAny && !haveBoth) {
    throw new BadRequestException({
      status: 'error',
      message: 'Both supplier_state_code and place_of_supply_state_code are required together.',
    });
  }

  let transaction_type: 'intra' | 'inter' | null = null;
  let is_intra_state: boolean | null = null;

  if (haveBoth) {
    is_intra_state = supplier === place;
    transaction_type = is_intra_state ? 'intra' : 'inter';

    if (is_intra_state) {
      if (igstR !== 0) {
        throw new BadRequestException({
          status: 'error',
          message: 'For intra-state supply, IGST rate must be 0.',
        });
      }
      const anyTax = sgstR > 0 || cgstR > 0 || igstR > 0;
      if (anyTax) {
        if (sgstR <= 0 || cgstR <= 0) {
          throw new BadRequestException({
            status: 'error',
            message: 'For intra-state supply with tax, both SGST and CGST must be greater than 0.',
          });
        }
        if (sgstR !== cgstR) {
          throw new BadRequestException({
            status: 'error',
            message: 'For intra-state supply, SGST and CGST must be equal.',
          });
        }
      }
    } else {
      if (sgstR !== 0 || cgstR !== 0) {
        throw new BadRequestException({
          status: 'error',
          message: 'For inter-state supply, CGST and SGST must be 0.',
        });
      }
    }
  }

  const sgst_amt = round2((payable * sgstR) / 100);
  const cgst_amt = round2((payable * cgstR) / 100);
  const igst_amt = round2((payable * igstR) / 100);
  const tax_amount = round2(sgst_amt + cgst_amt + igst_amt);
  const total_amount = round2(payable + tax_amount);

  return {
    sgst_rate: sgstR,
    cgst_rate: cgstR,
    igst_rate: igstR,
    sgst_amt,
    cgst_amt,
    igst_amt,
    tax_amount,
    total_amount,
    transaction_type,
    is_intra_state,
  };
}
