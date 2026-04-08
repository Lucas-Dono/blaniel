/**
 * PII SANITIZER TESTS
 *
 * Comprehensive tests for PII detection and sanitization
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PIISanitizer, sanitizeText, containsCriticalPII } from "../sanitizer";
import { PIIType, PII_CONTEXTS } from "../detection-patterns";

describe("PIISanitizer", () => {
  let sanitizer: PIISanitizer;

  beforeEach(() => {
    sanitizer = new PIISanitizer();
    sanitizer.clearLogs();
  });

  // =========================================================================
  // CRITICAL PII DETECTION (Financial & Government IDs)
  // =========================================================================

  describe("Critical PII: Social Security Numbers", () => {
    it("should detect and redact valid SSN with hyphens", async () => {
      const text = "My SSN is 123-45-6789 for verification";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[SSN REDACTED]");
      expect(result.sanitized).not.toContain("123-45-6789");
      expect(result.detections[0].type).toBe(PIIType.SSN);
      expect(result.detections[0].severity).toBe("critical");
    });

    it("should detect and redact SSN without hyphens", async () => {
      const text = "SSN: 123456789";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[SSN REDACTED]");
    });

    it("should NOT detect invalid SSN (000 prefix)", async () => {
      const text = "SSN: 000-12-3456";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });

    it("should NOT detect invalid SSN (666 prefix)", async () => {
      const text = "SSN: 666-12-3456";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });

    it("should NOT detect invalid SSN (900+ prefix)", async () => {
      const text = "SSN: 987-65-4321";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });

    it("should skip common fake SSNs", async () => {
      const text = "Example SSN: 111-11-1111";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });
  });

  describe("Critical PII: Credit Card Numbers", () => {
    it("should detect and redact Visa card", async () => {
      const text = "My card is 4532015112830366";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[CREDIT CARD REDACTED]");
      expect(result.detections[0].type).toBe(PIIType.CREDIT_CARD);
      expect(result.detections[0].severity).toBe("critical");
    });

    it("should detect and redact MasterCard", async () => {
      const text = "Card: 5425233430109903";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[CREDIT CARD REDACTED]");
    });

    it("should detect and redact Amex", async () => {
      const text = "Amex: 374245455400126";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[CREDIT CARD REDACTED]");
    });

    it("should validate using Luhn algorithm", async () => {
      const text = "Invalid card: 4532015112830367"; // Last digit wrong
      const result = await sanitizer.sanitize(text);

      // Should not detect (fails Luhn check)
      expect(result.containsPII).toBe(false);
    });
  });

  describe("Critical PII: Bank Accounts & Passports", () => {
    it("should detect bank account numbers", async () => {
      const text = "Account: 123456789012";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[ACCOUNT REDACTED]");
    });

    it("should detect passport numbers", async () => {
      const text = "Passport: A12345678";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[PASSPORT REDACTED]");
      expect(result.detections[0].severity).toBe("critical");
    });

    it("should detect medical record numbers", async () => {
      const text = "MRN: 12345678";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[MRN REDACTED]");
    });
  });

  // =========================================================================
  // HIGH PII DETECTION (Contact Info & Addresses)
  // =========================================================================

  describe("High PII: Phone Numbers", () => {
    it("should detect phone with parentheses", async () => {
      const text = "Call me at (555) 123-4567";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[PHONE REDACTED]");
      expect(result.detections[0].type).toBe(PIIType.PHONE);
    });

    it("should detect phone with hyphens", async () => {
      const text = "Phone: 555-123-4567";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[PHONE REDACTED]");
    });

    it("should detect international phone", async () => {
      const text = "Call: +1 555 123 4567";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[PHONE REDACTED]");
    });

    it("should detect UK phone", async () => {
      const text = "UK: +44 20 1234 5678";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
    });
  });

  describe("High PII: Physical Addresses", () => {
    it("should detect street address", async () => {
      const text = "I live at 123 Main Street";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[ADDRESS REDACTED]");
    });

    it("should detect address with apartment", async () => {
      const text = "Address: 456 Oak Avenue Apt 2B";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[ADDRESS REDACTED]");
    });

    it("should detect address with suite", async () => {
      const text = "Office: 789 Elm Road Suite 100";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
    });
  });

  describe("High PII: Date of Birth", () => {
    it("should detect DOB in MM/DD/YYYY format", async () => {
      const text = "Born on 01/15/1990";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[DOB REDACTED]");
    });

    it("should detect DOB in YYYY-MM-DD format", async () => {
      const text = "DOB: 1990-01-15";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
    });

    it("should validate year range", async () => {
      const text = "Date: 1800-01-01"; // Too old
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });
  });

  // =========================================================================
  // MEDIUM PII DETECTION (Email & IP)
  // =========================================================================

  describe("Medium PII: Email Addresses", () => {
    it("should detect email addresses", async () => {
      const text = "Contact me at john.doe@example.com";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[EMAIL REDACTED]");
    });

    it("should detect email with subdomain", async () => {
      const text = "Email: user@mail.company.org";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
    });
  });

  describe("Medium PII: IP Addresses", () => {
    it("should detect IPv4 address", async () => {
      const text = "Server IP: 192.0.2.1";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[IP REDACTED]");
    });

    it("should NOT detect localhost", async () => {
      const text = "Local: 127.0.0.1";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });

    it("should NOT detect private IP ranges (optional)", async () => {
      const text = "Internal: 10.0.0.1";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
    });

    it("should detect IPv6 address", async () => {
      const text = "IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
    });
  });

  // =========================================================================
  // MULTIPLE PII IN SINGLE TEXT
  // =========================================================================

  describe("Multiple PII Detection", () => {
    it("should detect multiple PII types in one text", async () => {
      const text =
        "My SSN is 123-45-6789, phone (555) 123-4567, email user@example.com";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.detections.length).toBe(3);
      expect(result.detections.map((d) => d.type)).toContain(PIIType.SSN);
      expect(result.detections.map((d) => d.type)).toContain(PIIType.PHONE);
      expect(result.detections.map((d) => d.type)).toContain(PIIType.EMAIL);
    });

    it("should generate accurate summary", async () => {
      const text =
        "SSN: 123-45-6789, Card: 4532015112830366, Phone: 555-123-4567";
      const result = await sanitizer.sanitize(text);

      expect(result.summary.total).toBe(3);
      expect(result.summary.bySeverity.critical).toBe(2); // SSN + Card
      expect(result.summary.bySeverity.high).toBe(1); // Phone
    });
  });

  // =========================================================================
  // CONTEXT-AWARE DETECTION
  // =========================================================================

  describe("Context-Aware Detection", () => {
    it("should allow emails in USER_PROFILE context", async () => {
      const text = "Email: user@example.com";
      const result = await sanitizer.sanitize(text, {
        context: PII_CONTEXTS.USER_PROFILE,
      });

      expect(result.containsPII).toBe(false); // Email allowed in profile
    });

    it("should block emails in CHAT_MESSAGE context", async () => {
      const text = "Email: user@example.com";
      const result = await sanitizer.sanitize(text, {
        context: PII_CONTEXTS.CHAT_MESSAGE,
      });

      expect(result.containsPII).toBe(true); // Email NOT allowed in chat
    });

    it("should allow dates in STORY_CONTENT context", async () => {
      const text = "The protagonist was born on 01/15/1990";
      const result = await sanitizer.sanitize(text, {
        context: PII_CONTEXTS.STORY_CONTENT,
      });

      expect(result.containsPII).toBe(false); // DOB allowed in stories
    });

    it("should block everything in STRICT_COMPLIANCE context", async () => {
      const text = "Born 01/15/1990, email user@example.com";
      const result = await sanitizer.sanitize(text, {
        context: PII_CONTEXTS.STRICT_COMPLIANCE,
      });

      expect(result.containsPII).toBe(true);
    });
  });

  // =========================================================================
  // FORMAT PRESERVATION
  // =========================================================================

  describe("Format Preservation", () => {
    it("should preserve SSN format showing last 4", async () => {
      const text = "SSN: 123-45-6789";
      const result = await sanitizer.sanitize(text, {
        preserveFormat: true,
      });

      expect(result.sanitized).toContain("XXX-XX-6789");
    });

    it("should preserve credit card format showing last 4", async () => {
      const text = "Card: 4532015112830366";
      const result = await sanitizer.sanitize(text, {
        preserveFormat: true,
      });

      expect(result.sanitized).toContain("**** **** **** 0366");
    });

    it("should preserve phone format showing area code", async () => {
      const text = "Phone: (555) 123-4567";
      const result = await sanitizer.sanitize(text, {
        preserveFormat: true,
      });

      expect(result.sanitized).toContain("(555) XXX-XXXX");
    });
  });

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  describe("Helper Functions", () => {
    it("sanitizeText should return sanitized string", async () => {
      const text = "SSN: 123-45-6789";
      const sanitized = await sanitizeText(text);

      expect(sanitized).toContain("[SSN REDACTED]");
      expect(sanitized).not.toContain("123-45-6789");
    });

    it("containsCriticalPII should detect critical PII", async () => {
      const text = "SSN: 123-45-6789";
      const hasCritical = await containsCriticalPII(text);

      expect(hasCritical).toBe(true);
    });

    it("containsCriticalPII should not flag non-critical", async () => {
      const text = "Email: user@example.com";
      const hasCritical = await containsCriticalPII(text);

      expect(hasCritical).toBe(false); // Email is medium, not critical
    });
  });

  // =========================================================================
  // WARNING MESSAGES
  // =========================================================================

  describe("Warning Messages", () => {
    it("should generate critical warning for SSN", async () => {
      const text = "SSN: 123-45-6789";
      const result = await sanitizer.sanitizeWithWarning(text);

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("ALERTA");
      expect(result.warning).toContain("seguro social");
    });

    it("should generate high warning for phone", async () => {
      const text = "Phone: 555-123-4567";
      const result = await sanitizer.sanitizeWithWarning(text);

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("información personal");
    });

    it("should not generate warning for clean text", async () => {
      const text = "This is a normal message with no PII";
      const result = await sanitizer.sanitizeWithWarning(text);

      expect(result.warning).toBeUndefined();
    });
  });

  // =========================================================================
  // EDGE CASES & FALSE POSITIVES
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle empty text", async () => {
      const text = "";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
      expect(result.sanitized).toBe("");
    });

    it("should handle text with no PII", async () => {
      const text = "This is a normal conversation about weather";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(false);
      expect(result.sanitized).toBe(text);
    });

    it("should handle very long text", async () => {
      const longText = "A".repeat(10000) + " SSN: 123-45-6789";
      const result = await sanitizer.sanitize(longText);

      expect(result.containsPII).toBe(true);
      expect(result.detections.length).toBe(1);
    });

    it("should handle multiple occurrences of same PII", async () => {
      const text = "SSN: 123-45-6789 and again 123-45-6789";
      const result = await sanitizer.sanitize(text);

      expect(result.detections.length).toBe(2);
    });
  });

  // =========================================================================
  // LOGGING & AUDIT
  // =========================================================================

  describe("Logging and Audit", () => {
    it("should log critical PII detections", async () => {
      const text = "SSN: 123-45-6789";
      await sanitizer.sanitize(text);

      const logs = sanitizer.getDetectionLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].type).toBe(PIIType.SSN);
    });

    it("should export logs for compliance", async () => {
      const text1 = "SSN: 123-45-6789";
      const text2 = "Phone: 555-123-4567";

      await sanitizer.sanitize(text1);
      await sanitizer.sanitize(text2);

      const exported = sanitizer.exportLogs();
      expect(exported.totalDetections).toBe(2);
      expect(exported.bySeverity.critical).toBe(1);
      expect(exported.bySeverity.high).toBe(1);
    });

    it("should clear logs", async () => {
      const text = "SSN: 123-45-6789";
      await sanitizer.sanitize(text);

      sanitizer.clearLogs();
      const logs = sanitizer.getDetectionLogs();
      expect(logs.length).toBe(0);
    });
  });

  // =========================================================================
  // REAL-WORLD SCENARIOS
  // =========================================================================

  describe("Real-World Scenarios", () => {
    it("should sanitize user sharing financial info", async () => {
      const text =
        "I need help! My credit card 4532015112830366 was stolen. My SSN is 123-45-6789.";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.detections.length).toBe(2);
      expect(result.sanitized).not.toContain("4532015112830366");
      expect(result.sanitized).not.toContain("123-45-6789");
    });

    it("should sanitize address in chat", async () => {
      const text =
        "I live at 123 Main Street Apt 5B, call me at (555) 123-4567";
      const result = await sanitizer.sanitize(text);

      expect(result.containsPII).toBe(true);
      expect(result.sanitized).toContain("[ADDRESS REDACTED]");
      expect(result.sanitized).toContain("[PHONE REDACTED]");
    });

    it("should handle fiction without false positives", async () => {
      const text =
        "In my story, the character's phone was 000-000-0000 which is clearly fake";
      const result = await sanitizer.sanitize(text);

      // Should not flag obviously fake numbers
      expect(result.detections.length).toBe(0);
    });
  });

  // =========================================================================
  // QUICK CHECK METHODS
  // =========================================================================

  describe("Quick Check Methods", () => {
    it("containsPII should do quick check", async () => {
      const text = "SSN: 123-45-6789";
      const hasPII = await sanitizer.containsPII(text);

      expect(hasPII).toBe(true);
    });

    it("detectTypes should return detected types", async () => {
      const text = "SSN: 123-45-6789, Phone: 555-123-4567";
      const types = await sanitizer.detectTypes(text);

      expect(types).toContain(PIIType.SSN);
      expect(types).toContain(PIIType.PHONE);
      expect(types.length).toBe(2);
    });
  });
});
