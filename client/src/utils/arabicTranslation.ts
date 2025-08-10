// Arabic to English translation utility
// Provides basic transliteration and common word translations without requiring API keys

// Common Arabic words and their English translations
const ARABIC_DICTIONARY: Record<string, string> = {
  // Building types
  'برج': 'Tower',
  'مبنى': 'Building', 
  'عمارة': 'Building',
  'فيلا': 'Villa',
  'شقة': 'Apartment',
  'مجمع': 'Complex',
  'مركز': 'Center',
  'مول': 'Mall',
  
  // Locations and areas
  'شارع': 'Street',
  'طريق': 'Road',
  'جادة': 'Avenue',
  'ميدان': 'Square',
  'حي': 'District',
  'منطقة': 'Area',
  'قرية': 'Village',
  'مدينة': 'City',
  
  // Amenities
  'مسجد': 'Mosque',
  'مدرسة': 'School',
  'جامعة': 'University',
  'مستشفى': 'Hospital',
  'صيدلية': 'Pharmacy',
  'بنك': 'Bank',
  'مطعم': 'Restaurant',
  'كافيه': 'Cafe',
  'حديقة': 'Park',
  'مكتبة': 'Library',
  'متحف': 'Museum',
  
  // Directions
  'شمال': 'North',
  'جنوب': 'South',
  'شرق': 'East',
  'غرب': 'West',
  'وسط': 'Center',
  
  // Common adjectives
  'جديد': 'New',
  'قديم': 'Old',
  'كبير': 'Big',
  'صغير': 'Small',
  'عالي': 'High',
  'منخفض': 'Low'
};

// Arabic number to English number mapping
const ARABIC_NUMBERS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/**
 * Checks if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  if (!text) return false;
  // Arabic Unicode range: U+0600 to U+06FF
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}

/**
 * Converts Arabic-Indic digits to Western Arabic digits
 */
export function convertArabicNumbers(text: string): string {
  if (!text) return text;
  
  return text.replace(/[٠-٩]/g, (match) => ARABIC_NUMBERS[match] || match);
}

/**
 * Basic Arabic to English translation using dictionary lookup
 */
export function translateArabicText(text: string): string {
  if (!text || !containsArabic(text)) return text;
  
  let translated = text;
  
  // Convert Arabic numbers first
  translated = convertArabicNumbers(translated);
  
  // Replace known Arabic words
  Object.entries(ARABIC_DICTIONARY).forEach(([arabic, english]) => {
    // Use word boundary regex to avoid partial matches
    const regex = new RegExp(arabic, 'g');
    translated = translated.replace(regex, english);
  });
  
  // Clean up extra spaces and format
  translated = translated.replace(/\s+/g, ' ').trim();
  
  return translated;
}

/**
 * Enhanced translation that also handles mixed Arabic-English text
 */
export function smartTranslate(text: string): string {
  if (!text) return text;
  
  // If no Arabic, return as-is
  if (!containsArabic(text)) return text;
  
  // Translate Arabic parts
  let result = translateArabicText(text);
  
  // If translation didn't change much Arabic content, add transliterated version in parentheses
  if (containsArabic(result) && result !== text) {
    const transliterated = transliterateArabic(text);
    if (transliterated !== text) {
      result = `${result} (${transliterated})`;
    }
  }
  
  return result;
}

/**
 * Basic Arabic transliteration to Latin characters
 */
function transliterateArabic(text: string): string {
  if (!text) return text;
  
  const transliterationMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa',
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
    'ة': 'h', 'ء': '', 'ئ': 'i', 'ؤ': 'u'
  };
  
  let result = text;
  
  // Convert Arabic numbers
  result = convertArabicNumbers(result);
  
  // Transliterate Arabic letters
  Object.entries(transliterationMap).forEach(([arabic, latin]) => {
    const regex = new RegExp(arabic, 'g');
    result = result.replace(regex, latin);
  });
  
  // Clean up the result
  result = result
    .replace(/\s+/g, ' ')
    .replace(/([aeiou])\1+/g, '$1') // Remove repeated vowels
    .trim();
  
  return result;
}

/**
 * Utility to enhance POI/building data with translations
 */
export function enhanceWithTranslation<T extends { name?: string; [key: string]: any }>(
  item: T
): T & { translatedName?: string; originalName?: string } {
  if (!item.name) return item;
  
  const translated = smartTranslate(item.name);
  
  if (translated !== item.name) {
    return {
      ...item,
      translatedName: translated,
      originalName: item.name,
      name: translated // Update the name to the translated version
    };
  }
  
  return item;
}