# Security Page - Refactored Structure

## Overview

The security page has been refactored from a single 1142-line file into a modular component structure for better maintainability and testability.

## File Structure

```
dotmx-frontend/src/app/portal/security/
├── page.tsx              (404 lines) - Main orchestration
├── utils.ts              (90 lines)  - Utility functions
├── page-old.tsx          (1142 lines) - Backup of original file
└── components/
    ├── index.ts                      - Barrel export
    ├── SecurityOverviewBanner.tsx    - Security score display
    ├── UserProfileCard.tsx           - User profile with stats
    ├── QuickActionsCard.tsx          - Quick security actions
    ├── TwoFactorAuthCard.tsx         - 2FA management
    ├── PasswordCard.tsx              - Password management
    ├── WhitelistCard.tsx             - Withdrawal whitelist
    └── SessionsCard.tsx              - Active sessions
```

## Components

### SecurityOverviewBanner

- Displays security score (0-100)
- Shows factor breakdown (Email, 2FA, Whitelist, Activity)
- Color-coded based on security level
- Responsive grid layout

### UserProfileCard

- User avatar with gradient border
- Email and username display
- Verification badge
- Account statistics (Active Devices, Whitelisted Addresses)

### QuickActionsCard

- Quick access buttons for:
  - Enable 2FA (+40 points)
  - Enable Whitelist (+25 points)
  - Change Password
- Visual feedback for completed actions
- Disabled state for enabled features

### TwoFactorAuthCard

- 2FA status display and toggle
- QR code setup modal with instructions
- Verification code input (6-digit)
- Disable 2FA confirmation modal
- Backup codes display and copy
- All modals included inline

### PasswordCard

- Password change form
- Real-time password strength meter
- Requirements checklist with visual indicators:
  - At least 8 characters
  - 12+ characters (recommended)
  - Mixed case letters
  - Contains numbers
  - Special characters
- Toggle visibility for all password fields
- Success/error message display

### WhitelistCard

- Whitelist toggle (enable/disable)
- Address list display
- Add address modal with:
  - Label input
  - Address input (with validation)
  - Chain selector (ETH, BTC, USDT)
- Remove address functionality
- Empty state display

### SessionsCard

- Active sessions list with pagination
- Device detection (Desktop, Tablet, Mobile)
- Browser and OS detection
- Last activity timestamp
- IP address display
- Current session indicator
- Active now indicator for recent sessions
- Revoke session button (except current)

## Utilities (utils.ts)

### getDeviceInfo(userAgent)

Parses user agent string to detect:

- Device type (mobile, tablet, desktop)
- Browser (Chrome, Firefox, Safari, Edge)
- OS (Windows, macOS, Linux, Android, iOS)
- Returns appropriate icon component

### getPasswordStrength(password)

Calculates password strength (0-100):

- Too Short (< 8 chars): 20%
- Weak (40%): Basic requirements
- Fair (60%): Length + some complexity
- Good (80%): Length + mixed case + numbers
- Excellent (100%): All requirements met

Returns:

- strength: number (0-100)
- label: string (Too Short, Weak, Fair, Good, Excellent)
- color: string (red, amber, emerald)
- requirements: Array of requirement checks

### calculateSecurityScore(params)

Computes security score based on:

- Email Verified: +20 points
- Two-Factor Auth: +40 points
- Withdrawal Whitelist: +25 points
- Active Account: +15 points

Returns:

- score: number (0-100)
- factors: Array of factor objects with points and status

## Improvements

### Before Refactoring

- **Single file**: 1142 lines
- **Difficult to maintain**: All logic in one place
- **Hard to test**: Tightly coupled components
- **Poor reusability**: No component separation

### After Refactoring

- **Main page**: 404 lines (65% reduction)
- **7 focused components**: ~80-250 lines each
- **Utility functions**: Separated into utils.ts
- **Modular structure**: Easy to test and maintain
- **Better organization**: Clear separation of concerns
- **Reusable components**: Can be used elsewhere
- **Type-safe**: Full TypeScript interfaces for props

## Features

### Security Score System

- Dynamic scoring based on enabled features
- Visual indicators (color-coded)
- Factor breakdown with points
- Encouraging messages based on score level

### Responsive Design

- 3-column grid on desktop (lg:grid-cols-3)
- 1 column on mobile
- Optimized for all screen sizes
- Touch-friendly buttons and inputs

### User Experience

- Real-time validation
- Loading states for all async operations
- Success/error messages with visual feedback
- Smooth transitions and animations
- Accessibility considerations

## Usage

```tsx
import { SecurityOverviewBanner } from './components';

<SecurityOverviewBanner score={85} factors={[...]} />
```

All components are exported from `./components/index.ts` for clean imports.

## State Management

State is managed in the main `page.tsx` file:

- Password form state
- Sessions data and pagination
- 2FA status and modals
- Whitelist data and modals
- Loading states for each section

## API Integration

All API calls use the `ApiClient` service:

- `changePassword()` - Update user password
- `getSessions()` - Fetch active sessions
- `revokeSession()` - Revoke specific session
- `get2FAStatus()` - Get 2FA status
- `setup2FA()` - Initialize 2FA setup
- `verify2FA()` - Verify 2FA code
- `disable2FA()` - Disable 2FA
- `getWhitelist()` - Fetch whitelist data
- `toggleWhitelist()` - Enable/disable whitelist
- `addWhitelistAddress()` - Add new address
- `removeWhitelistAddress()` - Remove address

## Testing

With the refactored structure, you can now easily:

- Unit test individual components
- Mock props for testing
- Test utility functions in isolation
- Integration test the main page
- Snapshot test UI components

## Future Enhancements

Potential improvements:

- Add biometric authentication
- Session alerts for suspicious activity
- Password expiry notifications
- Security audit logs
- Device fingerprinting
- Risk-based authentication
- Hardware security key support
