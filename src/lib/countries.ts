// Dial codes and flags. Deliberately free of libphonenumber: importing
// this list must not pull in its metadata.
export const COUNTRIES = [
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'MY', dial: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'PK', dial: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'PH', dial: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: 'ID', dial: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'VN', dial: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Türkiye' },
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia' },
] as const

export type Country = (typeof COUNTRIES)[number]
