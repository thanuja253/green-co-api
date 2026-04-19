import { BadRequestException } from '@nestjs/common';

/** India GST state codes 01–38 (two digits). */
const INDIA_STATE_CODE_RE = /^(0[1-9]|[12]\d|3[0-8])$/;

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Parses optional state code from multipart; empty → null.
 * Invalid non-empty values throw 400.
 */
export function parseCiiExpenseStateCode(
  raw: string | undefined | null,
  fieldLabel: string,
): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  let normalized = s;
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 38) normalized = n.toString().padStart(2, '0');
  }

  if (!INDIA_STATE_CODE_RE.test(normalized)) {
    throw new BadRequestException({
      status: 'error',
      message: `${fieldLabel} must be a valid two-digit state code (01–38).`,
    });
  }
  return normalized;
}

/**
 * CII expense invoices use SGST/CGST/IGST as percentages (0–100).
 * When any rate &gt; 0, both state codes are required and intra/inter rules apply.
 */
export function validateCiiExpenseGstWithStates(args: {
  invoiceamount: number;
  sgst: number;
  cgst: number;
  igst: number;
  supplier_state_code: string | null;
  place_of_supply_state_code: string | null;
}): { transaction_type: 'intra' | 'inter' | null } {
  const { invoiceamount, sgst, cgst, igst } = args;
  const supplier = args.supplier_state_code;
  const place = args.place_of_supply_state_code;

  if (!Number.isFinite(invoiceamount) || invoiceamount <= 0) {
    throw new BadRequestException({
      status: 'error',
      message: 'Invoice amount must be greater than 0.',
    });
  }

  const sgstR = round2(Number(sgst));
  const cgstR = round2(Number(cgst));
  const igstR = round2(Number(igst));

  const hasGst = sgstR > 0 || cgstR > 0 || igstR > 0;

  if ((supplier && !place) || (!supplier && place)) {
    throw new BadRequestException({
      status: 'error',
      message:
        'supplier_state_code and place_of_supply_state_code must both be provided or both omitted.',
    });
  }

  if (hasGst) {
    if (!supplier || !place) {
      throw new BadRequestException({
        status: 'error',
        message:
          'supplier_state_code and place_of_supply_state_code are required when SGST, CGST or IGST is greater than zero.',
      });
    }

    const intra = supplier === place;
    if (intra) {
      if (igstR !== 0) {
        throw new BadRequestException({
          status: 'error',
          message: 'For intra-state supply, IGST must be 0.',
        });
      }
      const anyComponent = sgstR > 0 || cgstR > 0;
      if (anyComponent) {
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
          message: 'For inter-state supply, SGST and CGST must be 0.',
        });
      }
    }
    return { transaction_type: intra ? 'intra' : 'inter' };
  }

  if (supplier && place) {
    return { transaction_type: supplier === place ? 'intra' : 'inter' };
  }

  return { transaction_type: null };
}
