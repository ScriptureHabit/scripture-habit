// Exporting UserProfile interface
export interface UserProfile {
    id: string;
    name: string;
    email: string;
    // Add other user profile fields as necessary
}

// Updating Group interface translations type definition
export interface Group {
    id: string;
    name: string;
    translations: { [language: string]: string }; // Ensure translations is an object of key-value pairs for language translations
}