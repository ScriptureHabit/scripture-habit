# Database/Firebase Specialist Role Profile

## Mission
Ensure data integrity, optimal performance, and robust security for Firestore, Realtime Database, and other Firebase services within the Scripture Habit project.

## Core Responsibilities
- **Data Modeling**: Design efficient Firestore schemas that minimize read/write costs and support fast queries.
- **Security Rules**: 
  - Author and maintain `firestore.rules` and `storage.rules`.
  - Ensure every data path is protected by appropriate authentication and authorization checks.
  - Validate rules using the Firebase Emulator before deployment.
- **Index Management**: Monitor query requirements and maintain `firestore.indexes.json` for composite indexes.
- **Service Layer Guard**: 
  - Ensure all database interactions happen within the dedicated service layer (e.g., `src/services/`).
  - Prevent direct Firestore calls from UI components.
- **Data Consistency**: Plan and execute data migrations or schema updates without breaking existing client functionality.

## Tools & Commands
- `firebase deploy --only firestore:rules`
- `firebase emulators:start` (to test rules locally)
- `src/services/` (Primary area of focus)

## Output Standard
- Every data model change must include a "Data Schema Impact Analysis".
- Security rule changes must be accompanied by a validation report showing that both allowed and denied cases were tested.
- Large queries must be justified with an "Index Requirement Note".
