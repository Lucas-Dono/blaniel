/**
 * Coherence Validation Service
 * 
 * Validates the logical coherence of the generated profile:
 * - Age vs timeline
 * - Location vs cultural references
 * - Education vs occupation
 * - Relationships consistency
 * - etc.
 */

import type { AgentProfileV2 } from '@/types/agent-profile';

// ============================================
// TYPES
// ============================================

export interface CoherenceIssue {
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

export interface CoherenceResult {
  coherent: boolean;
  score: number; // 0-1 (1 = perfect coherence)
  issues: CoherenceIssue[];
  warnings: string[];
}

// ============================================
// MAIN VALIDATOR
// ============================================

/**
 * Validates complete profile coherence
 */
export async function validateCoherence(
  profile: AgentProfileV2
): Promise<CoherenceResult> {
  const issues: CoherenceIssue[] = [];
  const warnings: string[] = [];

  // Run all checks
  issues.push(...checkAgeCoherence(profile));
  issues.push(...checkEducationOccupationCoherence(profile));
  issues.push(...checkLocationCoherence(profile));
  issues.push(...checkTimelineCoherence(profile));
  issues.push(...checkRelationshipCoherence(profile));
  issues.push(...checkCulturalCoherence(profile));

  // Calculate score
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const highIssues = issues.filter(i => i.severity === 'high').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const lowIssues = issues.filter(i => i.severity === 'low').length;

  const totalPenalty =
    criticalIssues * 0.3 + highIssues * 0.15 + mediumIssues * 0.05 + lowIssues * 0.02;

  const score = Math.max(0, 1 - totalPenalty);

  return {
    coherent: criticalIssues === 0 && highIssues === 0,
    score,
    issues,
    warnings,
  };
}

// ============================================
// AGE COHERENCE
// ============================================

function checkAgeCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  const age = profile.basicIdentity.age;

  // Check education vs age
  if (profile.occupation) {
    const education = profile.occupation.education.toLowerCase();

    if (education.includes('phd') || education.includes('doctorate')) {
      if (age < 24) {
        issues.push({
          field: 'occupation.education',
          issue: `PhD at age ${age} is very rare (typical minimum: 25)`,
          severity: 'high',
          suggestion: `Change education to "Master's degree" or increase age to 25+`,
        });
      }
    }

    if (education.includes('master')) {
      if (age < 22) {
        issues.push({
          field: 'occupation.education',
          issue: `Master's degree at age ${age} is uncommon (typical minimum: 23)`,
          severity: 'medium',
          suggestion: `Change to "Bachelor's degree" or increase age`,
        });
      }
    }

    if (education.includes('bachelor')) {
      if (age < 18) {
        issues.push({
          field: 'occupation.education',
          issue: `Bachelor's degree at age ${age} is not possible`,
          severity: 'critical',
          suggestion: `Change to "High school" or increase age to 18+`,
        });
      }
    }
  }

  // Check formative events ages
  if (profile.lifeExperiences?.formativeEvents) {
    for (const event of profile.lifeExperiences.formativeEvents) {
      if (event.age > age) {
        issues.push({
          field: 'lifeExperiences.formativeEvents',
          issue: `Event at age ${event.age} but character is only ${age}`,
          severity: 'critical',
          suggestion: `Event age must be <= current age`,
        });
      }

      if (event.age < 0) {
        issues.push({
          field: 'lifeExperiences.formativeEvents',
          issue: `Event age cannot be negative (${event.age})`,
          severity: 'critical',
          suggestion: `Set valid age >= 0`,
        });
      }
    }
  }

  // Check family ages
  if (profile.family) {
    if (profile.family.mother && profile.family.mother.age) {
      const motherAge = profile.family.mother.age;
      if (motherAge < age) {
        issues.push({
          field: 'family.mother.age',
          issue: `Mother (${motherAge}) younger than character (${age})`,
          severity: 'critical',
          suggestion: `Mother must be at least ${age + 15} years old`,
        });
      }
      if (motherAge - age < 15) {
        issues.push({
          field: 'family.mother.age',
          issue: `Mother-child age gap (${motherAge - age} years) is biologically impossible`,
          severity: 'critical',
          suggestion: `Minimum gap should be 15 years`,
        });
      }
    }

    if (profile.family.father && profile.family.father.age) {
      const fatherAge = profile.family.father.age;
      if (fatherAge < age) {
        issues.push({
          field: 'family.father.age',
          issue: `Father (${fatherAge}) younger than character (${age})`,
          severity: 'critical',
          suggestion: `Father must be at least ${age + 15} years old`,
        });
      }
      if (fatherAge - age < 15) {
        issues.push({
          field: 'family.father.age',
          issue: `Father-child age gap (${fatherAge - age} years) is biologically impossible`,
          severity: 'critical',
          suggestion: `Minimum gap should be 15 years`,
        });
      }
    }
  }

  return issues;
}

// ============================================
// EDUCATION & OCCUPATION COHERENCE
// ============================================

function checkEducationOccupationCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  if (!profile.occupation) return issues;

  const education = profile.occupation.education.toLowerCase();
  const occupation = profile.occupation.current.toLowerCase();

  // Check profession requirements
  const requiresAdvancedDegree = [
    'doctor',
    'physician',
    'surgeon',
    'lawyer',
    'attorney',
    'professor',
    'researcher',
    'scientist',
  ];

  const requiresBachelorMinimum = [
    'engineer',
    'architect',
    'accountant',
    'teacher',
    'nurse',
  ];

  for (const profession of requiresAdvancedDegree) {
    if (occupation.includes(profession)) {
      if (!education.includes('master') && !education.includes('phd') && !education.includes('doctorate')) {
        issues.push({
          field: 'occupation',
          issue: `${profession} typically requires advanced degree (Master's or PhD)`,
          severity: 'high',
          suggestion: `Update education to "Master's" or "PhD" or change occupation`,
        });
      }
    }
  }

  for (const profession of requiresBachelorMinimum) {
    if (occupation.includes(profession)) {
      if (education.includes('high school') || education.includes('secondary')) {
        issues.push({
          field: 'occupation',
          issue: `${profession} requires at least Bachelor's degree`,
          severity: 'high',
          suggestion: `Update education to "Bachelor's" or change occupation`,
        });
      }
    }
  }

  // Check student status
  if (occupation.includes('student')) {
    if (profile.occupation.educationStatus !== 'studying') {
      issues.push({
        field: 'occupation.educationStatus',
        issue: `Occupation is "student" but educationStatus is not "studying"`,
        severity: 'medium',
        suggestion: `Set educationStatus to "studying"`,
      });
    }
  }

  return issues;
}

// ============================================
// LOCATION COHERENCE
// ============================================

function checkLocationCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  // Note: 'verified' property may not exist on CurrentLocation type
  /*
  if (!profile.currentLocation.verified) {
    issues.push({
      field: 'currentLocation',
      issue: 'Location has not been verified with geocoding',
      severity: 'high',
      suggestion: 'Validate location using validation.service.ts',
    });
  }
  */

  // Check if location mentioned in backstory/lifeExperiences is coherent
  if (profile.family?.childhoodHome) {
    const childhoodLocation = profile.family.childhoodHome.toLowerCase();
    const currentCity = profile.currentLocation.city.toLowerCase();

    if (childhoodLocation !== currentCity && !profile.lifeExperiences?.formativeEvents.some(
      e => e.event.toLowerCase().includes('move') || e.event.toLowerCase().includes('mudanza')
    )) {
      issues.push({
        field: 'currentLocation',
        issue: `Character grew up in ${profile.family.childhoodHome} but now lives in ${profile.currentLocation.city} with no mention of moving`,
        severity: 'medium',
        suggestion: `Add a formative event about moving, or make childhood location match current`,
      });
    }
  }

  return issues;
}

// ============================================
// TIMELINE COHERENCE
// ============================================

function checkTimelineCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  if (!profile.lifeExperiences?.formativeEvents) return issues;

  // Sort events by age
  const events = [...profile.lifeExperiences.formativeEvents].sort(
    (a, b) => a.age - b.age
  );

  // Check for impossible sequences
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];

    // Check for events that can't happen in sequence
    if (current.event.toLowerCase().includes('death') && next.age === current.age) {
      issues.push({
        field: 'lifeExperiences.formativeEvents',
        issue: `Death event and another event at same age ${current.age}`,
        severity: 'medium',
        suggestion: `Separate events by at least 1 year`,
      });
    }
  }

  // Check for duplicate events
  const eventDescriptions = events.map(e => e.event.toLowerCase());
  const duplicates = eventDescriptions.filter(
    (e, i) => eventDescriptions.indexOf(e) !== i
  );

  if (duplicates.length > 0) {
    issues.push({
      field: 'lifeExperiences.formativeEvents',
      issue: `Duplicate events found: ${duplicates.join(', ')}`,
      severity: 'low',
      suggestion: `Remove or differentiate duplicate events`,
    });
  }

  return issues;
}

// ============================================
// RELATIONSHIP COHERENCE
// ============================================

function checkRelationshipCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  // Check family dynamics consistency
  if (profile.family) {
    const dynamics = profile.family.familyDynamics?.toLowerCase() || '';

    // If mentions "close family" but all relationships are "distant"
    if (dynamics.includes('close') || dynamics.includes('tight-knit')) {
      let allDistant = true;

      if (profile.family.mother && !profile.family.mother.relationship.toLowerCase().includes('close')) {
        allDistant = true;
      } else {
        allDistant = false;
      }

      if (profile.family.father && !profile.family.father.relationship.toLowerCase().includes('close')) {
        allDistant = allDistant && true;
      } else {
        allDistant = false;
      }

      if (allDistant) {
        issues.push({
          field: 'family.familyDynamics',
          issue: `Family dynamics says "close" but individual relationships are distant`,
          severity: 'medium',
          suggestion: `Make family dynamics match individual relationships`,
        });
      }
    }
  }

  // Check friends consistency
  if (profile.socialCircle) {
    if (profile.socialCircle.friends && profile.socialCircle.friends.length === 0) {
      // Note: 'extraversion' property may not exist on PersonalityTraits type
      const extraversion = (profile.personality as any).extraversion;
      if (extraversion && extraversion > 70) {
        issues.push({
          field: 'socialCircle.friends',
          issue: `High extraversion (${extraversion}) but no friends listed`,
          severity: 'medium',
          suggestion: `Add some friends or reduce extraversion`,
        });
      }
    }
  }

  return issues;
}

// ============================================
// CULTURAL COHERENCE
// ============================================

function checkCulturalCoherence(profile: AgentProfileV2): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  const nationality = profile.basicIdentity.nationality?.toLowerCase();
  const _location = profile.currentLocation.country.toLowerCase();

  // Check if languages match nationality/location
  if (profile.basicIdentity.languages) {
    const languages = profile.basicIdentity.languages.map(l => l.toLowerCase());

    // Common language-country mappings
    const countryLanguages: Record<string, string[]> = {
      'argentina': ['spanish', 'español'],
      'brazil': ['portuguese', 'português'],
      'japan': ['japanese', '日本語'],
      'germany': ['german', 'deutsch'],
      'france': ['french', 'français'],
      'china': ['chinese', '中文', 'mandarin'],
      'spain': ['spanish', 'español'],
      'italy': ['italian', 'italiano'],
      'russia': ['russian', 'русский'],
    };

    if (nationality) {
      const expectedLanguages = countryLanguages[nationality];
      if (expectedLanguages && !expectedLanguages.some(lang =>
        languages.some(l => l.includes(lang))
      )) {
        issues.push({
          field: 'basicIdentity.languages',
          issue: `Nationality is ${nationality} but doesn't speak expected language`,
          severity: 'medium',
          suggestion: `Add ${expectedLanguages[0]} to languages`,
        });
      }
    }
  }

  return issues;
}

// ============================================
// EXPORT HELPERS
// ============================================

/**
 * Get human-readable summary of coherence result
 */
export function getCoherenceSummary(result: CoherenceResult): string {
  if (result.coherent && result.score >= 0.95) {
    return '✅ Excellent coherence - no critical issues';
  }

  if (result.score >= 0.8) {
    return `⚠️ Good coherence with minor issues (${result.issues.length} issues)`;
  }

  if (result.score >= 0.6) {
    return `⚠️ Acceptable coherence but needs review (${result.issues.length} issues)`;
  }

  return `❌ Poor coherence - significant issues found (${result.issues.length} issues)`;
}

/**
 * Filter issues by severity
 */
export function getIssuesBySeverity(
  issues: CoherenceIssue[],
  severity: CoherenceIssue['severity']
): CoherenceIssue[] {
  return issues.filter(i => i.severity === severity);
}
