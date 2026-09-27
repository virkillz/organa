import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '@organa/shared';

export abstract class OtpSender {
  abstract send(channel: OtpChannel, destination: string, code: string): Promise<void>;
}

/**
 * Logs the code instead of sending it. Real WhatsApp/SMS/missed-call delivery is
 * out of scope for the investor demo (see the MVP spec).
 */
@Injectable()
export class LoggingOtpSender extends OtpSender {
  private readonly logger = new Logger('OtpSender');

  async send(channel: OtpChannel, destination: string, code: string): Promise<void> {
    this.logger.log(`OTP ${code} via ${channel} to ${destination}`);
  }
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/** "+62 812 3456 7890" -> "+62****7890". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}
