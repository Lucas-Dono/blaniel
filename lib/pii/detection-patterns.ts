/**
 * PII DETECTION PATTERNS
 *
 * Patterns for detecting Personally Identifiable Information (PII)
 * Compliance: GDPR, CCPA, COPPA
 *
 * Privacy Principle:
 * - Detect sensitive information that could identify real people
 * - Redact/sanitize PII before storage or display
 * - Balance privacy protection with user experience
 */

export enum PIIType {
  // Financial
  SSN = "SSN", // Social Security Number
  CREDIT_CARD = "CREDIT_CARD",
  BANK_ACCOUNT = "BANK_ACCOUNT",
  ROUTING_NUMBER = "ROUTING_NUMBER",

  // Contact
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  ADDRESS = "ADDRESS",

  // Government IDs
  PASSPORT = "PASSPORT",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  TAX_ID = "TAX_ID",

  // Network
  IP_ADDRESS = "IP_ADDRESS",
  MAC_ADDRESS = "MAC_ADDRESS",

  // Personal
  DATE_OF_BIRTH = "DATE_OF_BIRTH",
  FULL_NAME = "FULL_NAME", // With context

  // Medical
  MEDICAL_RECORD = "MEDICAL_RECORD",
  INSURANCE_NUMBER = "INSURANCE_NUMBER",
}

export interface PIIPattern {
  type: PIIType;
  name: string;
  regex: RegExp;
  validator?: (match: string) => boolean; // Additional validation
  redactionTemplate: string; // How to redact (e.g., "[SSN REDACTED]")
  severity: "critical" | "high" | "medium" | "low";
  examples: string[];
  falsePositivePatterns?: RegExp[]; // Patterns to exclude
}

/**
 * US Social Security Number (SSN)
 * Format: XXX-XX-XXXX or XXXXXXXXX
 */
export const SSN_PATTERN: PIIPattern = {
  type: PIIType.SSN,
  name: "Social Security Number",
  regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  validator: (match: string) => {
    // Remove hyphens
    const cleaned = match.replace(/-/g, "");
    // Check length
    if (cleaned.length !== 9) return false;

    // Check for invalid prefixes (000, 666, 900-999)
    const prefix = parseInt(cleaned.substring(0, 3));
    if (prefix === 0 || prefix === 666 || prefix >= 900) return false;

    // Check for invalid middle group (00)
    const middle = parseInt(cleaned.substring(3, 5));
    if (middle === 0) return false;

    // Check for invalid last group (0000)
    const last = parseInt(cleaned.substring(5, 9));
    if (last === 0) return false;

    return true;
  },
  redactionTemplate: "[SSN REDACTED]",
  severity: "critical",
  examples: ["123-45-6789", "123456789"],
  falsePositivePatterns: [
    /000-?00-?0000/, // Test SSN
    /111-?11-?1111/, // Common fake
  ],
};

/**
 * Credit Card Numbers
 * Supports: Visa, MasterCard, Amex, Discover
 */
export const CREDIT_CARD_PATTERN: PIIPattern = {
  type: PIIType.CREDIT_CARD,
  name: "Credit Card Number",
  regex:
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  validator: (match: string) => {
    // Luhn algorithm check
    const cleaned = match.replace(/\D/g, "");
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  },
  redactionTemplate: "[CREDIT CARD REDACTED]",
  severity: "critical",
  examples: [
    "4532015112830366", // Visa
    "5425233430109903", // MasterCard
    "374245455400126", // Amex
  ],
};

/**
 * Email Addresses
 * Note: Only redact when unexpected (not in email field)
 */
export const EMAIL_PATTERN: PIIPattern = {
  type: PIIType.EMAIL,
  name: "Email Address",
  regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  redactionTemplate: "[EMAIL REDACTED]",
  severity: "medium",
  examples: ["user@example.com", "john.doe@company.org"],
};

/**
 * Phone Numbers (US/International)
 * Formats: (555) 123-4567, 555-123-4567, +1 555 123 4567, etc.
 */
export const PHONE_PATTERN: PIIPattern = {
  type: PIIType.PHONE,
  name: "Phone Number",
  regex:
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b|\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
  validator: (match: string) => {
    // Remove non-digits
    const digits = match.replace(/\D/g, "");

    // US phone: 10 digits (or 11 with country code)
    // International: 7-15 digits
    if (digits.length < 7 || digits.length > 15) return false;

    // Skip obviously fake numbers (all zeros, all ones, etc.)
    if (/^0+$/.test(digits) || /^1+$/.test(digits)) return false;

    // Require separators for 8-digit sequences to avoid false positives
    // (real phone numbers typically have formatting)
    if (digits.length === 8 && !/[-.\s()]/.test(match)) return false;

    return true;
  },
  redactionTemplate: "[PHONE REDACTED]",
  severity: "high",
  examples: [
    "(555) 123-4567",
    "555-123-4567",
    "+1 555 123 4567",
    "+44 20 1234 5678",
  ],
};

/**
 * Physical Addresses (US)
 * Format: Street number + street name + optional unit
 */
export const ADDRESS_PATTERN: PIIPattern = {
  type: PIIType.ADDRESS,
  name: "Physical Address",
  regex:
    /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl)(?:\s+(?:Apt|Unit|Suite|Ste|#)\s*\d+[A-Z]?)?\b/gi,
  redactionTemplate: "[ADDRESS REDACTED]",
  severity: "high",
  examples: [
    "123 Main Street",
    "456 Oak Avenue Apt 2B",
    "789 Elm Road Suite 100",
  ],
};

/**
 * IP Addresses (IPv4 and IPv6)
 */
export const IP_ADDRESS_PATTERN: PIIPattern = {
  type: PIIType.IP_ADDRESS,
  name: "IP Address",
  regex:
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  validator: (match: string) => {
    // Exclude localhost and common private ranges
    const excluded = ["127.0.0.1", "0.0.0.0", "255.255.255.255"];
    if (excluded.includes(match)) return false;

    // Exclude private IP ranges (optional - depends on use case)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const parts = match.split(".");
    if (parts.length === 4) {
      const first = parseInt(parts[0]);
      if (first === 10) return false;
      if (first === 172 && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31)
        return false;
      if (first === 192 && parseInt(parts[1]) === 168) return false;
    }

    return true;
  },
  redactionTemplate: "[IP REDACTED]",
  severity: "medium",
  examples: ["192.0.2.1", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"],
  falsePositivePatterns: [
    /127\.0\.0\.1/, // localhost
    /0\.0\.0\.0/, // any address
  ],
};

/**
 * Date of Birth
 * Formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
 */
export const DATE_OF_BIRTH_PATTERN: PIIPattern = {
  type: PIIType.DATE_OF_BIRTH,
  name: "Date of Birth",
  regex:
    /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12][0-9]|3[01])[\/\-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12][0-9]|3[01])\b/g,
  validator: (match: string) => {
    // Parse date and check if it's a plausible birthdate
    const parts = match.split(/[\/\-]/);
    const currentYear = new Date().getFullYear();

    // Determine format: YYYY-MM-DD vs MM/DD/YYYY
    let year: number;
    if (parts[0].length === 4) {
      // YYYY-MM-DD format
      year = parseInt(parts[0]);
    } else {
      // MM/DD/YYYY or DD/MM/YYYY format
      year = parseInt(parts[2]);
    }

    // Must be between 1900 and current year
    return year >= 1900 && year <= currentYear;
  },
  redactionTemplate: "[DOB REDACTED]",
  severity: "high",
  examples: ["01/15/1990", "1990-01-15", "15/01/1990"],
};

/**
 * US Passport Number
 * Format: 9 alphanumeric characters
 */
export const PASSPORT_PATTERN: PIIPattern = {
  type: PIIType.PASSPORT,
  name: "Passport Number",
  regex: /\b[A-Z]{1,2}[0-9]{7,9}\b/g,
  validator: (match: string) => {
    // US passports are typically 9 characters
    return match.length === 9;
  },
  redactionTemplate: "[PASSPORT REDACTED]",
  severity: "critical",
  examples: ["A12345678", "AB1234567"],
};

/**
 * Driver's License Number (varies by state)
 * This is a simplified pattern
 */
export const DRIVERS_LICENSE_PATTERN: PIIPattern = {
  type: PIIType.DRIVERS_LICENSE,
  name: "Driver's License Number",
  regex: /\b[A-Z]{1,2}[0-9]{5,8}\b/g,
  redactionTemplate: "[DL REDACTED]",
  severity: "high",
  examples: ["D1234567", "AB123456"],
};

/**
 * Bank Account Number (US)
 * Format: 10-17 digits (excluding SSN/CC which are validated separately)
 */
export const BANK_ACCOUNT_PATTERN: PIIPattern = {
  type: PIIType.BANK_ACCOUNT,
  name: "Bank Account Number",
  regex: /\b\d{10,17}\b/g,
  validator: (match: string) => {
    // Must be 10-17 digits (not 9 which is SSN, not 15-16 which is CC)
    const length = match.length;
    if (length === 9) return false; // Likely SSN
    if (length === 15 || length === 16) return false; // Likely credit card
    return length >= 10 && length <= 17;
  },
  redactionTemplate: "[ACCOUNT REDACTED]",
  severity: "critical",
  examples: ["1234567890123", "1234567890"],
};

/**
 * Medical Record Number
 * Format: Varies, typically alphanumeric
 */
export const MEDICAL_RECORD_PATTERN: PIIPattern = {
  type: PIIType.MEDICAL_RECORD,
  name: "Medical Record Number",
  regex: /\bMRN\s*:?\s*[A-Z0-9]{6,12}\b/gi,
  redactionTemplate: "[MRN REDACTED]",
  severity: "critical",
  examples: ["MRN: 123456", "MRN 12345678"],
};

/**
 * All PII patterns grouped
 * Order matters: More specific patterns should come before generic ones
 */
export const ALL_PII_PATTERNS: PIIPattern[] = [
  SSN_PATTERN,
  CREDIT_CARD_PATTERN,
  MEDICAL_RECORD_PATTERN, // Before phone/bank account (more specific)
  PASSPORT_PATTERN,
  BANK_ACCOUNT_PATTERN,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  ADDRESS_PATTERN,
  IP_ADDRESS_PATTERN,
  DATE_OF_BIRTH_PATTERN,
  DRIVERS_LICENSE_PATTERN,
];

/**
 * Severity-based grouping
 */
export const CRITICAL_PII_PATTERNS = ALL_PII_PATTERNS.filter(
  (p) => p.severity === "critical"
);

export const HIGH_PII_PATTERNS = ALL_PII_PATTERNS.filter(
  (p) => p.severity === "high"
);

export const MEDIUM_PII_PATTERNS = ALL_PII_PATTERNS.filter(
  (p) => p.severity === "medium"
);

/**
 * Context-aware detection
 * Some patterns should only be flagged in certain contexts
 */
export interface PIIContext {
  allowEmails?: boolean; // Allow emails in contact forms
  allowPhones?: boolean; // Allow phones in contact info
  allowDatesInStories?: boolean; // Allow dates in narrative context
  strictMode?: boolean; // Flag everything, even low confidence
}

/**
 * Default contexts for different use cases
 */
export const PII_CONTEXTS = {
  CHAT_MESSAGE: {
    allowEmails: false,
    allowPhones: false,
    allowDatesInStories: false, // Detect dates in chat as they could be real PII
    strictMode: true,
  } as PIIContext,

  USER_PROFILE: {
    allowEmails: true, // User's own email
    allowPhones: true, // User's own phone
    allowDatesInStories: false,
    strictMode: false,
  } as PIIContext,

  STORY_CONTENT: {
    allowEmails: false,
    allowPhones: false,
    allowDatesInStories: true,
    strictMode: false,
  } as PIIContext,

  STRICT_COMPLIANCE: {
    allowEmails: false,
    allowPhones: false,
    allowDatesInStories: false,
    strictMode: true,
  } as PIIContext,
};

/**
 * Helper: Get patterns for specific context
 */
export function getPatternsForContext(context: PIIContext): PIIPattern[] {
  return ALL_PII_PATTERNS.filter((pattern) => {
    // Filter based on context
    if (pattern.type === PIIType.EMAIL && context.allowEmails) return false;
    if (pattern.type === PIIType.PHONE && context.allowPhones) return false;
    if (
      pattern.type === PIIType.DATE_OF_BIRTH &&
      context.allowDatesInStories
    )
      return false;

    // In non-strict mode, exclude low severity
    if (!context.strictMode && pattern.severity === "low") return false;

    return true;
  });
}
