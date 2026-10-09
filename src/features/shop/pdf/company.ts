import { CONTACT, SITE } from "@/lib/site";

/**
 * Who issues every back-office document. One definition, so an invoice and a
 * ledger print the same company block.
 */

export interface PdfCompany {
  name: string;
  address: string;
  phone: string;
}

export const PDF_COMPANY: PdfCompany = {
  name: SITE.legalName,
  address: `${CONTACT.address.line1}, ${CONTACT.address.city}, ${CONTACT.address.country}`,
  phone: `${CONTACT.phone} · WhatsApp ${CONTACT.whatsapp}`,
};
