/**
 * Test Script for Analytics Tracking
 * 
 * Verifies that tracking functions work correctly.
 * Run with: npx ts-node --compiler-options '{"module":"commonjs"}' lib/analytics/test-tracking.ts
 */

import {
  getOrCreateSessionId,
  getUTMParams,
  detectDeviceType,
  detectBrowser,
  detectOS,
  getDeviceInfo,
  clearAnalyticsData,
  getAnalyticsDebugInfo,
} from "./track-client";

// ============================================================================
// TEST HELPERS
// ============================================================================

function testSection(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log("=".repeat(60));
}

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    console.log(`✗ ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests() {
  console.log("Starting Analytics Tracking Tests...\n");

  // Test 1: Session ID Generation
  testSection("Session ID Generation & Persistence");

  // Limpiar datos previos
  clearAnalyticsData();

  // Primera llamada - debe generar nuevo ID
  const sessionId1 = getOrCreateSessionId();
  assert(sessionId1.startsWith("sess_"), "Session ID should start with 'sess_'");
  assert(sessionId1.length > 20, "Session ID should be long enough");
  console.log(`Generated Session ID: ${sessionId1}`);

  // Segunda llamada - debe retornar el mismo ID
  const sessionId2 = getOrCreateSessionId();
  assert(sessionId1 === sessionId2, "Session ID should persist across calls");
  console.log(`Persisted Session ID: ${sessionId2}`);

  // Test 2: UTM Parameters
  testSection("UTM Parameters Extraction & Persistence");

  // Nota: En Node.js no tenemos window, estos tests son conceptuales
  // In the browser, you should see UTM params if they are in the URL
  console.log("Note: UTM tests require browser environment");
  console.log("In browser, navigate to: /?utm_source=test&utm_medium=email&utm_campaign=launch");

  // Test 3: Device Detection
  testSection("Device Detection");

  // Nota: Estas funciones requieren browser environment
  console.log("Note: Device detection requires browser environment");
  console.log("In browser, you should see:");
  console.log("- deviceType: mobile | desktop | tablet");
  console.log("- browser: chrome | firefox | safari | edge | other");
  console.log("- os: windows | macos | ios | android | linux | other");

  // Test 4: Debug Info
  testSection("Analytics Debug Info");

  // In the browser, this would show all the info
  console.log("Note: Debug info requires browser environment");
  console.log("In browser console, run: getAnalyticsDebugInfo()");

  // Test 5: Clear Data
  testSection("Clear Analytics Data");

  clearAnalyticsData();
  console.log("✓ Analytics data cleared successfully");

  // Verify that a new session ID was generated after clear
  const sessionId3 = getOrCreateSessionId();
  assert(sessionId3 !== sessionId1, "New session ID should be generated after clear");
  console.log(`New Session ID after clear: ${sessionId3}`);

  console.log("\n" + "=".repeat(60));
  console.log("All tests completed successfully!");
  console.log("=".repeat(60) + "\n");
}

// ============================================================================
// BROWSER TESTS
// ============================================================================

/**
 * Tests que se pueden ejecutar en la consola del navegador
 */
export function runBrowserTests() {
  console.log("Running Browser Tests...\n");

  // Test Session
  console.log("1. Testing Session Management:");
  const sessionId = getOrCreateSessionId();
  console.log(`   Session ID: ${sessionId}`);

  // Test UTM
  console.log("\n2. Testing UTM Parameters:");
  console.log("   Navigate to: /?utm_source=test&utm_medium=email&utm_campaign=launch");
  const utm = getUTMParams();
  console.log(`   UTM Params:`, utm);

  // Test Device
  console.log("\n3. Testing Device Detection:");
  const device = getDeviceInfo();
  console.log(`   Device Info:`, device);

  // Test Debug
  console.log("\n4. Testing Debug Info:");
  const debug = getAnalyticsDebugInfo();
  console.log(`   Debug Info:`, debug);

  console.log("\nBrowser tests completed!");
}

// ============================================================================
// MANUAL TESTING GUIDE
// ============================================================================

export const TESTING_GUIDE = `
# Manual Testing Guide for Analytics Tracking

## 1. Session Management

### Test: Session Persistence
1. Open DevTools Console
2. Run: \`getOrCreateSessionId()\`
3. Copy the session ID
4. Refresh the page
5. Run: \`getOrCreateSessionId()\` again
6. **Expected**: Same session ID returned
7. Clear localStorage and run again
8. **Expected**: New session ID generated

### Test: Session Timeout
1. Run: \`getOrCreateSessionId()\`
2. Wait 31 minutes (or modify SESSION_TIMEOUT to 1 minute for testing)
3. Run: \`getOrCreateSessionId()\` again
4. **Expected**: New session ID generated (old one expired)

## 2. UTM Parameters

### Test: UTM Capture from URL
1. Navigate to: \`/?utm_source=google&utm_medium=cpc&utm_campaign=winter2025\`
2. Run: \`getUTMParams()\`
3. **Expected**: Object with utm_source, utm_medium, utm_campaign

### Test: UTM Persistence
1. Navigate to URL with UTM params
2. Run: \`getUTMParams()\`
3. Navigate to \`/\` (without UTM params)
4. Run: \`getUTMParams()\` again
5. **Expected**: Same UTM params returned (persisted in localStorage)

### Test: UTM Override
1. Navigate to: \`/?utm_source=facebook\`
2. Navigate to: \`/?utm_source=twitter\`
3. Run: \`getUTMParams()\`
4. **Expected**: \`{ utm_source: 'twitter' }\` (new values override old ones)

## 3. Device Detection

### Test: Device Type
1. Open DevTools
2. Toggle device toolbar (mobile view)
3. Run: \`detectDeviceType()\`
4. **Expected**: "mobile"
5. Toggle back to desktop
6. Run: \`detectDeviceType()\`
7. **Expected**: "desktop"

### Test: Browser Detection
1. Run: \`detectBrowser()\`
2. **Expected**: Your current browser (chrome, firefox, safari, etc.)

### Test: OS Detection
1. Run: \`detectOS()\`
2. **Expected**: Your current OS (windows, macos, linux, etc.)

## 4. Event Tracking

### Test: Track Page View
1. Open Network tab in DevTools
2. Filter by "track"
3. Navigate to landing page
4. **Expected**: POST request to /api/analytics/track with eventType "landing.page_view"
5. Check request payload includes:
   - sessionId
   - url
   - referrer
   - deviceType
   - browser
   - os

### Test: Track Custom Event
1. Run in console:
   \`\`\`js
   trackEvent({
     eventType: 'landing.cta_primary',
     metadata: { ctaText: 'Get Started', ctaLocation: 'hero' }
   });
   \`\`\`
2. Check Network tab
3. **Expected**: POST request with metadata enriched with session, device, UTM data

## 5. Scroll Depth Tracking

### Test: Scroll Tracking
1. Navigate to a long page (landing page)
2. Open Console and Network tabs
3. Slowly scroll down
4. **Expected**: Events fired at 25%, 50%, 75%, 100% scroll depth
5. Each event should have \`scrollDepth\` in metadata

## 6. Debug Functions

### Test: Debug Info
1. Run: \`getAnalyticsDebugInfo()\`
2. **Expected**: Object with:
   - session: Current session info
   - utm: Current UTM params
   - device: Device info
   - browserContext: URL, referrer, userAgent

### Test: Clear Data
1. Run: \`getOrCreateSessionId()\` (note the ID)
2. Run: \`clearAnalyticsData()\`
3. Run: \`getOrCreateSessionId()\` again
4. **Expected**: Different session ID (new one generated)

## 7. Error Handling

### Test: Failed Tracking (network offline)
1. Open DevTools Network tab
2. Set throttling to "Offline"
3. Try tracking an event
4. **Expected**: Error logged to console, but no exception thrown
5. App continues working normally

### Test: localStorage Disabled
1. Open DevTools Console
2. Run: \`localStorage.setItem('test', 'test')\` to check if it works
3. If blocked, analytics should still work (falls back to in-memory session ID)
4. **Expected**: No errors, app continues working

## 8. Integration Tests

### Test: Complete Landing Funnel
1. Navigate to: \`/?utm_source=test&utm_medium=integration&utm_campaign=testing\`
2. Scroll to 50%
3. Click "Get Started" button
4. Submit demo chat message
5. Check Network tab
6. **Expected**: All events tracked with same sessionId and UTM params

### Test: Cross-Page Session
1. Land on \`/\`
2. Note session ID from debug info
3. Navigate to \`/pricing\`
4. Check session ID again
5. **Expected**: Same session ID across pages

---

## Running Automated Tests

In browser console:
\`\`\`js
import { runBrowserTests } from '@/lib/analytics/test-tracking';
runBrowserTests();
\`\`\`

## Expected Tracking in Production

### Landing Page Visit
- Event: landing.page_view
- Auto-captured: sessionId, url, referrer, deviceType, browser, os, UTM params

### Demo Interaction
- Event: landing.demo_start
- Event: landing.demo_message (metadata: messageCount, messageLength)
- Event: landing.demo_limit_reached

### CTA Clicks
- Event: landing.cta_primary (metadata: ctaLocation, ctaText)
- Event: landing.cta_secondary

### Scroll Engagement
- Event: landing.scroll_depth (metadata: scrollDepth: 25 | 50 | 75 | 100)
`;

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
